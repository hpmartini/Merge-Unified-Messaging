import pkg from 'whatsapp-web.js';
const { Client, LocalAuth } = pkg;
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
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

export function saveMessage(sessionId, chatId, message) {
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

    const media = await message.downloadMedia();
    if (!media) return null;

    const ext = getMediaExtension(media.mimetype);
    const filename = `${message.id.id}${ext}`;
    const filepath = join(MEDIA_DIR, filename);

    if (existsSync(filepath)) {
      return {
        url: `/media/${filename}`,
        mimetype: media.mimetype,
        type: getMediaType(media.mimetype),
        filename: media.filename || filename,
        filesize: media.filesize
      };
    }

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
