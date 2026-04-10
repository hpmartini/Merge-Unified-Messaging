import { 
  signalProcesses, wsConnections, cachedReadySessions, recentlySentTimestamps,
  getLinkedAccount, loadData, saveData, saveMessage, saveChat, broadcastToSession,
  createSignalProcess, registerAccount, verifyAccount, linkDevice, sendJsonRpc
} from '../services/signalService.js';

export async function handleWebSocketMessage(sessionId, ws, data) {
  try {
    const msg = JSON.parse(data.toString());
    switch (msg.type) {
      case 'init':
        const existingProc = signalProcesses.get(sessionId);
        if (existingProc) {
          broadcastToSession(sessionId, { type: 'ready', user: { id: existingProc.phoneNumber, name: existingProc.phoneNumber, phone: existingProc.phoneNumber } });
        } else {
          const linkedPhone = getLinkedAccount(sessionId);
          if (linkedPhone) {
            cachedReadySessions.add(sessionId);
            broadcastToSession(sessionId, { type: 'ready', user: { id: linkedPhone, name: linkedPhone, phone: linkedPhone } });
            try {
              await createSignalProcess(sessionId, linkedPhone);
              cachedReadySessions.delete(sessionId);
            } catch (err) {}
          } else {
            broadcastToSession(sessionId, { type: 'need_setup', message: 'Signal account not connected. Use link or register.' });
          }
        }
        break;
      case 'link':
        try {
          const result = await linkDevice(sessionId);
          if (result.success) {
            const phoneNumber = result.phoneNumber;
            await createSignalProcess(sessionId, phoneNumber);
            broadcastToSession(sessionId, { type: 'ready', user: { id: phoneNumber, name: phoneNumber, phone: phoneNumber } });
          }
        } catch (err) {
          broadcastToSession(sessionId, { type: 'error', message: err.message });
        }
        break;
      case 'register':
        try {
          await registerAccount(sessionId, msg.phoneNumber);
          broadcastToSession(sessionId, { type: 'verification_needed', message: 'Check your phone for the verification code' });
        } catch (err) {
          broadcastToSession(sessionId, { type: 'error', message: err.message });
        }
        break;
      case 'verify':
        try {
          await verifyAccount(sessionId, msg.phoneNumber, msg.code);
          await createSignalProcess(sessionId, msg.phoneNumber);
          broadcastToSession(sessionId, { type: 'ready', user: { id: msg.phoneNumber, name: msg.phoneNumber, phone: msg.phoneNumber } });
        } catch (err) {
          broadcastToSession(sessionId, { type: 'error', message: err.message });
        }
        break;
      case 'connect':
        try {
          await createSignalProcess(sessionId, msg.phoneNumber);
          broadcastToSession(sessionId, { type: 'ready', user: { id: msg.phoneNumber, name: msg.phoneNumber, phone: msg.phoneNumber } });
        } catch (err) {
          broadcastToSession(sessionId, { type: 'error', message: err.message });
        }
        break;
      case 'send':
        const procData = signalProcesses.get(sessionId);
        if (procData) {
          try {
            await sendJsonRpc(procData.process, 'send', { recipient: [msg.to], message: msg.body });
            const sentKey = `${sessionId}:${msg.to}:${msg.body}`;
            recentlySentTimestamps.set(sentKey, Date.now());
            setTimeout(() => recentlySentTimestamps.delete(sentKey), 30000);

            const sentTs = msg.messageId || Date.now().toString();
            const sentMessage = {
              id: msg.messageId || `${sentTs}_${msg.to}_sent`,
              from: msg.to, to: msg.to, body: msg.body,
              timestamp: Math.floor(parseInt(sentTs) / 1000),
              fromMe: true, contactName: 'Me', chatName: msg.to,
              hasMedia: false, type: 'text', media: null
            };
            saveMessage(sessionId, msg.to, sentMessage);

            const chats = loadData(sessionId, 'chats');
            const chatIdx = chats.findIndex(c => c.id === msg.to);
            if (chatIdx !== -1) {
              chats[chatIdx].lastMessage = msg.body;
              chats[chatIdx].timestamp = sentMessage.timestamp;
              saveData(sessionId, 'chats', chats);
            }
            broadcastToSession(sessionId, { type: 'message', message: sentMessage });
            broadcastToSession(sessionId, { type: 'sent', messageId: msg.messageId });
          } catch (err) {
            broadcastToSession(sessionId, { type: 'error', message: err.message });
          }
        } else {
          broadcastToSession(sessionId, { type: 'error', message: 'Signal process not running. Cannot send messages.' });
        }
        break;
      case 'getChats':
        const chatsProcData = signalProcesses.get(sessionId);
        const resolveContactName = (c) => c.name?.trim() || c.profileName?.trim() || [c.givenName, c.familyName].filter(Boolean).join(' ').trim() || c.number || (c.uuid ? `Unknown (${c.uuid.slice(0, 8)}...)` : 'Unknown');
        const resolveGroupName = (g) => g.name?.trim() || g.title?.trim() || (g.members?.length || g.memberCount ? `Group (${g.members?.length || g.memberCount} members)` : (g.id ? `Group ${g.id.slice(0, 8)}...` : 'Unnamed Group'));

        const cachedChats = loadData(sessionId, 'chats');
        if (cachedChats.length > 0) broadcastToSession(sessionId, { type: 'chats', chats: cachedChats, cached: true });

        if (chatsProcData) {
          try {
            const contacts = await sendJsonRpc(chatsProcData.process, 'listContacts');
            const contactList = (contacts || []).map(c => ({ id: c.number || c.uuid, name: resolveContactName(c), isGroup: false, unreadCount: 0, avatarUrl: null, lastMessage: null, timestamp: null }));
            let groupList = [];
            try {
              const groups = await sendJsonRpc(chatsProcData.process, 'listGroups');
              groupList = (groups || []).map(g => ({ id: g.id, name: resolveGroupName(g), isGroup: true, unreadCount: 0, avatarUrl: null, lastMessage: null, timestamp: null, memberCount: g.members?.length || g.memberCount || 0 }));
            } catch (err) {}

            let chatList = [...contactList, ...groupList];
            const allCachedMessages = loadData(sessionId, 'messages');
            chatList = chatList.map(chat => {
              const messages = allCachedMessages[chat.id] || [];
              if (messages.length > 0) {
                const lastMsg = messages.sort((a, b) => b.timestamp - a.timestamp)[0];
                return { ...chat, lastMessage: lastMsg?.body || (lastMsg?.hasMedia ? '[Media]' : null), timestamp: lastMsg?.timestamp || null };
              }
              return chat;
            });
            chatList.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
            chatList.forEach(c => saveChat(sessionId, c));
            broadcastToSession(sessionId, { type: 'chats', chats: chatList, cached: false });
          } catch (err) {}
        }
        break;
      case 'getMessages':
        const chatMessages = loadData(sessionId, 'messages')[msg.chatId] || [];
        broadcastToSession(sessionId, { type: 'messages', chatId: msg.chatId, messages: chatMessages, cached: false });
        break;
      case 'getCachedData':
        const allCachedChats = loadData(sessionId, 'chats');
        const allCachedMessages = loadData(sessionId, 'messages');
        if (allCachedChats.length > 0) broadcastToSession(sessionId, { type: 'chats', chats: allCachedChats, cached: true });
        for (const chatId of Object.keys(allCachedMessages)) {
          if (allCachedMessages[chatId].length > 0) {
            broadcastToSession(sessionId, { type: 'messages', chatId, messages: allCachedMessages[chatId], cached: true });
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
    broadcastToSession(sessionId, { type: 'error', message: error.message });
  }
}

export function setupWebSocketConnection(ws, req) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const sessionId = url.searchParams.get('sessionId') || 'default';

  if (!wsConnections.has(sessionId)) wsConnections.set(sessionId, new Set());
  wsConnections.get(sessionId).add(ws);

  ws.on('message', async (data) => {
    await handleWebSocketMessage(sessionId, ws, data);
  });

  ws.on('close', () => {
    const clients = wsConnections.get(sessionId);
    if (clients) {
      clients.delete(ws);
      if (clients.size === 0) wsConnections.delete(sessionId);
    }
  });
}
