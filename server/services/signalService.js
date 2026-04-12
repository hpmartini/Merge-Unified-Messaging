import { spawn, execSync } from 'child_process';
import { createInterface } from 'readline';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createDecipheriv, pbkdf2Sync } from 'crypto';
import fs from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SERVER_DIR = join(__dirname, '..');

export const DATA_DIR = join(SERVER_DIR, 'data-signal');
export const AVATARS_DIR = join(DATA_DIR, 'avatars');
export const MEDIA_DIR = join(SERVER_DIR, 'data', 'media');
export const SIGNAL_CLI_PATH = join(SERVER_DIR, 'signal-cli', 'signal-cli-0.13.24', 'bin', 'signal-cli');
export const SIGNAL_CONFIG_DIR = join(SERVER_DIR, 'signal-config');

// Ensure directories
if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
if (!existsSync(AVATARS_DIR)) mkdirSync(AVATARS_DIR, { recursive: true });
if (!existsSync(MEDIA_DIR)) mkdirSync(MEDIA_DIR, { recursive: true });
if (!existsSync(SIGNAL_CONFIG_DIR)) mkdirSync(SIGNAL_CONFIG_DIR, { recursive: true });

export const signalProcesses = new Map();
export const wsConnections = new Map();
export const registrationState = new Map();
export const cachedReadySessions = new Set();
export const recentlySentTimestamps = new Map();
export let serverShuttingDown = false;

export function setServerShuttingDown(val) { serverShuttingDown = val; }

let rpcIdCounter = 1;
export const pendingRequests = new Map();

export function getLinkedAccount(sessionId) {
  const accountsFile = join(SIGNAL_CONFIG_DIR, sessionId, 'data', 'accounts.json');
  if (existsSync(accountsFile)) {
    try {
      const data = JSON.parse(readFileSync(accountsFile, 'utf-8'));
      if (data.accounts && data.accounts.length > 0) return data.accounts[0].number;
    } catch (e) { console.error(`[${sessionId}] Error reading accounts.json:`, e.message); }
  }
  return null;
}

export function getDataPath(sessionId, type) { return join(DATA_DIR, `${sessionId}_${type}.json`); }
export function loadData(sessionId, type) {
  const path = getDataPath(sessionId, type);
  if (existsSync(path)) {
    try { return JSON.parse(readFileSync(path, 'utf8')); }
    catch (e) { console.error(`Failed to load ${type} for ${sessionId}:`, e.message); }
  }
  return type === 'messages' ? {} : [];
}
export function saveData(sessionId, type, data) {
  const path = getDataPath(sessionId, type);
  try { writeFileSync(path, JSON.stringify(data, null, 2)); }
  catch (e) { console.error(`Failed to save ${type} for ${sessionId}:`, e.message); }
}
export const messageStatusCache = new Map();

export function saveMessage(sessionId, chatId, message) {
  // Try to find status from cache matching the start of the ID
  for (const [key, status] of messageStatusCache.entries()) {
    if (key.startsWith(`${sessionId}:${chatId}:${message.id}`)) {
      message.status = status;
      break;
    }
  }

  const messages = loadData(sessionId, 'messages');
  if (!messages[chatId]) messages[chatId] = [];
  const existingIdx = messages[chatId].findIndex(m => m.id === message.id);
  if (existingIdx >= 0) {
    const existing = messages[chatId][existingIdx];
    let updated = false;
    if (message.media && !existing.media) {
      existing.media = message.media;
      updated = true;
    }
    if (message.status && existing.status !== message.status) {
      existing.status = message.status;
      updated = true;
    }
    if (updated) {
      saveData(sessionId, 'messages', messages);
    }
  } else {
    messages[chatId].push(message);
    saveData(sessionId, 'messages', messages);
  }
}

export function updateMessageStatus(sessionId, chatId, messageId, status) {
  const key = `${sessionId}:${chatId}:${messageId}`;
  messageStatusCache.set(key, status);
  setTimeout(() => messageStatusCache.delete(key), 3600000);

  const messages = loadData(sessionId, 'messages');
  if (!messages[chatId]) return;

  const existingIdx = messages[chatId].findIndex(m => m.id === messageId || m.id.startsWith(messageId));
  if (existingIdx >= 0) {
    messages[chatId][existingIdx].status = status;
    saveData(sessionId, 'messages', messages);
  }
}
export function saveChat(sessionId, chat) {
  const chats = loadData(sessionId, 'chats');
  const idx = chats.findIndex(c => c.id === chat.id);
  if (idx >= 0) chats[idx] = { ...chats[idx], ...chat };
  else chats.push(chat);
  saveData(sessionId, 'chats', chats);
}

export async function importSignalDesktopMessages(sessionId) {
  const homeDir = process.env.HOME || process.env.USERPROFILE;
  const configPath = join(homeDir, 'Library', 'Application Support', 'Signal', 'config.json');
  const dbPath = join(homeDir, 'Library', 'Application Support', 'Signal', 'sql', 'db.sqlite');
  if (!existsSync(configPath) || !existsSync(dbPath)) return;

  const existingMessages = loadData(sessionId, 'messages');
  if (Object.keys(existingMessages).length > 0) return;

  try {
    let keytar;
    try { keytar = await import('keytar'); } catch { return; }
    const config = JSON.parse(readFileSync(configPath, 'utf8'));
    if (!config.encryptedKey) return;
    const password = await keytar.default.getPassword('Signal Safe Storage', 'Signal Key');
    if (!password) return;

    const encrypted = Buffer.from(config.encryptedKey, 'hex');
    const key = pbkdf2Sync(password, 'saltysalt', 1003, 16, 'sha1');
    const iv = Buffer.from(' '.repeat(16));
    const decipher = createDecipheriv('aes-128-cbc', key, iv);
    let decrypted = decipher.update(encrypted.subarray(3));
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    const dbKey = decrypted.toString('utf8');

    function sqlQuery(query) {
      const pragmaAndQuery = `PRAGMA key = "x'${dbKey}'";\n.mode json\n${query}`;
      const result = execSync(`echo ${JSON.stringify(pragmaAndQuery)} | sqlcipher ${JSON.stringify(dbPath)}`, {
        encoding: 'utf8', maxBuffer: 50 * 1024 * 1024
      });
      const jsonStart = result.indexOf('[');
      if (jsonStart === -1) return [];
      try { return JSON.parse(result.substring(jsonStart)); } catch { return []; }
    }

    const conversations = sqlQuery("SELECT id, json_extract(json, '$.e164') as phone, json_extract(json, '$.name') as name, json_extract(json, '$.profileName') as profile FROM conversations WHERE json_extract(json, '$.type') = 'private' AND json_extract(json, '$.e164') IS NOT NULL;");
    const messages = {};
    let totalMessages = 0;
    for (const conv of conversations) {
      const { id: convId, phone, name, profile } = conv;
      if (!phone) continue;
      const contactName = name || profile || phone;
      const msgs = sqlQuery(`SELECT sent_at, type, body, hasAttachments FROM messages WHERE conversationId = '${convId}' AND body IS NOT NULL AND body != '' ORDER BY sent_at DESC LIMIT 50;`);
      if (msgs.length === 0) continue;
      messages[phone] = [];
      for (const msg of msgs) {
        const sentAt = parseInt(msg.sent_at);
        const msgType = msg.type;
        messages[phone].push({
          id: `${sentAt}_${phone}${msgType === 'outgoing' ? '_sent' : ''}`,
          from: msgType === 'outgoing' ? 'me' : phone,
          to: msgType === 'outgoing' ? phone : 'me',
          body: msg.body || '', timestamp: Math.floor(sentAt / 1000),
          fromMe: msgType === 'outgoing', contactName: msgType === 'outgoing' ? 'Me' : contactName,
          chatName: contactName, hasMedia: (parseInt(msg.hasAttachments) || 0) > 0,
          type: (parseInt(msg.hasAttachments) || 0) > 0 ? 'media' : 'text', media: null
        });
        totalMessages++;
      }
      messages[phone].sort((a, b) => a.timestamp - b.timestamp);
    }
    saveData(sessionId, 'messages', messages);

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
  } catch (err) {}
}

export function broadcastToSession(sessionId, data) {
  const clients = wsConnections.get(sessionId);
  if (!clients || clients.size === 0) return;
  const payload = JSON.stringify(data);
  for (const ws of clients) {
    if (ws.readyState === 1) ws.send(payload);
  }
}

export function sendJsonRpc(process, method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = rpcIdCounter++;
    const request = { jsonrpc: '2.0', method, id, params };
    pendingRequests.set(id, { resolve, reject, method });
    try { process.stdin.write(JSON.stringify(request) + '\n'); }
    catch (err) { pendingRequests.delete(id); reject(err); }
    setTimeout(() => {
      if (pendingRequests.has(id)) {
        pendingRequests.delete(id);
        reject(new Error(`Request ${method} timed out`));
      }
    }, 30000);
  });
}

function handleIncomingMessage(sessionId, params) {
  const { envelope } = params;
  if (!envelope) return;
  const { source, sourceNumber, sourceName, timestamp, dataMessage, syncMessage, contactsMessage, typingMessage, receiptMessage } = envelope;

  if (receiptMessage) {
    const chatId = sourceNumber || source;
    let status = 'sent';
    if (receiptMessage.type === 1) status = 'delivered'; // DeliveryReceipt
    else if (receiptMessage.type === 2) status = 'read'; // ReadReceipt
    else if (receiptMessage.type === 3) status = 'read'; // ViewedReceipt

    if (receiptMessage.timestamps) {
      for (const ts of receiptMessage.timestamps) {
        const msgId = `${ts}_${chatId}_sent`; // We stored sent messages as `${sentTimestamp}_${chatId}_sent`
        updateMessageStatus(sessionId, chatId, msgId, status);
        broadcastToSession(sessionId, { type: 'receiptMessage', messageId: msgId, chatId, status });
      }
    }
  }

  if (syncMessage && syncMessage.readMessages) {
    for (const rm of syncMessage.readMessages) {
      const chatId = rm.senderNumber || rm.sender;
      const msgId = `${rm.timestamp}_${chatId}`;
      updateMessageStatus(sessionId, chatId, msgId, 'read');
      broadcastToSession(sessionId, { type: 'receiptMessage', messageId: msgId, chatId, status: 'read' });
    }
  }

  if (contactsMessage) {
    const procData = signalProcesses.get(sessionId);
    if (procData) {
      sendJsonRpc(procData.process, 'listContacts').then(contacts => {
        const contactList = (contacts || []).map(contact => ({
          id: contact.number || contact.uuid,
          name: contact.name || contact.profileName || contact.number || contact.uuid,
          isGroup: false, unreadCount: 0, avatarUrl: null
        }));
        contactList.forEach(chat => saveChat(sessionId, chat));
        broadcastToSession(sessionId, { type: 'chats', chats: contactList, cached: false });
      }).catch(() => {});
    }
    return;
  }

  if (typingMessage) return;

  if (dataMessage) {
    const chatId = sourceNumber || source;
    const msgData = {
      id: `${timestamp}_${chatId}`, from: chatId, to: 'me',
      body: dataMessage.message || '', timestamp: Math.floor(timestamp / 1000),
      fromMe: false, contactName: sourceName || chatId, chatName: sourceName || chatId,
      hasMedia: !!dataMessage.attachments?.length,
      type: dataMessage.attachments?.length ? 'media' : 'text', media: null
    };

    if (dataMessage.attachments && dataMessage.attachments.length > 0) {
      const configDir = join(SIGNAL_CONFIG_DIR, sessionId);
      const attachmentsList = [];
      for (const att of dataMessage.attachments) {
        const storedFile = att.storedFilename || (att.id ? join(configDir, 'attachments', att.id) : null);
        if (storedFile && existsSync(storedFile)) {
          const fileId = `${Date.now()}-${Math.random().toString(36).substring(7)}`;
          const fileName = att.filename || fileId;
          const finalName = `${fileId}_${fileName}`;
          const finalPath = join(MEDIA_DIR, finalName);
          try {
            fs.copyFileSync(storedFile, finalPath);
            const mediaType = att.contentType?.startsWith('image') ? 'image' : 
                              att.contentType?.startsWith('video') ? 'video' : 
                              att.contentType?.startsWith('audio') ? 'audio' : 'document';
            attachmentsList.push({
              id: fileId, type: mediaType === 'image' ? 'image' : 'document',
              mediaType, url: `/media/${finalName}`, name: fileName,
              size: (att.size || 0).toString(), mimetype: att.contentType
            });
          } catch (e) {}
        }
      }
      if (attachmentsList.length > 0) {
        msgData.attachments = attachmentsList;
        msgData.media = attachmentsList[0].url;
        msgData.type = attachmentsList[0].type === 'image' ? 'image' : 'document';
        msgData.hasMedia = true;
      }
    }
    saveMessage(sessionId, chatId, msgData);
    saveChat(sessionId, { id: chatId, name: sourceName || chatId, isGroup: false, unreadCount: 1, lastMessage: msgData.body, timestamp: msgData.timestamp });
    broadcastToSession(sessionId, { type: 'message', message: msgData });
  }

  if (syncMessage && syncMessage.sentMessage) {
    const { destination, destinationNumber, timestamp: sentTimestamp, message, dataMessage: sentDataMessage } = syncMessage.sentMessage;
    const chatId = destinationNumber || destination;
    const body = message || sentDataMessage?.message || '';
    const hasAttachments = !!(sentDataMessage?.attachments?.length);
    if (chatId) {
      const sentKey = `${sessionId}:${chatId}:${body}`;
      if (recentlySentTimestamps.has(sentKey)) {
        recentlySentTimestamps.delete(sentKey);
        return;
      }
      const msgData = {
        id: `${sentTimestamp}_${chatId}_sent`, from: 'me', to: chatId,
        body: body, timestamp: Math.floor(sentTimestamp / 1000),
        fromMe: true, contactName: 'Me', chatName: chatId,
        hasMedia: hasAttachments, type: hasAttachments ? 'media' : 'text', media: null
      };
      saveMessage(sessionId, chatId, msgData);
      saveChat(sessionId, { id: chatId, name: chatId, isGroup: false, unreadCount: 0, lastMessage: body, timestamp: msgData.timestamp });
      broadcastToSession(sessionId, { type: 'message', message: msgData });
    }
  }
}

export function handleJsonRpcResponse(sessionId, line) {
  try {
    const data = JSON.parse(line);
    if (data.id && pendingRequests.has(data.id)) {
      const { resolve, reject } = pendingRequests.get(data.id);
      pendingRequests.delete(data.id);
      if (data.error) reject(new Error(data.error.message || 'RPC Error'));
      else resolve(data.result);
      return;
    }
    if (data.method === 'receive') handleIncomingMessage(sessionId, data.params);
  } catch (e) {}
}

export async function createSignalProcess(sessionId, phoneNumber) {
  const configDir = join(SIGNAL_CONFIG_DIR, sessionId);
  if (!existsSync(configDir)) mkdirSync(configDir, { recursive: true });

  const proc = spawn(SIGNAL_CLI_PATH, [
    '-c', configDir, '-a', phoneNumber, '-o', 'json', 'jsonRpc', '--receive-mode', 'on-start'
  ], { stdio: ['pipe', 'pipe', 'pipe'] });

  const rl = createInterface({ input: proc.stdout });
  rl.on('line', (line) => handleJsonRpcResponse(sessionId, line));

  proc.stderr.on('data', (data) => {
    const msg = data.toString().trim();
    if (msg.includes('User is not registered')) {
      broadcastToSession(sessionId, { type: 'not_registered', message: 'Phone number is not registered. Please register first.' });
    }
  });

  proc.on('error', (err) => { broadcastToSession(sessionId, { type: 'error', message: err.message }); });
  proc.on('close', (code) => {
    signalProcesses.delete(sessionId);
    if (cachedReadySessions.has(sessionId)) {
      if (!serverShuttingDown) {
        setTimeout(async () => {
          if (serverShuttingDown || signalProcesses.has(sessionId)) return;
          try { await createSignalProcess(sessionId, phoneNumber); } catch (err) {}
        }, 5000);
      }
    } else {
      broadcastToSession(sessionId, { type: 'disconnected', reason: `Process exited with code ${code}` });
    }
  });

  signalProcesses.set(sessionId, { process: proc, phoneNumber });
  await new Promise(resolve => setTimeout(resolve, 2000));
  try { await sendJsonRpc(proc, 'sendSyncRequest'); } catch (err) {}
  return proc;
}

export async function registerAccount(sessionId, phoneNumber) {
  const configDir = join(SIGNAL_CONFIG_DIR, sessionId);
  if (!existsSync(configDir)) mkdirSync(configDir, { recursive: true });
  return new Promise((resolve, reject) => {
    const proc = spawn(SIGNAL_CLI_PATH, ['-c', configDir, '-a', phoneNumber, '-o', 'json', 'register'], { stdio: ['pipe', 'pipe', 'pipe'] });
    let output = '';
    let errorOutput = '';
    proc.stdout.on('data', (data) => { output += data.toString(); });
    proc.stderr.on('data', (data) => { errorOutput += data.toString(); });
    proc.on('close', (code) => {
      if (code === 0) resolve({ success: true, output });
      else if (errorOutput.includes('captcha')) resolve({ success: false, needsCaptcha: true, output: errorOutput });
      else reject(new Error(errorOutput || `Registration failed with code ${code}`));
    });
  });
}

export async function verifyAccount(sessionId, phoneNumber, code) {
  const configDir = join(SIGNAL_CONFIG_DIR, sessionId);
  return new Promise((resolve, reject) => {
    const proc = spawn(SIGNAL_CLI_PATH, ['-c', configDir, '-a', phoneNumber, '-o', 'json', 'verify', code], { stdio: ['pipe', 'pipe', 'pipe'] });
    let output = '', errorOutput = '';
    proc.stdout.on('data', (data) => { output += data.toString(); });
    proc.stderr.on('data', (data) => { errorOutput += data.toString(); });
    proc.on('close', (code) => {
      if (code === 0) resolve({ success: true, output });
      else reject(new Error(errorOutput || `Verification failed with code ${code}`));
    });
  });
}

export async function linkDevice(sessionId) {
  const configDir = join(SIGNAL_CONFIG_DIR, sessionId);
  if (!existsSync(configDir)) mkdirSync(configDir, { recursive: true });
  return new Promise((resolve, reject) => {
    const proc = spawn(SIGNAL_CLI_PATH, ['-c', configDir, 'link', '-n', 'Merge Unified Messaging'], { stdio: ['pipe', 'pipe', 'pipe'] });
    let linkUri = '';
    proc.stdout.on('data', (data) => {
      const output = data.toString();
      const match = output.match(/sgnl:\/\/[^\s]+/);
      if (match) {
        linkUri = match[0];
        broadcastToSession(sessionId, { type: 'link_uri', uri: linkUri, message: 'Scan this QR code with Signal on your phone' });
      }
      if (output.includes('Associated with')) {
        const phoneMatch = output.match(/Associated with: (\+\d+)/);
        if (phoneMatch) {
          resolve({ success: true, phoneNumber: phoneMatch[1] });
          proc.kill();
        }
      }
    });
    proc.on('close', (code) => {
      if (code === 0 || linkUri) registrationState.set(sessionId, { process: proc, linkUri });
      else reject(new Error(`Link process exited with code ${code}`));
    });
    registrationState.set(sessionId, { process: proc });
    setTimeout(() => {
      if (registrationState.has(sessionId)) {
        proc.kill();
        registrationState.delete(sessionId);
        reject(new Error('Linking timed out'));
      }
    }, 300000);
  });
}
