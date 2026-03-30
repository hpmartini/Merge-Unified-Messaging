import { useState, useEffect, useCallback, useRef } from 'react';

export interface WhatsAppUser {
  id: string;
  name: string;
  phone: string;
}

export interface WhatsAppChat {
  id: string;
  name: string;
  isGroup: boolean;
  unreadCount: number;
  lastMessage?: string;
  timestamp?: number;
  avatarUrl?: string;
}

export interface WhatsAppMedia {
  url: string;
  mimetype: string;
  type: 'image' | 'video' | 'audio' | 'document';
  filename: string;
  filesize?: number;
}

export interface WhatsAppMessage {
  id: string;
  chatId: string;
  body: string;
  fromMe: boolean;
  timestamp: number;
  contactName: string;
  contactId: string;
  hasMedia: boolean;
  type: string;
  media?: WhatsAppMedia | null;
}

export type WhatsAppStatus = 'disconnected' | 'connecting' | 'qr' | 'authenticated' | 'ready' | 'error';

interface UseWhatsAppOptions {
  onMessage?: (message: WhatsAppMessage) => void;
  onChatsLoaded?: (chats: WhatsAppChat[]) => void;
  onMessagesLoaded?: (chatId: string, messages: WhatsAppMessage[]) => void;
  onReady?: (user: WhatsAppUser) => void;
}

interface UseWhatsAppReturn {
  status: WhatsAppStatus;
  qrCode: string | null;
  user: WhatsAppUser | null;
  chats: WhatsAppChat[];
  messages: Map<string, WhatsAppMessage[]>;
  error: string | null;
  serverPort: number | null;
  connect: () => void;
  disconnect: () => void;
  sendMessage: (to: string, body: string) => void;
  getChats: () => void;
  getMessages: (chatId: string, limit?: number) => void;
  getCachedData: () => void;
}

// Port discovery: try to read from the port file via API, fallback to scanning common ports
async function discoverWhatsAppPort(): Promise<number | null> {
  // Try common ports in order
  const portsToTry = [3042, 3043, 3044, 3045, 3046, 3047, 3048, 3049, 3050];

  for (const port of portsToTry) {
    try {
      const response = await fetch(`http://localhost:${port}/api/port`, {
        method: 'GET',
        signal: AbortSignal.timeout(500)
      });
      if (response.ok) {
        const data = await response.json();
        if (data.port && data.service === 'whatsapp') {
          console.log(`[WhatsApp] Discovered server on port ${data.port}`);
          return data.port;
        }
      }
    } catch {
      // Port not available, try next
    }
  }
  return null;
}

export function useWhatsApp(sessionId: string = 'default', options: UseWhatsAppOptions = {}): UseWhatsAppReturn {
  const [status, setStatus] = useState<WhatsAppStatus>('disconnected');
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [user, setUser] = useState<WhatsAppUser | null>(null);
  const [chats, setChats] = useState<WhatsAppChat[]>([]);
  const [messages, setMessages] = useState<Map<string, WhatsAppMessage[]>>(new Map());
  const [error, setError] = useState<string | null>(null);
  const [serverPort, setServerPort] = useState<number | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const optionsRef = useRef(options);
  const mountedRef = useRef(true);

  // Keep options ref updated
  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  const connect = useCallback(async () => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    setStatus('connecting');
    setError(null);
    setQrCode(null);

    try {
      // Discover the server port dynamically
      const port = await discoverWhatsAppPort();
      if (!port) {
        setStatus('error');
        setError('WhatsApp server not found. Make sure it is running.');
        return;
      }

      setServerPort(port);
      const ws = new WebSocket(`ws://localhost:${port}?sessionId=${sessionId}`);

      ws.onopen = () => {
        console.log('[WhatsApp] WebSocket connected');
        // First request cached data for instant display
        ws.send(JSON.stringify({ type: 'getCachedData' }));
        // Then initialize WhatsApp client
        ws.send(JSON.stringify({ type: 'init' }));
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('[WhatsApp] Received:', data.type);

          switch (data.type) {
            case 'qr':
              setStatus('qr');
              setQrCode(data.qr);
              break;

            case 'authenticated':
              setStatus('authenticated');
              setQrCode(null);
              break;

            case 'ready':
              setStatus('ready');
              setUser(data.user);
              setQrCode(null);
              if (optionsRef.current.onReady) {
                optionsRef.current.onReady(data.user);
              }
              // Auto-fetch chats when ready
              ws.send(JSON.stringify({ type: 'getChats' }));
              break;

            case 'disconnected':
              setStatus('disconnected');
              setUser(null);
              setQrCode(null);
              break;

            case 'auth_failure':
              setStatus('error');
              setError(data.message || 'Authentication failed');
              break;

            case 'error':
              setError(data.message);
              break;

            case 'chats':
              // Merge with existing chats (cached vs fresh)
              setChats(prev => {
                if (data.cached && prev.length > 0) {
                  // Don't replace fresh data with cached
                  return prev;
                }
                return data.chats;
              });
              if (optionsRef.current.onChatsLoaded) {
                optionsRef.current.onChatsLoaded(data.chats);
              }
              break;

            case 'cachedDataLoaded':
              console.log('[WhatsApp] Cached data loaded');
              break;

            case 'messages':
              setMessages(prev => {
                const newMap = new Map(prev);
                const existing = newMap.get(data.chatId) || [];
                const existingIds = new Set(existing.map(m => m.id));
                const newMessages = data.messages.filter((m: WhatsAppMessage) => !existingIds.has(m.id));
                if (newMessages.length === 0) return prev;
                newMap.set(data.chatId, [...existing, ...newMessages]);
                return newMap;
              });
              if (optionsRef.current.onMessagesLoaded) {
                console.log('[WhatsApp] Calling onMessagesLoaded callback');
                optionsRef.current.onMessagesLoaded(data.chatId, data.messages);
              } else {
                console.log('[WhatsApp] No onMessagesLoaded callback!');
              }
              break;

            case 'message':
              // New incoming message
              const msg: WhatsAppMessage = {
                id: data.message.id,
                chatId: data.message.from,
                body: data.message.body,
                fromMe: data.message.fromMe,
                timestamp: data.message.timestamp,
                contactName: data.message.contactName,
                contactId: data.message.from.replace('@c.us', ''),
                hasMedia: data.message.hasMedia,
                type: data.message.type,
                media: data.message.media
              };

              // Add to messages state (with deduplication)
              setMessages(prev => {
                const newMap = new Map(prev);
                const chatMessages = newMap.get(msg.chatId) || [];
                // Deduplicate by message ID
                if (chatMessages.some(m => m.id === msg.id)) return prev;
                newMap.set(msg.chatId, [...chatMessages, msg]);
                return newMap;
              });

              if (optionsRef.current.onMessage) {
                optionsRef.current.onMessage(msg);
              }
              break;
          }
        } catch (e) {
          console.error('[WhatsApp] Failed to parse message:', e);
        }
      };

      ws.onerror = (event) => {
        console.error('[WhatsApp] WebSocket error:', event);
        setStatus('error');
        setError('Connection error - is the WhatsApp server running?');
      };

      ws.onclose = (event) => {
        console.log('[WhatsApp] WebSocket closed, code:', event.code);
        setStatus('disconnected');
        // Auto-reconnect if connection was lost unexpectedly
        if (mountedRef.current && event.code !== 1000) {
          console.log('[WhatsApp] Unexpected close, auto-reconnecting in 2s...');
          reconnectTimeoutRef.current = setTimeout(() => {
            if (mountedRef.current && (!wsRef.current || wsRef.current.readyState === WebSocket.CLOSED)) {
              console.log('[WhatsApp] Auto-reconnecting...');
              connect();
            }
          }, 2000);
        }
      };

      wsRef.current = ws;
    } catch (e) {
      setStatus('error');
      setError('Failed to connect to WhatsApp server');
    }
  }, [sessionId]);

  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.send(JSON.stringify({ type: 'logout' }));
      wsRef.current.close();
      wsRef.current = null;
    }
    setStatus('disconnected');
    setUser(null);
    setQrCode(null);
    setChats([]);
    setMessages(new Map());
  }, []);

  const sendMessage = useCallback((to: string, body: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'send',
        to,
        body,
        messageId: Date.now().toString()
      }));
    }
  }, []);

  const getChats = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'getChats' }));
    }
  }, []);

  const getMessages = useCallback((chatId: string, limit: number = 50) => {
    console.log('[WhatsApp] getMessages called - chatId:', chatId, 'wsReady:', wsRef.current?.readyState === WebSocket.OPEN);
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'getMessages', chatId, limit }));
    } else {
      console.log('[WhatsApp] getMessages - WebSocket not ready!');
    }
  }, []);

  const getCachedData = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'getCachedData' }));
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  return {
    status,
    qrCode,
    user,
    chats,
    messages,
    error,
    serverPort,
    connect,
    disconnect,
    sendMessage,
    getChats,
    getMessages,
    getCachedData
  };
}
