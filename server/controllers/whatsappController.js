import {
  clients,
  wsConnections,
  isDetachedFrameError,
  reinitializeClient,
  loadData,
  saveMessage,
  saveChat,
  downloadAvatar,
  downloadMedia,
  broadcastToSession,
  createWhatsAppClient
} from '../services/whatsappService.js';

export function setupWebSocket(wss) {
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
            let client = clients.get(sessionId);
            if (!client) {
              client = createWhatsAppClient(sessionId);
              await client.initialize();
            } else if (client.info) {
              try {
                await client.getState();
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
            const whatsappClient = clients.get(sessionId);
            if (whatsappClient) {
              const chatId = msg.to.includes('@') ? msg.to : `${msg.to}@c.us`;
              await whatsappClient.sendMessage(chatId, msg.body);

              const sentTs = msg.messageId || Date.now().toString();
              const contactIdClean = chatId.replace('@c.us', '');
              const sentMsgData = {
                id: msg.messageId || `${sentTs}_${contactIdClean}_sent`,
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
            let chatsClient = clients.get(sessionId);
            if (chatsClient) {
              const cachedChats = loadData(sessionId, 'chats');
              if (cachedChats.length > 0) {
                console.log(`[${sessionId}] Sending ${cachedChats.length} cached chats`);
                broadcastToSession(sessionId, { type: 'chats', chats: cachedChats, cached: true });
              }

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
                  if (!contactName) {
                    try {
                      const contact = await chat.getContact();
                      contactName = contact?.pushname || contact?.name || chat.id.user;
                    } catch {
                      contactName = chat.id.user;
                    }
                  }

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
                  saveChat(sessionId, chatData);
                } catch (err) {
                  console.log(`[${sessionId}] Skipping chat ${chat.id._serialized}:`, err.message);
                }

                if (chatList.length % BATCH_SIZE === 0) {
                  console.log(`[${sessionId}] Sending batch of ${chatList.length} chats...`);
                  broadcastToSession(sessionId, { type: 'chats', chats: [...chatList], cached: false });
                }
              }

              console.log(`[${sessionId}] Sending final chat list: ${chatList.length} chats`);
              broadcastToSession(sessionId, { type: 'chats', chats: chatList, cached: false });
            }
            break;

          case 'getMessages':
            console.log(`[${sessionId}] getMessages request for chatId: ${msg.chatId}`);
            const messagesClient = clients.get(sessionId);

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
                      media: media?.url || null,
                      attachments: media ? [media] : undefined
                    };
                    messageList.push(msgData);
                    saveMessage(sessionId, msg.chatId, msgData);
                  } catch (err) {
                    console.log(`[${sessionId}] Skipping message:`, err.message);
                  }
                }

                console.log(`[${sessionId}] Sending ${messageList.length} fresh messages to frontend`);
                broadcastToSession(sessionId, { type: 'messages', chatId: msg.chatId, messages: messageList, cached: false });
              } catch (err) {
                console.error(`[${sessionId}] Error fetching messages:`, err.message, err.stack);
                if (cachedMessages.length === 0) {
                  broadcastToSession(sessionId, { type: 'error', message: 'Could not fetch messages for this chat' });
                }
              }
            } else {
              console.log(`[${sessionId}] No WhatsApp client available for getMessages`);
            }
            break;

          case 'getCachedData':
            const cachedChatsData = loadData(sessionId, 'chats');
            const cachedMessagesData = loadData(sessionId, 'messages');

            if (cachedChatsData.length > 0) {
              broadcastToSession(sessionId, { type: 'chats', chats: cachedChatsData, cached: true });
            }

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
      const sessionWs = wsConnections.get(sessionId);
      if (sessionWs) {
        sessionWs.delete(ws);
        if (sessionWs.size === 0) {
          wsConnections.delete(sessionId);
        }
      }
    });
  });
}

export function getStatus(req, res) {
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
}

export function getSessions(req, res) {
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
}

// In controllers, getPort requires the server instance. We can just export a function that takes the server and returns the middleware
export function getPortHandler(server) {
  return (req, res) => {
    res.json({ port: server.address().port, service: 'whatsapp' });
  };
}
