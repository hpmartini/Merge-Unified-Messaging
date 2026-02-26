import pkg from 'whatsapp-web.js';
const { Client, LocalAuth } = pkg;
import express from 'express';
import cors from 'cors';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, 'data');
const AVATARS_DIR = join(DATA_DIR, 'avatars');
const MEDIA_DIR = join(DATA_DIR, 'media');

// Ensure data directories exist
if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
if (!existsSync(AVATARS_DIR)) mkdirSync(AVATARS_DIR, { recursive: true });
if (!existsSync(MEDIA_DIR)) mkdirSync(MEDIA_DIR, { recursive: true });

const app = express();
app.use(cors());
app.use(express.json());

// Serve avatars and media statically
app.use('/avatars', express.static(AVATARS_DIR));
app.use('/media', express.static(MEDIA_DIR));

const server = createServer(app);
const wss = new WebSocketServer({ server });

// Store active WhatsApp clients per session
const clients = new Map();
const wsConnections = new Map();

// ============ DATA PERSISTENCE ============

function getDataPath(sessionId, type) {
  return join(DATA_DIR, `${sessionId}_${type}.json`);
}

function loadData(sessionId, type) {
  const path = getDataPath(sessionId, type);
  if (existsSync(path)) {
    try {
      return JSON.parse(readFileSync(path, 'utf8'));
    } catch (e) {
      console.error(`Failed to load ${type} for ${sessionId}:`, e.message);
    }
  }
  return type === 'messages' ? {} : [];
}

function saveData(sessionId, type, data) {
  const path = getDataPath(sessionId, type);
  try {
    writeFileSync(path, JSON.stringify(data, null, 2));
  } catch (e) {
    console.error(`Failed to save ${type} for ${sessionId}:`, e.message);
  }
}

function saveMessage(sessionId, chatId, message) {
  const messages = loadData(sessionId, 'messages');
  if (!messages[chatId]) messages[chatId] = [];

  const existingIdx = messages[chatId].findIndex(m => m.id === message.id);
  if (existingIdx >= 0) {
    // Update existing message if new one has media that old one lacks
    const existing = messages[chatId][existingIdx];
    if (message.media && !existing.media) {
      messages[chatId][existingIdx] = { ...existing, media: message.media };
      saveData(sessionId, 'messages', messages);
    }
  } else {
    messages[chatId].push(message);
    saveData(sessionId, 'messages', messages);
  }
}

function saveChat(sessionId, chat) {
  const chats = loadData(sessionId, 'chats');
  const idx = chats.findIndex(c => c.id === chat.id);
  if (idx >= 0) {
    chats[idx] = { ...chats[idx], ...chat };
  } else {
    chats.push(chat);
  }
  saveData(sessionId, 'chats', chats);
}

// ============ AVATAR HANDLING ============

function getAvatarFilename(contactId) {
  // Sanitize the contact ID for filename
  return contactId.replace(/[^a-zA-Z0-9]/g, '_') + '.jpg';
}

async function downloadAvatar(client, contactId, sessionId) {
  try {
    const filename = getAvatarFilename(contactId);
    const filepath = join(AVATARS_DIR, filename);

    // Skip if already downloaded
    if (existsSync(filepath)) {
      return `/avatars/${filename}`;
    }

    const contact = await client.getContactById(contactId);
    const picUrl = await contact.getProfilePicUrl();

    if (picUrl) {
      // Fetch the image
      const response = await fetch(picUrl);
      if (response.ok) {
        const buffer = Buffer.from(await response.arrayBuffer());
        writeFileSync(filepath, buffer);
        console.log(`[${sessionId}] Downloaded avatar for ${contactId}`);
        return `/avatars/${filename}`;
      }
    }
  } catch (err) {
    // Profile pic not available or private
    console.log(`[${sessionId}] Could not get avatar for ${contactId}:`, err.message);
  }
  return null;
}

// ============ MEDIA HANDLING ============

function getMediaExtension(mimetype) {
  // Strip codec info (e.g., 'audio/ogg; codecs=opus' -> 'audio/ogg')
  const baseMime = mimetype.split(';')[0].trim();

  const mimeMap = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/gif': '.gif',
    'image/webp': '.webp',
    'video/mp4': '.mp4',
    'video/3gpp': '.3gp',
    'video/quicktime': '.mov',
    'audio/ogg': '.ogg',
    'audio/mpeg': '.mp3',
    'audio/mp4': '.m4a',
    'audio/aac': '.aac',
    'application/pdf': '.pdf',
    'application/msword': '.doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  };
  return mimeMap[baseMime] || '';
}

function getMediaType(mimetype) {
  const baseMime = mimetype.split(';')[0].trim();
  if (baseMime.startsWith('image/')) return 'image';
  if (baseMime.startsWith('video/')) return 'video';
  if (baseMime.startsWith('audio/')) return 'audio';
  return 'document';
}

async function downloadMedia(message, sessionId) {
  try {
    if (!message.hasMedia) return null;

    const media = await message.downloadMedia();
    if (!media) return null;

    const ext = getMediaExtension(media.mimetype);
    const filename = `${message.id.id}${ext}`;
    const filepath = join(MEDIA_DIR, filename);

    // Skip if already downloaded
    if (existsSync(filepath)) {
      return {
        url: `/media/${filename}`,
        mimetype: media.mimetype,
        type: getMediaType(media.mimetype),
        filename: media.filename || filename,
        filesize: media.filesize
      };
    }

    // Save media to disk
    const buffer = Buffer.from(media.data, 'base64');
    writeFileSync(filepath, buffer);
    console.log(`[${sessionId}] Downloaded media: ${filename} (${media.mimetype})`);

    return {
      url: `/media/${filename}`,
      mimetype: media.mimetype,
      type: getMediaType(media.mimetype),
      filename: media.filename || filename,
      filesize: buffer.length
    };
  } catch (err) {
    console.error(`[${sessionId}] Failed to download media:`, err.message);
    return null;
  }
}

// Broadcast to specific session
function broadcastToSession(sessionId, data) {
  const ws = wsConnections.get(sessionId);
  if (ws && ws.readyState === 1) {
    ws.send(JSON.stringify(data));
  }
}

// Create a new WhatsApp client for a session
function createWhatsAppClient(sessionId) {
  console.log(`[${sessionId}] Creating WhatsApp client...`);

  const client = new Client({
    authStrategy: new LocalAuth({ clientId: sessionId }),
    puppeteer: {
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu'
      ]
    }
  });

  client.on('qr', (qr) => {
    console.log(`[${sessionId}] QR Code received`);
    broadcastToSession(sessionId, { type: 'qr', qr });
  });

  client.on('authenticated', () => {
    console.log(`[${sessionId}] Authenticated`);
    broadcastToSession(sessionId, { type: 'authenticated' });
  });

  client.on('auth_failure', (msg) => {
    console.log(`[${sessionId}] Auth failure:`, msg);
    broadcastToSession(sessionId, { type: 'auth_failure', message: msg });
  });

  client.on('ready', async () => {
    console.log(`[${sessionId}] Client is ready`);
    const info = client.info;
    broadcastToSession(sessionId, {
      type: 'ready',
      user: {
        id: info.wid.user,
        name: info.pushname,
        phone: info.wid.user
      }
    });
  });

  client.on('disconnected', (reason) => {
    console.log(`[${sessionId}] Disconnected:`, reason);
    broadcastToSession(sessionId, { type: 'disconnected', reason });
    clients.delete(sessionId);
  });

  client.on('message', async (message) => {
    console.log(`[${sessionId}] New message from ${message.from}`);

    try {
      const contact = await message.getContact();
      let chatName = message.from;

      // Try to get chat, but handle Channel errors gracefully
      try {
        const chat = await message.getChat();
        chatName = chat.name || contact.pushname || message.from;
      } catch (chatErr) {
        console.log(`[${sessionId}] Could not get chat info (possibly a Channel):`, chatErr.message);
        chatName = contact.pushname || contact.name || message.from;
      }

      // Download media if present
      let media = null;
      if (message.hasMedia) {
        media = await downloadMedia(message, sessionId);
      }

      const msgData = {
        id: message.id.id,
        from: message.from,
        to: message.to,
        body: message.body,
        timestamp: message.timestamp,
        fromMe: message.fromMe,
        contactName: contact.pushname || contact.name || message.from,
        chatName: chatName,
        hasMedia: message.hasMedia,
        type: message.type,
        media: media
      };

      // Save message to disk
      saveMessage(sessionId, message.from, msgData);

      // Download avatar in background
      downloadAvatar(client, message.from, sessionId);

      broadcastToSession(sessionId, { type: 'message', message: msgData });
    } catch (err) {
      console.error(`[${sessionId}] Error processing message:`, err.message);
    }
  });

  clients.set(sessionId, client);
  return client;
}

// WebSocket connection handler
wss.on('connection', (ws, req) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const sessionId = url.searchParams.get('sessionId') || 'default';

  console.log(`[${sessionId}] WebSocket connected`);
  wsConnections.set(sessionId, ws);

  ws.on('message', async (data) => {
    try {
      const msg = JSON.parse(data.toString());
      console.log(`[${sessionId}] Received:`, msg.type);

      switch (msg.type) {
        case 'init':
          // Initialize WhatsApp client
          let client = clients.get(sessionId);
          if (!client) {
            client = createWhatsAppClient(sessionId);
            await client.initialize();
          } else if (client.info) {
            // Already connected, send ready status
            broadcastToSession(sessionId, {
              type: 'ready',
              user: {
                id: client.info.wid.user,
                name: client.info.pushname,
                phone: client.info.wid.user
              }
            });
          }
          break;

        case 'send':
          // Send a message
          const whatsappClient = clients.get(sessionId);
          if (whatsappClient) {
            const chatId = msg.to.includes('@') ? msg.to : `${msg.to}@c.us`;
            await whatsappClient.sendMessage(chatId, msg.body);
            broadcastToSession(sessionId, { type: 'sent', messageId: msg.messageId });
          }
          break;

        case 'getChats':
          // Get all chats
          const chatsClient = clients.get(sessionId);
          if (chatsClient) {
            // First send cached chats immediately
            const cachedChats = loadData(sessionId, 'chats');
            if (cachedChats.length > 0) {
              console.log(`[${sessionId}] Sending ${cachedChats.length} cached chats`);
              broadcastToSession(sessionId, { type: 'chats', chats: cachedChats, cached: true });
            }

            // Then fetch fresh chats from WhatsApp
            const chats = await chatsClient.getChats();
            const chatList = [];

            for (const chat of chats.slice(0, 50)) {
              try {
                // Skip Channels (they cause errors in whatsapp-web.js)
                if (chat.id._serialized.includes('@newsletter')) {
                  continue;
                }

                const contact = await chat.getContact();

                // Download avatar in background
                const avatarUrl = await downloadAvatar(chatsClient, chat.id._serialized, sessionId);

                const chatData = {
                  id: chat.id._serialized,
                  name: chat.name || contact?.pushname || contact?.name || chat.id.user,
                  isGroup: chat.isGroup,
                  unreadCount: chat.unreadCount,
                  lastMessage: chat.lastMessage?.body,
                  timestamp: chat.lastMessage?.timestamp,
                  avatarUrl: avatarUrl
                };

                chatList.push(chatData);

                // Save chat to disk
                saveChat(sessionId, chatData);
              } catch (err) {
                console.log(`[${sessionId}] Skipping chat ${chat.id._serialized}:`, err.message);
              }
            }

            broadcastToSession(sessionId, { type: 'chats', chats: chatList, cached: false });
          }
          break;

        case 'getMessages':
          // Get messages for a chat
          console.log(`[${sessionId}] getMessages request for chatId: ${msg.chatId}`);
          const messagesClient = clients.get(sessionId);

          // First send cached messages immediately
          const allCachedMessages = loadData(sessionId, 'messages');
          const cachedMessages = allCachedMessages[msg.chatId] || [];
          if (cachedMessages.length > 0) {
            console.log(`[${sessionId}] Sending ${cachedMessages.length} cached messages for ${msg.chatId}`);
            broadcastToSession(sessionId, { type: 'messages', chatId: msg.chatId, messages: cachedMessages, cached: true });
          } else {
            console.log(`[${sessionId}] No cached messages for ${msg.chatId}`);
          }

          if (messagesClient) {
            console.log(`[${sessionId}] Fetching fresh messages from WhatsApp for ${msg.chatId}...`);
            try {
              const chat = await messagesClient.getChatById(msg.chatId);
              const messages = await chat.fetchMessages({ limit: msg.limit || 50 });
              console.log(`[${sessionId}] Fetched ${messages.length} messages from WhatsApp`);
              const messageList = [];

              for (const m of messages) {
                try {
                  const contact = await m.getContact();

                  // Download media if present
                  let media = null;
                  if (m.hasMedia) {
                    media = await downloadMedia(m, sessionId);
                  }

                  const msgData = {
                    id: m.id.id,
                    body: m.body,
                    fromMe: m.fromMe,
                    timestamp: m.timestamp,
                    contactName: contact?.pushname || contact?.name || m.from,
                    hasMedia: m.hasMedia,
                    type: m.type,
                    media: media
                  };
                  messageList.push(msgData);

                  // Save message to disk
                  saveMessage(sessionId, msg.chatId, msgData);
                } catch (err) {
                  // Skip messages that fail to process
                  console.log(`[${sessionId}] Skipping message:`, err.message);
                }
              }

              console.log(`[${sessionId}] Sending ${messageList.length} fresh messages to frontend`);
              broadcastToSession(sessionId, { type: 'messages', chatId: msg.chatId, messages: messageList, cached: false });
            } catch (err) {
              console.error(`[${sessionId}] Error fetching messages:`, err.message, err.stack);
              // If we already sent cached messages, don't send error
              if (cachedMessages.length === 0) {
                broadcastToSession(sessionId, { type: 'error', message: 'Could not fetch messages for this chat' });
              }
            }
          } else {
            console.log(`[${sessionId}] No WhatsApp client available for getMessages`);
          }
          break;

        case 'getCachedData':
          // Send cached data immediately (for offline/startup)
          const cachedChatsData = loadData(sessionId, 'chats');
          const cachedMessagesData = loadData(sessionId, 'messages');

          if (cachedChatsData.length > 0) {
            broadcastToSession(sessionId, { type: 'chats', chats: cachedChatsData, cached: true });
          }

          // Send cached messages for each chat
          for (const chatId of Object.keys(cachedMessagesData)) {
            if (cachedMessagesData[chatId].length > 0) {
              broadcastToSession(sessionId, {
                type: 'messages',
                chatId: chatId,
                messages: cachedMessagesData[chatId],
                cached: true
              });
            }
          }

          broadcastToSession(sessionId, { type: 'cachedDataLoaded' });
          break;

        case 'logout':
          const logoutClient = clients.get(sessionId);
          if (logoutClient) {
            await logoutClient.logout();
            clients.delete(sessionId);
          }
          break;
      }
    } catch (error) {
      console.error(`[${sessionId}] Error:`, error);
      broadcastToSession(sessionId, { type: 'error', message: error.message });
    }
  });

  ws.on('close', () => {
    console.log(`[${sessionId}] WebSocket disconnected`);
    wsConnections.delete(sessionId);
  });
});

// REST endpoints for status checks
app.get('/api/status/:sessionId', (req, res) => {
  const client = clients.get(req.params.sessionId);
  if (client && client.info) {
    res.json({
      connected: true,
      user: {
        id: client.info.wid.user,
        name: client.info.pushname
      }
    });
  } else {
    res.json({ connected: false });
  }
});

app.get('/api/sessions', (req, res) => {
  const sessions = [];
  clients.forEach((client, sessionId) => {
    sessions.push({
      sessionId,
      connected: !!client.info,
      user: client.info ? {
        id: client.info.wid.user,
        name: client.info.pushname
      } : null
    });
  });
  res.json(sessions);
});

// Port discovery endpoint
app.get('/api/port', (req, res) => {
  res.json({ port: server.address().port });
});

// Try ports starting from preferred, find first available
const PREFERRED_PORT = parseInt(process.env.WHATSAPP_PORT) || 3042;
const MAX_PORT_ATTEMPTS = 10;

function tryListen(port, attempt = 0) {
  if (attempt >= MAX_PORT_ATTEMPTS) {
    console.error('Could not find an available port after', MAX_PORT_ATTEMPTS, 'attempts');
    process.exit(1);
  }

  server.listen(port, () => {
    console.log(`WhatsApp server running on http://localhost:${port}`);
    console.log(`WebSocket available at ws://localhost:${port}`);
  }).on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.log(`Port ${port} in use, trying ${port + 1}...`);
      tryListen(port + 1, attempt + 1);
    } else {
      throw err;
    }
  });
}

tryListen(PREFERRED_PORT);
