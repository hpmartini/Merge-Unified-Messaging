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
}

export interface WhatsAppMessage {
  id: string;
  body: string;
  fromMe: boolean;
  timestamp: number;
  contactName: string;
  hasMedia: boolean;
  type: string;
}

export type WhatsAppStatus = 'disconnected' | 'connecting' | 'qr' | 'authenticated' | 'ready' | 'error';

interface UseWhatsAppReturn {
  status: WhatsAppStatus;
  qrCode: string | null;
  user: WhatsAppUser | null;
  chats: WhatsAppChat[];
  error: string | null;
  connect: () => void;
  disconnect: () => void;
  sendMessage: (to: string, body: string) => void;
  getChats: () => void;
  getMessages: (chatId: string, limit?: number) => void;
}

const WHATSAPP_SERVER_URL = 'ws://localhost:3002';

export function useWhatsApp(sessionId: string = 'default'): UseWhatsAppReturn {
  const [status, setStatus] = useState<WhatsAppStatus>('disconnected');
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [user, setUser] = useState<WhatsAppUser | null>(null);
  const [chats, setChats] = useState<WhatsAppChat[]>([]);
  const [error, setError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    setStatus('connecting');
    setError(null);
    setQrCode(null);

    try {
      const ws = new WebSocket(`${WHATSAPP_SERVER_URL}?sessionId=${sessionId}`);

      ws.onopen = () => {
        console.log('[WhatsApp] WebSocket connected');
        // Request initialization
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
              setChats(data.chats);
              break;

            case 'message':
              // Handle incoming message - could emit an event or update state
              console.log('[WhatsApp] New message:', data.message);
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

      ws.onclose = () => {
        console.log('[WhatsApp] WebSocket closed');
        if (status !== 'disconnected') {
          setStatus('disconnected');
        }
      };

      wsRef.current = ws;
    } catch (e) {
      setStatus('error');
      setError('Failed to connect to WhatsApp server');
    }
  }, [sessionId, status]);

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

  // Cleanup on unmount
  useEffect(() => {
    return () => {
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
    error,
    connect,
    disconnect,
    sendMessage,
    getChats,
    getMessages
  };
}
