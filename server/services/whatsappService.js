import pkg from 'whatsapp-web.js';
const { Client, LocalAuth } = pkg;
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const DATA_DIR = join(__dirname, '..', 'data');
export const AVATARS_DIR = join(DATA_DIR, 'avatars');
export const MEDIA_DIR = join(DATA_DIR, 'media');

if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
if (!existsSync(AVATARS_DIR)) mkdirSync(AVATARS_DIR, { recursive: true });
if (!existsSync(MEDIA_DIR)) mkdirSync(MEDIA_DIR, { recursive: true });

export const clients = new Map();
export const wsConnections = new Map();
export const clientInitializing = new Map();

export function isDetachedFrameError(err) {
  return err && err.message && (
    err.message.includes('detached Frame') ||
    err.message.includes('Execution context was destroyed') ||
    err.message.includes('Protocol error') ||
    err.message.includes('Session closed')
  );
}

export async function reinitializeClient(sessionId) {
  if (clientInitializing.get(sessionId)) {
    console.log(`[${sessionId}] Client already reinitializing, skipping`);
    return null;
  }
  clientInitializing.set(sessionId, true);
  try {
    console.log(`[${sessionId}] Reinitializing WhatsApp client after crash...`);
    const oldClient = clients.get(sessionId);
    if (oldClient) {
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

export function getDataPath(sessionId, type) {
  return join(DATA_DIR, `${sessionId}_${type}.json`);
}

export function loadData(sessionId, type) {
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

export function saveData(sessionId, type, data) {
  const path = getDataPath(sessionId, type);
  try {
    writeFileSync(path, JSON.stringify(data, null, 2));
  } catch (e) {
    console.error(`Failed to save ${type} for ${sessionId}:`, e.message);
  }
}

export const messageStatusCache = new Map();

export function saveMessage(sessionId, chatId, message) {
  const key = `${sessionId}:${chatId}:${message.id}`;
  if (messageStatusCache.has(key)) {
    message.status = messageStatusCache.get(key);
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

  const existingIdx = messages[chatId].findIndex(m => m.id === messageId);
  if (existingIdx >= 0) {
    messages[chatId][existingIdx].status = status;
    saveData(sessionId, 'messages', messages);
  }
}

export function saveChat(sessionId, chat) {
  const chats = loadData(sessionId, 'chats');
  const idx = chats.findIndex(c => c.id === chat.id);
  if (idx >= 0) {
    chats[idx] = { ...chats[idx], ...chat };
  } else {
    chats.push(chat);
  }
  saveData(sessionId, 'chats', chats);
}

export function getAvatarFilename(contactId) {
  return contactId.replace(/[^a-zA-Z0-9]/g, '_') + '.jpg';
}

export async function downloadAvatar(client, contactId, sessionId) {
  try {
    const filename = getAvatarFilename(contactId);
    const filepath = join(AVATARS_DIR, filename);

    if (existsSync(filepath)) {
      return `/avatars/${filename}`;
    }

    const contact = await client.getContactById(contactId);
    const picUrl = await contact.getProfilePicUrl();

    if (picUrl) {
      const response = await fetch(picUrl);
      if (response.ok) {
        const buffer = Buffer.from(await response.arrayBuffer());
        writeFileSync(filepath, buffer);
        console.log(`[${sessionId}] Downloaded avatar for ${contactId}`);
        return `/avatars/${filename}`;
      }
    }
  } catch (err) {
    console.log(`[${sessionId}] Could not get avatar for ${contactId}:`, err.message);
  }
  return null;
}

export function getMediaExtension(mimetype) {
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

export function getMediaType(mimetype) {
  const baseMime = mimetype.split(';')[0].trim();
  if (baseMime.startsWith('image/')) return 'image';
  if (baseMime.startsWith('video/')) return 'video';
  if (baseMime.startsWith('audio/')) return 'audio';
  return 'document';
}

export async function downloadMedia(message, sessionId) {
  try {
    if (!message.hasMedia) return null;

    const safeId = String(message.id.id).replace(/[^a-zA-Z0-9_-]/g, '');

    // Caching Strategy: Check if file already exists on disk before fetching from network
    const files = readdirSync(MEDIA_DIR);
    const cachedFile = files.find(f => f.startsWith(`${safeId}.`));
    
    if (cachedFile) {
      const filepath = join(MEDIA_DIR, cachedFile);
      const stats = statSync(filepath);
      
      // We can infer mimetype from the extension for the cache
      const ext = cachedFile.substring(cachedFile.lastIndexOf('.'));
      let guessedMime = 'application/octet-stream';
      const mimeMap = {
        '.jpg': 'image/jpeg',
        '.png': 'image/png',
        '.gif': 'image/gif',
        '.webp': 'image/webp',
        '.mp4': 'video/mp4',
        '.3gp': 'video/3gpp',
        '.mov': 'video/quicktime',
        '.ogg': 'audio/ogg',
        '.mp3': 'audio/mpeg',
        '.m4a': 'audio/mp4',
        '.aac': 'audio/aac',
        '.pdf': 'application/pdf',
        '.doc': 'application/msword',
        '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      };
      guessedMime = mimeMap[ext] || 'application/octet-stream';

      console.log(`[${sessionId}] Using cached media: ${cachedFile}`);
      return {
        url: `/media/${cachedFile}`,
        mimetype: guessedMime,
        type: getMediaType(guessedMime),
        filename: cachedFile,
        filesize: stats.size
      };
    }

    const media = await message.downloadMedia();
    if (!media) return null;

    const ext = getMediaExtension(media.mimetype);
    const filename = `${safeId}${ext}`;
    const filepath = join(MEDIA_DIR, filename);

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

export function broadcastToSession(sessionId, data) {
  const wsc = wsConnections.get(sessionId);
  if (!wsc || wsc.size === 0) return;
  const payload = JSON.stringify(data);
  for (const ws of wsc) {
    if (ws.readyState === 1) {
      ws.send(payload);
    }
  }
}

export function createWhatsAppClient(sessionId) {
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

  client.on('change_state', (state) => {
    console.log(`[${sessionId}] Client state changed:`, state);
  });

  client.on('message_ack', (msg, ack) => {
    let status = 'sent';
    if (ack === 2) status = 'delivered';
    else if (ack === 3 || ack === 4) status = 'read';

    const chatId = msg.fromMe ? msg.to : msg.from;
    const msgId = msg.id._serialized || msg.id;

    updateMessageStatus(sessionId, chatId, msgId, status);
    broadcastToSession(sessionId, { type: 'receiptMessage', messageId: msgId, chatId, status });
  });

  client.on('typing', (chat) => {
    // Note: whatsapp-web.js 'typing' event might not fire depending on the fork,
    // but this is the standard way to capture it.
    broadcastToSession(sessionId, {
      type: 'typing',
      chatId: chat.id._serialized || chat.id,
      isTyping: true,
      provider: 'whatsapp'
    });
  });

  client.on('message', async (message) => {
    console.log(`[${sessionId}] New message from ${message.from}`);

    try {
      const contact = await message.getContact();
      let chatName = message.from;

      try {
        const chat = await message.getChat();
        chatName = chat.name || contact.pushname || message.from;
      } catch (chatErr) {
        console.log(`[${sessionId}] Could not get chat info (possibly a Channel):`, chatErr.message);
        chatName = contact.pushname || contact.name || message.from;
      }

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

      saveMessage(sessionId, message.from, msgData);
      downloadAvatar(client, message.from, sessionId);
      broadcastToSession(sessionId, { type: 'message', message: msgData });
    } catch (err) {
      console.error(`[${sessionId}] Error processing message:`, err.message);
    }
  });

  clients.set(sessionId, client);
  return client;
}
