import pkg from 'whatsapp-web.js';
const { Client, LocalAuth } = pkg;
import express from 'express';
import cors from 'cors';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';

const app = express();
app.use(cors());
app.use(express.json());

const server = createServer(app);
const wss = new WebSocketServer({ server });

// Store active WhatsApp clients per session
const clients = new Map();
const wsConnections = new Map();

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

      broadcastToSession(sessionId, {
        type: 'message',
        message: {
          id: message.id.id,
          from: message.from,
          to: message.to,
          body: message.body,
          timestamp: message.timestamp,
          fromMe: message.fromMe,
          contactName: contact.pushname || contact.name || message.from,
          chatName: chatName,
          hasMedia: message.hasMedia,
          type: message.type
        }
      });
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
            const chats = await chatsClient.getChats();
            const chatList = [];

            for (const chat of chats.slice(0, 50)) {
              try {
                // Skip Channels (they cause errors in whatsapp-web.js)
                if (chat.id._serialized.includes('@newsletter')) {
                  continue;
                }

                const contact = await chat.getContact();
                chatList.push({
                  id: chat.id._serialized,
                  name: chat.name || contact?.pushname || contact?.name || chat.id.user,
                  isGroup: chat.isGroup,
                  unreadCount: chat.unreadCount,
                  lastMessage: chat.lastMessage?.body,
                  timestamp: chat.lastMessage?.timestamp
                });
              } catch (err) {
                console.log(`[${sessionId}] Skipping chat ${chat.id._serialized}:`, err.message);
              }
            }

            broadcastToSession(sessionId, { type: 'chats', chats: chatList });
          }
          break;

        case 'getMessages':
          // Get messages for a chat
          const messagesClient = clients.get(sessionId);
          if (messagesClient) {
            try {
              const chat = await messagesClient.getChatById(msg.chatId);
              const messages = await chat.fetchMessages({ limit: msg.limit || 50 });
              const messageList = [];

              for (const m of messages) {
                try {
                  const contact = await m.getContact();
                  messageList.push({
                    id: m.id.id,
                    body: m.body,
                    fromMe: m.fromMe,
                    timestamp: m.timestamp,
                    contactName: contact?.pushname || contact?.name || m.from,
                    hasMedia: m.hasMedia,
                    type: m.type
                  });
                } catch (err) {
                  // Skip messages that fail to process
                  console.log(`[${sessionId}] Skipping message:`, err.message);
                }
              }

              broadcastToSession(sessionId, { type: 'messages', chatId: msg.chatId, messages: messageList });
            } catch (err) {
              console.error(`[${sessionId}] Error fetching messages:`, err.message);
              broadcastToSession(sessionId, { type: 'error', message: 'Could not fetch messages for this chat' });
            }
          }
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
