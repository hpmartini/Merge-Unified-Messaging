import { useState, useEffect, useCallback, useRef } from 'react';

export interface SignalUser {
  id: string;
  name: string;
  phone: string;
}

export interface SignalChat {
  id: string;
  name: string;
  isGroup: boolean;
  unreadCount: number;
  lastMessage?: string;
  timestamp?: number;
  avatarUrl?: string;
}

export interface SignalMedia {
  url: string;
  mimetype: string;
  type: 'image' | 'video' | 'audio' | 'document';
  filename: string;
  filesize?: number;
}

export interface SignalMessage {
  id: string;
  chatId: string;
  body: string;
  fromMe: boolean;
  timestamp: number;
  contactName: string;
  contactId: string;
  hasMedia: boolean;
  type: string;
  media?: SignalMedia | null;
}

export type SignalStatus =
  | 'disconnected'
  | 'connecting'
  | 'need_setup'
  | 'linking'
  | 'verification_needed'
  | 'ready'
  | 'error';

interface UseSignalOptions {
  onMessage?: (message: SignalMessage) => void;
  onChatsLoaded?: (chats: SignalChat[]) => void;
  onMessagesLoaded?: (chatId: string, messages: SignalMessage[]) => void;
  onReady?: (user: SignalUser) => void;
  onLinkUri?: (uri: string) => void;
}

interface UseSignalReturn {
  status: SignalStatus;
  linkUri: string | null;
  user: SignalUser | null;
  chats: SignalChat[];
  messages: Map<string, SignalMessage[]>;
  error: string | null;
  serverPort: number | null;
  connect: (phoneNumber?: string) => void;
  disconnect: () => void;
  sendMessage: (to: string, body: string) => void;
  getChats: () => void;
  getMessages: (chatId: string, limit?: number) => void;
  getCachedData: () => void;
  startLink: () => void;
  register: (phoneNumber: string) => void;
  verify: (phoneNumber: string, code: string) => void;
}

// Port discovery for Signal server
async function discoverSignalPort(): Promise<number | null> {
  const portsToTry = [3043, 3044, 3045, 3046, 3047, 3048, 3049, 3050];

  for (const port of portsToTry) {
    try {
      const response = await fetch(`http://localhost:${port}/api/port`, {
        method: 'GET',
        signal: AbortSignal.timeout(500)
      });
      if (response.ok) {
        const data = await response.json();
        if (data.port && data.service === 'signal') {
          console.log(`[Signal] Discovered server on port ${data.port}`);
          return data.port;
        }
      }
    } catch {
      // Port not available, try next
    }
  }
  return null;
}

export function useSignal(sessionId: string = 'default', options: UseSignalOptions = {}): UseSignalReturn {
  const [status, setStatus] = useState<SignalStatus>('disconnected');
  const [linkUri, setLinkUri] = useState<string | null>(null);
  const [user, setUser] = useState<SignalUser | null>(null);
  const [chats, setChats] = useState<SignalChat[]>([]);
  const [messages, setMessages] = useState<Map<string, SignalMessage[]>>(new Map());
  const [error, setError] = useState<string | null>(null);
  const [serverPort, setServerPort] = useState<number | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const optionsRef = useRef(options);
  const hasCachedDataRef = useRef(false);

  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  const connect = useCallback(async (phoneNumber?: string) => {
    console.log('[Signal] connect() called');
    if (wsRef.current?.readyState === WebSocket.OPEN || wsRef.current?.readyState === WebSocket.CONNECTING) {
      console.log('[Signal] Already connected or connecting');
      return;
    }

    // Close any existing connection
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    setStatus('connecting');
    setError(null);
    setLinkUri(null);

    try {
      const port = await discoverSignalPort();
      if (!port) {
        setStatus('error');
        setError('Signal server not found. Make sure it is running.');
        return;
      }

      setServerPort(port);
      const ws = new WebSocket(`ws://localhost:${port}?sessionId=${sessionId}`);

      ws.onopen = () => {
        console.log('[Signal] WebSocket connected');
        ws.send(JSON.stringify({ type: 'getCachedData' }));

        if (phoneNumber) {
          ws.send(JSON.stringify({ type: 'connect', phoneNumber }));
        } else {
          ws.send(JSON.stringify({ type: 'init' }));
        }
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('[Signal] Received:', data.type);

          switch (data.type) {
            case 'need_setup':
              setStatus('need_setup');
              break;

            case 'link_uri':
              setStatus('linking');
              setLinkUri(data.uri);
              if (optionsRef.current.onLinkUri) {
                optionsRef.current.onLinkUri(data.uri);
              }
              break;

            case 'verification_needed':
              setStatus('verification_needed');
              break;

            case 'ready':
              setStatus('ready');
              setUser(data.user);
              setLinkUri(null);
              if (optionsRef.current.onReady) {
                optionsRef.current.onReady(data.user);
              }
              ws.send(JSON.stringify({ type: 'getChats' }));
              break;

            case 'disconnected':
              // Don't override ready status if we have cached data loaded
              if (hasCachedDataRef.current) {
                console.log('[Signal] Ignoring disconnected — cached data is loaded');
              } else {
                setStatus('disconnected');
                setUser(null);
              }
              break;

            case 'not_registered':
              setStatus('need_setup');
              setError(data.message);
              break;

            case 'error':
              setError(data.message);
              break;

            case 'chats':
              if (data.chats && data.chats.length > 0) {
                hasCachedDataRef.current = true;
              }
              setChats(prev => {
                if (data.cached && prev.length > 0) {
                  return prev;
                }
                return data.chats;
              });
              if (optionsRef.current.onChatsLoaded) {
                optionsRef.current.onChatsLoaded(data.chats);
              }
              break;

            case 'cachedDataLoaded':
              console.log('[Signal] Cached data loaded, hasCachedData:', hasCachedDataRef.current);
              break;

            case 'messages':
              setMessages(prev => {
                const newMap = new Map(prev);
                const existing = newMap.get(data.chatId) || [];

                if (data.cached && existing.length > 0) {
                  return prev;
                }

                const existingIds = new Set(existing.map(m => m.id));
                const newMessages = data.messages.filter((m: SignalMessage) => !existingIds.has(m.id));
                newMap.set(data.chatId, [...existing, ...newMessages]);
                return newMap;
              });
              if (optionsRef.current.onMessagesLoaded) {
                optionsRef.current.onMessagesLoaded(data.chatId, data.messages);
              }
              break;

            case 'message':
              const msg: SignalMessage = {
                id: data.message.id,
                chatId: data.message.from,
                body: data.message.body,
                fromMe: data.message.fromMe,
                timestamp: data.message.timestamp,
                contactName: data.message.contactName,
                contactId: data.message.from,
                hasMedia: data.message.hasMedia,
                type: data.message.type,
                media: data.message.media
              };

              setMessages(prev => {
                const newMap = new Map(prev);
                const chatMessages = newMap.get(msg.chatId) || [];
                newMap.set(msg.chatId, [...chatMessages, msg]);
                return newMap;
              });

              if (optionsRef.current.onMessage) {
                optionsRef.current.onMessage(msg);
              }
              break;
          }
        } catch (e) {
          console.error('[Signal] Failed to parse message:', e);
        }
      };

      ws.onerror = (event) => {
        console.error('[Signal] WebSocket error:', event);
        setStatus('error');
        setError('Connection error - is the Signal server running?');
      };

      ws.onclose = () => {
        console.log('[Signal] WebSocket closed, hasCachedData:', hasCachedDataRef.current);
        if (!hasCachedDataRef.current) {
          setStatus('disconnected');
        }
      };

      wsRef.current = ws;
    } catch (e) {
      setStatus('error');
      setError('Failed to connect to Signal server');
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
    setLinkUri(null);
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
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'getMessages', chatId, limit }));
    }
  }, []);

  const getCachedData = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'getCachedData' }));
    }
  }, []);

  const startLink = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      setStatus('linking');
      wsRef.current.send(JSON.stringify({ type: 'link' }));
    }
  }, []);

  const register = useCallback((phoneNumber: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'register', phoneNumber }));
    }
  }, []);

  const verify = useCallback((phoneNumber: string, code: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'verify', phoneNumber, code }));
    }
  }, []);

  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  return {
    status,
    linkUri,
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
    getCachedData,
    startLink,
    register,
    verify
  };
}
