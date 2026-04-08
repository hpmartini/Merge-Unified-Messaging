import express from 'express';
import cors from 'cors';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import { existsSync, mkdirSync, readFileSync, writeFileSync, createWriteStream } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { spawn, execSync } from 'child_process';
import { createInterface } from 'readline';
import { createDecipheriv, pbkdf2Sync } from 'crypto';
import cookieParser from 'cookie-parser';
import { authenticate } from './auth/middleware.js';
import { verifyToken } from './auth/jwt.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, 'data-signal');
const AVATARS_DIR = join(DATA_DIR, 'avatars');
const MEDIA_DIR = join(DATA_DIR, 'media');
const SIGNAL_CLI_PATH = join(__dirname, 'signal-cli', 'signal-cli-0.13.24', 'bin', 'signal-cli');
const SIGNAL_CONFIG_DIR = join(__dirname, 'signal-config');

// Ensure data directories exist
if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
if (!existsSync(AVATARS_DIR)) mkdirSync(AVATARS_DIR, { recursive: true });
if (!existsSync(MEDIA_DIR)) mkdirSync(MEDIA_DIR, { recursive: true });
if (!existsSync(SIGNAL_CONFIG_DIR)) mkdirSync(SIGNAL_CONFIG_DIR, { recursive: true });

const app = express();
app.use(cors({
  origin: true,
  credentials: true
}));
app.use(express.json());
app.use(cookieParser());

// Serve avatars and media statically
app.use('/avatars', authenticate, express.static(AVATARS_DIR));
app.use('/media', authenticate, express.static(MEDIA_DIR));

const server = createServer(app);
let wss;

// Store active Signal processes and connections
const signalProcesses = new Map();
const wsConnections = new Map();
const registrationState = new Map(); // Track registration in progress
const cachedReadySessions = new Set(); // Sessions that got ready from cached data (don't send disconnected on process crash)
const recentlySentTimestamps = new Map(); // Track recently sent message timestamps to suppress sync echo duplicates

let serverShuttingDown = false;

// JSON-RPC request ID counter
let rpcIdCounter = 1;
const pendingRequests = new Map();

// Check for existing linked accounts in signal-cli config
function getLinkedAccount(sessionId) {
  const accountsFile = join(SIGNAL_CONFIG_DIR, sessionId, 'data', 'accounts.json');
  if (existsSync(accountsFile)) {
    try {
      const data = JSON.parse(readFileSync(accountsFile, 'utf-8'));
      if (data.accounts && data.accounts.length > 0) {
        return data.accounts[0].number;
      }
    } catch (e) {
      console.error(`[${sessionId}] Error reading accounts.json:`, e.message);
    }
  }
  return null;
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

// ============ SIGNAL DESKTOP IMPORT ============

async function importSignalDesktopMessages(sessionId) {
  const homeDir = process.env.HOME || process.env.USERPROFILE;
  const configPath = join(homeDir, 'Library', 'Application Support', 'Signal', 'config.json');
  const dbPath = join(homeDir, 'Library', 'Application Support', 'Signal', 'sql', 'db.sqlite');

  if (!existsSync(configPath) || !existsSync(dbPath)) {
    console.log(`[${sessionId}] Signal Desktop not found, skipping import`);
    return;
  }

  // Check if we already have cached messages — only import if cache is empty
  const existingMessages = loadData(sessionId, 'messages');
  if (Object.keys(existingMessages).length > 0) {
    console.log(`[${sessionId}] Signal cache already has messages, skipping Desktop import`);
    return;
  }

  try {
    // Get DB encryption key via keytar
    let keytar;
    try {
      keytar = await import('keytar');
    } catch {
      console.log(`[${sessionId}] keytar not available, skipping Signal Desktop import`);
      return;
    }

    const config = JSON.parse(readFileSync(configPath, 'utf8'));
    if (!config.encryptedKey) {
      console.log(`[${sessionId}] No encryptedKey in Signal config`);
      return;
    }

    const password = await keytar.default.getPassword('Signal Safe Storage', 'Signal Key');
    if (!password) {
      console.log(`[${sessionId}] Could not get Signal key from keychain`);
      return;
    }

    const encrypted = Buffer.from(config.encryptedKey, 'hex');
    const key = pbkdf2Sync(password, 'saltysalt', 1003, 16, 'sha1');
    const iv = Buffer.from(' '.repeat(16));
    const decipher = createDecipheriv('aes-128-cbc', key, iv);
    let decrypted = decipher.update(encrypted.subarray(3));
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    const dbKey = decrypted.toString('utf8');

    // sqlcipher queries use only internal constants, no user input (safe from injection)
    function sqlQuery(query) {
      const pragmaAndQuery = `PRAGMA key = "x'${dbKey}'";\n.mode json\n${query}`;
      const result = execSync(`echo ${JSON.stringify(pragmaAndQuery)} | sqlcipher ${JSON.stringify(dbPath)}`, {
        encoding: 'utf8',
        maxBuffer: 50 * 1024 * 1024
      });
      const jsonStart = result.indexOf('[');
      if (jsonStart === -1) return [];
      try { return JSON.parse(result.substring(jsonStart)); } catch { return []; }
    }

    const conversations = sqlQuery(
      "SELECT id, json_extract(json, '$.e164') as phone, json_extract(json, '$.name') as name, json_extract(json, '$.profileName') as profile FROM conversations WHERE json_extract(json, '$.type') = 'private' AND json_extract(json, '$.e164') IS NOT NULL;"
    );

    console.log(`[${sessionId}] Signal Desktop: found ${conversations.length} conversations`);

    const messages = {};
    let totalMessages = 0;

    for (const conv of conversations) {
      const { id: convId, phone, name, profile } = conv;
      if (!phone) continue;
      const contactName = name || profile || phone;

      const msgs = sqlQuery(
        `SELECT sent_at, type, body, hasAttachments FROM messages WHERE conversationId = '${convId}' AND body IS NOT NULL AND body != '' ORDER BY sent_at DESC LIMIT 50;`
      );

      if (msgs.length === 0) continue;
      messages[phone] = [];

      for (const msg of msgs) {
        const sentAt = parseInt(msg.sent_at);
        const msgType = msg.type;
        messages[phone].push({
          id: `${sentAt}_${phone}${msgType === 'outgoing' ? '_sent' : ''}`,
          from: msgType === 'outgoing' ? 'me' : phone,
          to: msgType === 'outgoing' ? phone : 'me',
          body: msg.body || '',
          timestamp: Math.floor(sentAt / 1000),
          fromMe: msgType === 'outgoing',
          contactName: msgType === 'outgoing' ? 'Me' : contactName,
          chatName: contactName,
          hasMedia: (parseInt(msg.hasAttachments) || 0) > 0,
          type: (parseInt(msg.hasAttachments) || 0) > 0 ? 'media' : 'text',
          media: null
        });
        totalMessages++;
      }
      messages[phone].sort((a, b) => a.timestamp - b.timestamp);
    }

    saveData(sessionId, 'messages', messages);

    // Update chat timestamps
    const chats = loadData(sessionId, 'chats');
    for (const [chatId, msgs] of Object.entries(messages)) {
      if (msgs.length === 0) continue;
      const lastMsg = msgs[msgs.length - 1];
      const chatIdx = chats.findIndex(c => c.id === chatId);
      if (chatIdx >= 0) {
        chats[chatIdx].lastMessage = lastMsg.body;
        chats[chatIdx].timestamp = lastMsg.timestamp;
      }
    }
    saveData(sessionId, 'chats', chats);

    console.log(`[${sessionId}] Imported ${totalMessages} messages from ${Object.keys(messages).length} Signal Desktop conversations`);
  } catch (err) {
    console.log(`[${sessionId}] Signal Desktop import failed (non-fatal):`, err.message);
  }
}

// ============ MEDIA HANDLING ============

function getMediaExtension(mimetype) {
  const baseMime = (mimetype || '').split(';')[0].trim();
  const mimeMap = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/gif': '.gif',
    'image/webp': '.webp',
    'video/mp4': '.mp4',
    'video/3gpp': '.3gp',
    'audio/ogg': '.ogg',
    'audio/mpeg': '.mp3',
    'audio/mp4': '.m4a',
    'audio/aac': '.aac',
    'application/pdf': '.pdf',
  };
  return mimeMap[baseMime] || '';
}

function getMediaType(mimetype) {
  const baseMime = (mimetype || '').split(';')[0].trim();
  if (baseMime.startsWith('image/')) return 'image';
  if (baseMime.startsWith('video/')) return 'video';
  if (baseMime.startsWith('audio/')) return 'audio';
  return 'document';
}

// Broadcast to all clients connected to a session
function broadcastToSession(sessionId, data) {
  const clients = wsConnections.get(sessionId);
  if (!clients || clients.size === 0) {
    console.log(`[${sessionId}] Failed to send ${data.type} - no connected clients`);
    return;
  }
  const payload = JSON.stringify(data);
  let sent = 0;
  for (const ws of clients) {
    if (ws.readyState === 1) {
      ws.send(payload);
      sent++;
    }
  }
  console.log(`[${sessionId}] Broadcast ${data.type} to ${sent}/${clients.size} clients`);
}

// ============ SIGNAL-CLI PROCESS MANAGEMENT ============

function sendJsonRpc(process, method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = rpcIdCounter++;
    const request = {
      jsonrpc: '2.0',
      method,
      id,
      params
    };

    pendingRequests.set(id, { resolve, reject, method });

    try {
      process.stdin.write(JSON.stringify(request) + '\n');
    } catch (err) {
      pendingRequests.delete(id);
      reject(err);
    }

    // Timeout after 30 seconds
    setTimeout(() => {
      if (pendingRequests.has(id)) {
        pendingRequests.delete(id);
        reject(new Error(`Request ${method} timed out`));
      }
    }, 30000);
  });
}

function handleJsonRpcResponse(sessionId, line) {
  try {
    const data = JSON.parse(line);

    // Handle responses to our requests
    if (data.id && pendingRequests.has(data.id)) {
      const { resolve, reject, method } = pendingRequests.get(data.id);
      pendingRequests.delete(data.id);

      if (data.error) {
        reject(new Error(data.error.message || 'RPC Error'));
      } else {
        resolve(data.result);
      }
      return;
    }

    // Handle incoming notifications (messages, etc.)
    if (data.method === 'receive') {
      handleIncomingMessage(sessionId, data.params);
    }
  } catch (e) {
    console.error(`[${sessionId}] Failed to parse JSON-RPC:`, e.message, line);
  }
}

function handleIncomingMessage(sessionId, params) {
  const { envelope } = params;
  if (!envelope) return;

  const { source, sourceNumber, sourceName, timestamp, dataMessage, syncMessage, contactsMessage, typingMessage } = envelope;

  // Detailed logging for debugging real-time message delivery
  const msgTypes = [];
  if (dataMessage) msgTypes.push('dataMessage');
  if (syncMessage) msgTypes.push('syncMessage');
  if (contactsMessage) msgTypes.push('contactsMessage');
  if (typingMessage) msgTypes.push('typingMessage');
  if (envelope.receiptMessage) msgTypes.push('receiptMessage');
  console.log(`[${sessionId}] handleIncomingMessage: from=${sourceNumber || source}, types=[${msgTypes.join(',')}]`);

  // Handle contacts sync
  if (contactsMessage) {
    console.log(`[${sessionId}] Received contacts sync`);
    // Contacts sync received - refresh contacts list
    const procData = signalProcesses.get(sessionId);
    if (procData) {
      sendJsonRpc(procData.process, 'listContacts').then(contacts => {
        const contactList = (contacts || []).map(contact => ({
          id: contact.number || contact.uuid,
          name: contact.name || contact.profileName || contact.number || contact.uuid,
          isGroup: false,
          unreadCount: 0,
          avatarUrl: null
        }));
        contactList.forEach(chat => saveChat(sessionId, chat));
        broadcastToSession(sessionId, { type: 'chats', chats: contactList, cached: false });
      }).catch(err => console.error(`[${sessionId}] Error refreshing contacts:`, err));
    }
    return;
  }

  // Skip typing messages
  if (typingMessage) return;

  // Handle regular data messages
  if (dataMessage) {
    const chatId = sourceNumber || source;
    const msgData = {
      id: `${timestamp}_${chatId}`,
      from: chatId,
      to: 'me',
      body: dataMessage.message || '',
      timestamp: Math.floor(timestamp / 1000),
      fromMe: false,
      contactName: sourceName || chatId,
      chatName: sourceName || chatId,
      hasMedia: !!dataMessage.attachments?.length,
      type: dataMessage.attachments?.length ? 'media' : 'text',
      media: null // TODO: Download attachments
    };

    // Handle attachments
    if (dataMessage.attachments && dataMessage.attachments.length > 0) {
      // TODO: Download and save attachments
    }

    saveMessage(sessionId, chatId, msgData);

    // Update or create chat
    saveChat(sessionId, {
      id: chatId,
      name: sourceName || chatId,
      isGroup: false,
      unreadCount: 1,
      lastMessage: msgData.body,
      timestamp: msgData.timestamp
    });

    console.log(`[${sessionId}] Broadcasting incoming dataMessage: from=${chatId}, body="${msgData.body?.substring(0, 50)}"`);
    broadcastToSession(sessionId, { type: 'message', message: msgData });
  }

  // Handle sync messages (messages sent from our other devices)
  if (syncMessage) {
    console.log(`[${sessionId}] Received sync message keys:`, Object.keys(syncMessage), JSON.stringify(syncMessage).substring(0, 500));

    // Handle contacts sync within sync message
    if (syncMessage.contacts) {
      console.log(`[${sessionId}] Processing contacts from sync`);
    }

    // Handle groups sync within sync message
    if (syncMessage.groups) {
      console.log(`[${sessionId}] Processing groups from sync`);
    }
  }

  if (syncMessage && syncMessage.sentMessage) {
    const { destination, destinationNumber, timestamp: sentTimestamp, message, dataMessage: sentDataMessage } = syncMessage.sentMessage;
    const chatId = destinationNumber || destination;
    // Message body can be in sentMessage.message (older signal-cli) or sentMessage.dataMessage.message (newer)
    const body = message || sentDataMessage?.message || '';
    const hasAttachments = !!(sentDataMessage?.attachments?.length);

    if (chatId) {
      // Check if this is a sync echo of a message we just sent — skip to avoid duplicates
      const sentKey = `${sessionId}:${chatId}:${body}`;
      if (recentlySentTimestamps.has(sentKey)) {
        console.log(`[${sessionId}] Skipping sync echo for recently sent message to ${chatId}`);
        recentlySentTimestamps.delete(sentKey);
        return;
      }

      const msgData = {
        id: `${sentTimestamp}_${chatId}_sent`,
        from: 'me',
        to: chatId,
        body: body,
        timestamp: Math.floor(sentTimestamp / 1000),
        fromMe: true,
        contactName: 'Me',
        chatName: chatId,
        hasMedia: hasAttachments,
        type: hasAttachments ? 'media' : 'text',
        media: null
      };

      saveMessage(sessionId, chatId, msgData);

      // Update chat with last message
      saveChat(sessionId, {
        id: chatId,
        name: chatId,
        isGroup: false,
        unreadCount: 0,
        lastMessage: body,
        timestamp: msgData.timestamp
      });

      console.log(`[${sessionId}] Broadcasting sync sentMessage: to=${chatId}, body="${body?.substring(0, 50)}"`);
      broadcastToSession(sessionId, { type: 'message', message: msgData });
    }
  }
}

async function createSignalProcess(sessionId, phoneNumber) {
  console.log(`[${sessionId}] Creating Signal process for ${phoneNumber}...`);

  const configDir = join(SIGNAL_CONFIG_DIR, sessionId);
  if (!existsSync(configDir)) mkdirSync(configDir, { recursive: true });

  const proc = spawn(SIGNAL_CLI_PATH, [
    '-c', configDir,
    '-a', phoneNumber,
    '-o', 'json',
    'jsonRpc',
    '--receive-mode', 'on-start'
  ], {
    stdio: ['pipe', 'pipe', 'pipe']
  });

  // Set up line reader for stdout
  const rl = createInterface({ input: proc.stdout });
  rl.on('line', (line) => {
    console.log(`[${sessionId}] Signal stdout:`, line.substring(0, 200));
    handleJsonRpcResponse(sessionId, line);
  });

  // Log stderr
  proc.stderr.on('data', (data) => {
    const msg = data.toString().trim();
    console.log(`[${sessionId}] Signal stderr:`, msg);

    // Check for common error patterns
    if (msg.includes('User is not registered')) {
      broadcastToSession(sessionId, {
        type: 'not_registered',
        message: 'Phone number is not registered. Please register first.'
      });
    }
  });

  proc.on('error', (err) => {
    console.error(`[${sessionId}] Signal process error:`, err);
    broadcastToSession(sessionId, { type: 'error', message: err.message });
  });

  proc.on('close', (code) => {
    console.log(`[${sessionId}] Signal process exited with code ${code}`);
    signalProcesses.delete(sessionId);
    // Don't broadcast disconnected if we already sent ready from cached data
    if (cachedReadySessions.has(sessionId)) {
      console.log(`[${sessionId}] Process crashed but cached-ready active, not sending disconnected`);
      // Auto-restart signal-cli after a delay to maintain real-time message delivery
      if (!serverShuttingDown) {
        const restartDelay = 5000;
        console.log(`[${sessionId}] Auto-restarting signal-cli in ${restartDelay / 1000}s...`);
        setTimeout(async () => {
          if (serverShuttingDown) return;
          if (signalProcesses.has(sessionId)) {
            console.log(`[${sessionId}] Signal process already running, skip restart`);
            return;
          }
          try {
            await createSignalProcess(sessionId, phoneNumber);
            console.log(`[${sessionId}] Signal process auto-restarted successfully`);
          } catch (err) {
            console.error(`[${sessionId}] Failed to auto-restart signal-cli:`, err.message);
          }
        }, restartDelay);
      }
    } else {
      broadcastToSession(sessionId, { type: 'disconnected', reason: `Process exited with code ${code}` });
    }
  });

  signalProcesses.set(sessionId, { process: proc, phoneNumber });

  // Wait a bit for process to start
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Request message sync from primary device (standard operation for linked devices)
  try {
    console.log(`[${sessionId}] Requesting message sync from primary device...`);
    await sendJsonRpc(proc, 'sendSyncRequest');
    console.log(`[${sessionId}] Sync request sent successfully`);
  } catch (err) {
    console.log(`[${sessionId}] Sync request failed (non-fatal):`, err.message);
  }

  return proc;
}

// ============ REGISTRATION FLOW ============

async function registerAccount(sessionId, phoneNumber) {
  console.log(`[${sessionId}] Registering ${phoneNumber}...`);

  const configDir = join(SIGNAL_CONFIG_DIR, sessionId);
  if (!existsSync(configDir)) mkdirSync(configDir, { recursive: true });

  return new Promise((resolve, reject) => {
    const proc = spawn(SIGNAL_CLI_PATH, [
      '-c', configDir,
      '-a', phoneNumber,
      '-o', 'json',
      'register'
    ], {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let output = '';
    let errorOutput = '';

    proc.stdout.on('data', (data) => {
      output += data.toString();
      console.log(`[${sessionId}] Register stdout:`, data.toString());
    });

    proc.stderr.on('data', (data) => {
      errorOutput += data.toString();
      console.log(`[${sessionId}] Register stderr:`, data.toString());
    });

    proc.on('close', (code) => {
      if (code === 0) {
        resolve({ success: true, output });
      } else {
        // Check if we need captcha
        if (errorOutput.includes('captcha')) {
          resolve({ success: false, needsCaptcha: true, output: errorOutput });
        } else {
          reject(new Error(errorOutput || `Registration failed with code ${code}`));
        }
      }
    });
  });
}

async function verifyAccount(sessionId, phoneNumber, code) {
  console.log(`[${sessionId}] Verifying ${phoneNumber} with code ${code}...`);

  const configDir = join(SIGNAL_CONFIG_DIR, sessionId);

  return new Promise((resolve, reject) => {
    const proc = spawn(SIGNAL_CLI_PATH, [
      '-c', configDir,
      '-a', phoneNumber,
      '-o', 'json',
      'verify',
      code
    ], {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let output = '';
    let errorOutput = '';

    proc.stdout.on('data', (data) => {
      output += data.toString();
    });

    proc.stderr.on('data', (data) => {
      errorOutput += data.toString();
      console.log(`[${sessionId}] Verify stderr:`, data.toString());
    });

    proc.on('close', (code) => {
      if (code === 0) {
        resolve({ success: true, output });
      } else {
        reject(new Error(errorOutput || `Verification failed with code ${code}`));
      }
    });
  });
}

async function linkDevice(sessionId) {
  console.log(`[${sessionId}] Generating device link...`);

  const configDir = join(SIGNAL_CONFIG_DIR, sessionId);
  if (!existsSync(configDir)) mkdirSync(configDir, { recursive: true });

  return new Promise((resolve, reject) => {
    const proc = spawn(SIGNAL_CLI_PATH, [
      '-c', configDir,
      'link',
      '-n', 'Merge Unified Messaging'
    ], {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let linkUri = '';

    proc.stdout.on('data', (data) => {
      const output = data.toString();
      console.log(`[${sessionId}] Link stdout:`, output);

      // Look for the sgnl:// link
      const match = output.match(/sgnl:\/\/[^\s]+/);
      if (match) {
        linkUri = match[0];
        broadcastToSession(sessionId, {
          type: 'link_uri',
          uri: linkUri,
          message: 'Scan this QR code with Signal on your phone'
        });
      }

      // Check for successful linking
      if (output.includes('Associated with')) {
        const phoneMatch = output.match(/Associated with: (\+\d+)/);
        if (phoneMatch) {
          resolve({ success: true, phoneNumber: phoneMatch[1] });
          proc.kill();
        }
      }
    });

    proc.stderr.on('data', (data) => {
      console.log(`[${sessionId}] Link stderr:`, data.toString());
    });

    proc.on('close', (code) => {
      if (code === 0 || linkUri) {
        // Keep the process reference for linking
        registrationState.set(sessionId, { process: proc, linkUri });
      } else {
        reject(new Error(`Link process exited with code ${code}`));
      }
    });

    // Store process reference
    registrationState.set(sessionId, { process: proc });

    // Timeout after 5 minutes
    setTimeout(() => {
      if (registrationState.has(sessionId)) {
        proc.kill();
        registrationState.delete(sessionId);
        reject(new Error('Linking timed out'));
      }
    }, 300000);
  });
}

// ============ WEBSOCKET HANDLER ============

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
          // Check if we have an existing running process
          const existingProc = signalProcesses.get(sessionId);
          if (existingProc) {
            broadcastToSession(sessionId, {
              type: 'ready',
              user: {
                id: existingProc.phoneNumber,
                name: existingProc.phoneNumber,
                phone: existingProc.phoneNumber
              }
            });
          } else {
            // Check if there's a linked account in config
            const linkedPhone = getLinkedAccount(sessionId);
            if (linkedPhone) {
              // Send ready IMMEDIATELY with cached user info so the client
              // can load contacts even if signal-cli fails to start
              console.log(`[${sessionId}] Found linked account ${linkedPhone}, sending ready first...`);
              cachedReadySessions.add(sessionId);
              broadcastToSession(sessionId, {
                type: 'ready',
                user: {
                  id: linkedPhone,
                  name: linkedPhone,
                  phone: linkedPhone
                }
              });

              // Try to start signal-cli in background — failure is non-fatal
              try {
                await createSignalProcess(sessionId, linkedPhone);
                // signal-cli started successfully, no longer just cached
                cachedReadySessions.delete(sessionId);
              } catch (err) {
                console.error(`[${sessionId}] signal-cli failed (non-fatal, using cached data):`, err.message);
                // Do NOT send 'disconnected' or 'error' — client already has 'ready' status
              }
            } else {
              // Need to link/register
              broadcastToSession(sessionId, {
                type: 'need_setup',
                message: 'Signal account not connected. Use link or register.'
              });
            }
          }
          break;

        case 'link':
          // Start device linking flow
          try {
            const result = await linkDevice(sessionId);
            if (result.success) {
              // Save phone number and start jsonRpc
              const phoneNumber = result.phoneNumber;
              await createSignalProcess(sessionId, phoneNumber);
              broadcastToSession(sessionId, {
                type: 'ready',
                user: {
                  id: phoneNumber,
                  name: phoneNumber,
                  phone: phoneNumber
                }
              });
            }
          } catch (err) {
            console.error(`[${sessionId}] Link error:`, err);
            broadcastToSession(sessionId, { type: 'error', message: err.message });
          }
          break;

        case 'register':
          // Start registration flow
          try {
            await registerAccount(sessionId, msg.phoneNumber);
            broadcastToSession(sessionId, {
              type: 'verification_needed',
              message: 'Check your phone for the verification code'
            });
          } catch (err) {
            broadcastToSession(sessionId, { type: 'error', message: err.message });
          }
          break;

        case 'verify':
          // Verify with code
          try {
            await verifyAccount(sessionId, msg.phoneNumber, msg.code);
            await createSignalProcess(sessionId, msg.phoneNumber);
            broadcastToSession(sessionId, {
              type: 'ready',
              user: {
                id: msg.phoneNumber,
                name: msg.phoneNumber,
                phone: msg.phoneNumber
              }
            });
          } catch (err) {
            broadcastToSession(sessionId, { type: 'error', message: err.message });
          }
          break;

        case 'connect':
          // Connect with existing phone number
          try {
            await createSignalProcess(sessionId, msg.phoneNumber);
            broadcastToSession(sessionId, {
              type: 'ready',
              user: {
                id: msg.phoneNumber,
                name: msg.phoneNumber,
                phone: msg.phoneNumber
              }
            });
          } catch (err) {
            broadcastToSession(sessionId, { type: 'error', message: err.message });
          }
          break;

        case 'send':
          // Send a message
          const procData = signalProcesses.get(sessionId);
          if (procData) {
            try {
              const sendResult = await sendJsonRpc(procData.process, 'send', {
                recipient: [msg.to],
                message: msg.body
              });

              // Track this sent message to suppress the sync echo duplicate
              const sentKey = `${sessionId}:${msg.to}:${msg.body}`;
              recentlySentTimestamps.set(sentKey, Date.now());
              // Auto-clean after 30 seconds
              setTimeout(() => recentlySentTimestamps.delete(sentKey), 30000);

              // Save sent message to cache — use client's messageId for cross-tab ID consistency
              const sentTs = msg.messageId || Date.now().toString();
              const sentMessage = {
                id: `${sentTs}_${msg.to}_sent`,
                from: msg.to,
                to: msg.to,
                body: msg.body,
                timestamp: Math.floor(parseInt(sentTs) / 1000),
                fromMe: true,
                contactName: 'Me',
                chatName: msg.to,
                hasMedia: false,
                type: 'text',
                media: null
              };
              saveMessage(sessionId, msg.to, sentMessage);

              // Update chat timestamp
              const chats = loadData(sessionId, 'chats');
              const chatIdx = chats.findIndex(c => c.id === msg.to);
              if (chatIdx !== -1) {
                chats[chatIdx].lastMessage = msg.body;
                chats[chatIdx].timestamp = sentMessage.timestamp;
                saveData(sessionId, 'chats', chats);
              }

              // Broadcast the full sent message to ALL connected clients for cross-tab sync
              broadcastToSession(sessionId, { type: 'message', message: sentMessage });
              broadcastToSession(sessionId, { type: 'sent', messageId: msg.messageId });
            } catch (err) {
              broadcastToSession(sessionId, { type: 'error', message: err.message });
            }
          } else {
            console.log(`[${sessionId}] Cannot send: no signal-cli process running`);
            broadcastToSession(sessionId, { type: 'error', message: 'Signal process not running. Cannot send messages.' });
          }
          break;

        case 'getChats':
          // Get contacts/chats and groups
          const chatsProcData = signalProcesses.get(sessionId);

          // Helper: resolve contact name with proper fallback chain
          const resolveContactName = (contact) => {
            if (contact.name?.trim()) return contact.name;
            if (contact.profileName?.trim()) return contact.profileName;
            const fullName = [contact.givenName, contact.familyName].filter(Boolean).join(' ').trim();
            if (fullName) return fullName;
            if (contact.number) return contact.number;
            return contact.uuid ? `Unknown (${contact.uuid.slice(0, 8)}...)` : 'Unknown';
          };

          // Helper: resolve group name with descriptive fallback
          const resolveGroupName = (group) => {
            if (group.name?.trim()) return group.name;
            if (group.title?.trim()) return group.title;
            const memberCount = group.members?.length || group.memberCount;
            if (memberCount) return `Group (${memberCount} members)`;
            if (group.id) return `Group ${group.id.slice(0, 8)}...`;
            return 'Unnamed Group';
          };

          // First send cached chats
          const cachedChats = loadData(sessionId, 'chats');
          if (cachedChats.length > 0) {
            broadcastToSession(sessionId, { type: 'chats', chats: cachedChats, cached: true });
          }

          if (chatsProcData) {
            try {
              // Get contacts
              const contacts = await sendJsonRpc(chatsProcData.process, 'listContacts');
              const contactList = (contacts || []).map(contact => ({
                id: contact.number || contact.uuid,
                name: resolveContactName(contact),
                isGroup: false,
                unreadCount: 0,
                avatarUrl: null,
                lastMessage: null,
                timestamp: null
              }));

              // Get groups
              let groupList = [];
              try {
                const groups = await sendJsonRpc(chatsProcData.process, 'listGroups');
                groupList = (groups || []).map(group => ({
                  id: group.id,
                  name: resolveGroupName(group),
                  isGroup: true,
                  unreadCount: 0,
                  avatarUrl: null,
                  lastMessage: null,
                  timestamp: null,
                  memberCount: group.members?.length || group.memberCount || 0
                }));
              } catch (groupErr) {
                console.log(`[${sessionId}] Could not fetch groups:`, groupErr.message);
              }

              let chatList = [...contactList, ...groupList];

              // Enhance chats with last message from cached messages
              const allCachedMessages = loadData(sessionId, 'messages');
              chatList = chatList.map(chat => {
                const messages = allCachedMessages[chat.id] || [];
                if (messages.length > 0) {
                  const lastMsg = messages.sort((a, b) => b.timestamp - a.timestamp)[0];
                  return {
                    ...chat,
                    lastMessage: lastMsg?.body || (lastMsg?.hasMedia ? '[Media]' : null),
                    timestamp: lastMsg?.timestamp || null
                  };
                }
                return chat;
              });

              // Sort by timestamp (most recent first), chats without messages at the end
              chatList.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

              // Save to cache
              chatList.forEach(chat => saveChat(sessionId, chat));

              broadcastToSession(sessionId, { type: 'chats', chats: chatList, cached: false });
            } catch (err) {
              console.error(`[${sessionId}] Error getting chats:`, err);
            }
          }
          break;

        case 'getMessages':
          // Get messages for a chat
          const cachedMessages = loadData(sessionId, 'messages');
          const chatMessages = cachedMessages[msg.chatId] || [];

          if (chatMessages.length > 0) {
            broadcastToSession(sessionId, {
              type: 'messages',
              chatId: msg.chatId,
              messages: chatMessages,
              cached: true
            });
          }

          // Signal doesn't support fetching historical messages via signal-cli
          // Messages are only received in real-time
          break;

        case 'getCachedData':
          // Send all cached data
          const allCachedChats = loadData(sessionId, 'chats');
          const allCachedMessages = loadData(sessionId, 'messages');

          if (allCachedChats.length > 0) {
            broadcastToSession(sessionId, { type: 'chats', chats: allCachedChats, cached: true });
          }

          for (const chatId of Object.keys(allCachedMessages)) {
            if (allCachedMessages[chatId].length > 0) {
              broadcastToSession(sessionId, {
                type: 'messages',
                chatId: chatId,
                messages: allCachedMessages[chatId],
                cached: true
              });
            }
          }

          broadcastToSession(sessionId, { type: 'cachedDataLoaded' });
          break;

        case 'logout':
          const logoutProc = signalProcesses.get(sessionId);
          if (logoutProc) {
            logoutProc.process.kill();
            signalProcesses.delete(sessionId);
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

// ============ REST ENDPOINTS ============

app.get('/api/status/:sessionId', authenticate, (req, res) => {
  const procData = signalProcesses.get(req.params.sessionId);
  if (procData) {
    res.json({
      connected: true,
      user: {
        id: procData.phoneNumber,
        name: procData.phoneNumber
      }
    });
  } else {
    res.json({ connected: false });
  }
});

app.get('/api/sessions', authenticate, (req, res) => {
  const sessions = [];
  signalProcesses.forEach((procData, sessionId) => {
    sessions.push({
      sessionId,
      connected: true,
      user: {
        id: procData.phoneNumber,
        name: procData.phoneNumber
      }
    });
  });
  res.json(sessions);
});

app.get('/api/port', authenticate, (req, res) => {
  res.json({ port: server.address().port, service: 'signal' });
});

// ============ SERVER STARTUP ============

const PREFERRED_PORT = parseInt(process.env.SIGNAL_PORT) || 3043;
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

    server.listen(port, async () => {
      console.log(`Signal server running on http://localhost:${port}`);
      console.log(`WebSocket available at ws://localhost:${port}`);

      // Auto-start signal-cli for any linked accounts so messages are always captured
      const DEFAULT_SESSION = 'merge-app';

      // Import messages from Signal Desktop if cache is empty
      await importSignalDesktopMessages(DEFAULT_SESSION);

      const linkedPhone = getLinkedAccount(DEFAULT_SESSION);
      if (linkedPhone && !signalProcesses.has(DEFAULT_SESSION)) {
        console.log(`[${DEFAULT_SESSION}] Auto-starting signal-cli for ${linkedPhone} to capture messages...`);
        try {
          await createSignalProcess(DEFAULT_SESSION, linkedPhone);
          console.log(`[${DEFAULT_SESSION}] signal-cli auto-started successfully`);
        } catch (err) {
          console.error(`[${DEFAULT_SESSION}] Failed to auto-start signal-cli:`, err.message);
        }
      }
    });
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
}

// Graceful shutdown: kill all child signal-cli processes
function cleanupAndExit() {
  if (serverShuttingDown) return;
  serverShuttingDown = true;
  console.log('Signal server shutting down, killing child processes...');
  for (const [sessionId, procData] of signalProcesses) {
    try {
      console.log(`[${sessionId}] Killing signal-cli process...`);
      procData.process.kill('SIGTERM');
    } catch (e) {
      // Process already dead
    }
  }
  setTimeout(() => process.exit(0), 2000);
}

process.on('SIGTERM', cleanupAndExit);
process.on('SIGINT', cleanupAndExit);

startServer();
