import pkg from 'whatsapp-web.js';
const { Client, LocalAuth } = pkg;
import express from 'express';
import cors from 'cors';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import cookieParser from 'cookie-parser';
import { authenticate } from './auth/middleware.js';
import { verifyToken } from './auth/jwt.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, 'data');
const AVATARS_DIR = join(DATA_DIR, 'avatars');
const MEDIA_DIR = join(DATA_DIR, 'media');

// Ensure data directories exist
if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
if (!existsSync(AVATARS_DIR)) mkdirSync(AVATARS_DIR, { recursive: true });
if (!existsSync(MEDIA_DIR)) mkdirSync(MEDIA_DIR, { recursive: true });

const app = express();
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(express.json());
app.use(cookieParser());

// Serve avatars and media statically
app.use('/avatars', authenticate, express.static(AVATARS_DIR));
app.use('/media', authenticate, express.static(MEDIA_DIR));

const server = createServer(app);
let wss;

// Store active WhatsApp clients per session
const clients = new Map();
const wsConnections = new Map();
const clientInitializing = new Map(); // Track if a client is currently being initialized

// Helper to check if an error is a detached frame error (needs client restart)
function isDetachedFrameError(err) {
  return err && err.message && (
    err.message.includes('detached Frame') ||
    err.message.includes('Execution context was destroyed') ||
    err.message.includes('Protocol error') ||
    err.message.includes('Session closed')
  );
}

// Reinitialize a crashed WhatsApp client
async function reinitializeClient(sessionId) {
  if (clientInitializing.get(sessionId)) {
    console.log(`[${sessionId}] Client already reinitializing, skipping`);
    return null;
  }
  clientInitializing.set(sessionId, true);
  try {
    console.log(`[${sessionId}] Reinitializing WhatsApp client after crash...`);
    const oldClient = clients.get(sessionId);
    if (oldClient) {
      // Try graceful destroy first, then force-kill the browser process
      try { await oldClient.destroy(); } catch (e) {
        console.log(`[${sessionId}] Graceful destroy failed, force-killing browser...`);
        try {
          if (oldClient.pupBrowser) {
            const proc = oldClient.pupBrowser.process();
            if (proc) proc.kill('SIGKILL');
          }
        } catch (killErr) { /* ignore */ }
      }
      clients.delete(sessionId);
      // Give the OS time to release the lock file
      await new Promise(r => setTimeout(r, 2000));
    }
    const newClient = createWhatsAppClient(sessionId);
    await newClient.initialize();
    console.log(`[${sessionId}] Client reinitialized successfully`);
    return newClient;
  } catch (err) {
    console.error(`[${sessionId}] Failed to reinitialize client:`, err.message);
    return null;
  } finally {
    clientInitializing.set(sessionId, false);
  }
}

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

// Broadcast to all clients connected to a session
function broadcastToSession(sessionId, data) {
  const clients = wsConnections.get(sessionId);
  if (!clients || clients.size === 0) return;
  const payload = JSON.stringify(data);
  for (const ws of clients) {
    if (ws.readyState === 1) {
      ws.send(payload);
    }
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

  // Handle client errors (e.g. detached frame) - attempt recovery
  client.on('change_state', (state) => {
    console.log(`[${sessionId}] Client state changed:`, state);
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

// WebSocket connection handler - called after server binds to port
function setupWebSocket() {
  wss.on('connection', (ws, req) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const sessionId = url.searchParams.get('sessionId') || 'default';

  console.log(`[${sessionId}] WebSocket connected`);
  if (!wsConnections.has(sessionId)) {
    wsConnections.set(sessionId, new Set());
  }
  wsConnections.get(sessionId).add(ws);

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
            // Already connected - verify the client is healthy by a simple check
            try {
              await client.getState();
              // Client is healthy, send ready status
              broadcastToSession(sessionId, {
                type: 'ready',
                user: {
                  id: client.info.wid.user,
                  name: client.info.pushname,
                  phone: client.info.wid.user
                }
              });
            } catch (healthErr) {
              if (isDetachedFrameError(healthErr)) {
                console.log(`[${sessionId}] Existing client has detached frame, reinitializing...`);
                client = await reinitializeClient(sessionId);
              } else {
                // Send ready anyway, error might be transient
                broadcastToSession(sessionId, {
                  type: 'ready',
                  user: {
                    id: client.info.wid.user,
                    name: client.info.pushname,
                    phone: client.info.wid.user
                  }
                });
              }
            }
          }
          break;

        case 'send':
          // Send a message
          const whatsappClient = clients.get(sessionId);
          if (whatsappClient) {
            const chatId = msg.to.includes('@') ? msg.to : `${msg.to}@c.us`;
            await whatsappClient.sendMessage(chatId, msg.body);

            // Broadcast the full sent message to ALL connected clients for cross-tab sync
            const sentTs = msg.messageId || Date.now().toString();
            const contactIdClean = chatId.replace('@c.us', '');
            const sentMsgData = {
              id: `${sentTs}_${contactIdClean}_sent`,
              from: chatId,
              to: chatId,
              body: msg.body,
              timestamp: Math.floor(parseInt(sentTs) / 1000),
              fromMe: true,
              contactName: 'Me',
              chatName: chatId,
              hasMedia: false,
              type: 'text',
              media: null
            };
            saveMessage(sessionId, chatId.replace('@c.us', ''), sentMsgData);
            broadcastToSession(sessionId, { type: 'message', message: sentMsgData });
            broadcastToSession(sessionId, { type: 'sent', messageId: msg.messageId });
          }
          break;

        case 'getChats':
          // Get all chats
          let chatsClient = clients.get(sessionId);
          if (chatsClient) {
            // First send cached chats immediately
            const cachedChats = loadData(sessionId, 'chats');
            if (cachedChats.length > 0) {
              console.log(`[${sessionId}] Sending ${cachedChats.length} cached chats`);
              broadcastToSession(sessionId, { type: 'chats', chats: cachedChats, cached: true });
            }

            // Then fetch fresh chats from WhatsApp
            let chats;
            try {
              chats = await chatsClient.getChats();
            } catch (chatsFetchErr) {
              if (isDetachedFrameError(chatsFetchErr)) {
                console.log(`[${sessionId}] Detached frame during getChats, reinitializing...`);
                chatsClient = await reinitializeClient(sessionId);
                if (!chatsClient) break;
                chats = await chatsClient.getChats();
              } else {
                throw chatsFetchErr;
              }
            }
            const chatList = [];
            const BATCH_SIZE = 30;
            const filteredChats = chats.filter(c => !c.id._serialized.includes('@newsletter'));
            console.log(`[${sessionId}] Processing ${filteredChats.length} chats (total from WhatsApp: ${chats.length})`);

            for (let i = 0; i < filteredChats.length; i++) {
              const chat = filteredChats[i];
              try {
                let contactName = chat.name;
                // Only fetch contact details if name is missing
                if (!contactName) {
                  try {
                    const contact = await chat.getContact();
                    contactName = contact?.pushname || contact?.name || chat.id.user;
                  } catch {
                    contactName = chat.id.user;
                  }
                }

                // Only download avatars for recent chats (first 50)
                const avatarUrl = i < 50
                  ? await downloadAvatar(chatsClient, chat.id._serialized, sessionId)
                  : null;

                const chatData = {
                  id: chat.id._serialized,
                  name: contactName,
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

              // Send in batches for faster UI updates
              if (chatList.length % BATCH_SIZE === 0) {
                console.log(`[${sessionId}] Sending batch of ${chatList.length} chats...`);
                broadcastToSession(sessionId, { type: 'chats', chats: [...chatList], cached: false });
              }
            }

            // Send final complete list
            console.log(`[${sessionId}] Sending final chat list: ${chatList.length} chats`);
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
              let chat;
              let messages;
              try {
                chat = await messagesClient.getChatById(msg.chatId);
                messages = await chat.fetchMessages({ limit: msg.limit || 50 });
              } catch (fetchErr) {
                if (isDetachedFrameError(fetchErr)) {
                  console.log(`[${sessionId}] Detached frame during getMessages, reinitializing...`);
                  const recoveredClient = await reinitializeClient(sessionId);
                  if (!recoveredClient) throw fetchErr;
                  chat = await recoveredClient.getChatById(msg.chatId);
                  messages = await chat.fetchMessages({ limit: msg.limit || 50 });
                } else {
                  throw fetchErr;
                }
              }
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
    const clients = wsConnections.get(sessionId);
    if (clients) {
      clients.delete(ws);
      if (clients.size === 0) {
        wsConnections.delete(sessionId);
      }
    }
  });
  });
}

// REST endpoints for status checks
app.get('/api/status/:sessionId', authenticate, (req, res) => {
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

app.get('/api/sessions', authenticate, (req, res) => {
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
app.get('/api/port', authenticate, (req, res) => {
  res.json({ port: server.address().port, service: 'whatsapp' });
});

// Try ports starting from preferred, find first available
const PREFERRED_PORT = parseInt(process.env.WHATSAPP_PORT) || 3042;
const MAX_PORT_ATTEMPTS = 10;

async function findAvailablePort(startPort, maxAttempts = 10) {
  const net = await import('net');

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const port = startPort + attempt;
    const isAvailable = await new Promise((resolve) => {
      const tester = net.createServer()
        .once('error', () => resolve(false))
        .once('listening', () => {
          tester.close();
          resolve(true);
        })
        .listen(port);
    });

    if (isAvailable) {
      return port;
    }
    console.log(`Port ${port} in use, trying ${port + 1}...`);
  }

  throw new Error(`Could not find an available port after ${maxAttempts} attempts`);
}

async function startServer() {
  try {
    const port = await findAvailablePort(PREFERRED_PORT);

    wss = new WebSocketServer({ noServer: true });
    setupWebSocket();

    server.on('upgrade', (request, socket, head) => {
      let token = null;
      if (request.headers.cookie) {
        const cookies = Object.fromEntries(request.headers.cookie.split('; ').map(c => c.split('=')));
        token = cookies.jwt;
      }
      
      if (!token) {
        socket.write('HTTP/1.1 401 Unauthorized\\r\\n\\r\\n');
        socket.destroy();
        return;
      }
      
      try {
        verifyToken(token);
        wss.handleUpgrade(request, socket, head, (ws) => {
          wss.emit('connection', ws, request);
        });
      } catch (err) {
        socket.write('HTTP/1.1 401 Unauthorized\\r\\n\\r\\n');
        socket.destroy();
      }
    });

    server.listen(port, () => {
      console.log(`WhatsApp server running on http://localhost:${port}`);
      console.log(`WebSocket available at ws://localhost:${port}`);
    });
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
}

export { app };
if (process.env.NODE_ENV !== 'test') {
  startServer();
}
