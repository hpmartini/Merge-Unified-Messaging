import { useState, useEffect, useCallback, useRef } from 'react';

export interface TelegramChat {
  id: string | number;
  title: string;
  type: string;
}

export interface TelegramMessage {
  id: string | number;
  chatId: string | number;
  text: string;
  sender: 'me' | 'other';
  senderName: string;
  timestamp: string;
  platform: 'telegram';
  status?: string;
  attachments?: any[];
}

interface UseTelegramOptions {
  onChatsLoaded?: (chats: TelegramChat[]) => void;
  onMessagesLoaded?: (chatId: string, messages: TelegramMessage[]) => void;
  onTyping?: (chatId: string, isTyping: boolean) => void;
}

export function useTelegram(options: UseTelegramOptions = {}, pollIntervalMs = 5000) {
  const [chats, setChats] = useState<TelegramChat[]>([]);
  const [status, setStatus] = useState<'disconnected' | 'ready'>('disconnected');
  
  const optionsRef = useRef(options);
  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  const getChats = useCallback(async () => {
    try {
      const res = await fetch('/api/telegram/chats');
      if (res.ok) {
        const data = await res.json();
        setChats(data.chats);
        setStatus('ready');
        if (optionsRef.current.onChatsLoaded) {
          optionsRef.current.onChatsLoaded(data.chats);
        }
      }
    } catch (e) {
      console.error('[Telegram] Failed to fetch chats', e);
      setStatus('disconnected');
    }
  }, []);

  const getMessages = useCallback(async (chatId: string) => {
    try {
      const res = await fetch(`/api/telegram/chats/${chatId}/messages`);
      if (res.ok) {
        const data = await res.json();
        if (optionsRef.current.onMessagesLoaded) {
          optionsRef.current.onMessagesLoaded(chatId, data.messages);
        }
      }
    } catch (e) {
      console.error(`[Telegram] Failed to fetch messages for ${chatId}`, e);
    }
  }, []);

  const sendMessage = useCallback(async (chatId: string | number, text: string) => {
    try {
      const res = await fetch('/api/telegram/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId, text })
      });
      if (res.ok) {
        getMessages(chatId.toString());
      }
    } catch (e) {
      console.error('[Telegram] Failed to send message', e);
    }
  }, [getMessages]);

  useEffect(() => {
    getChats();
    const interval = setInterval(() => {
      getChats();
    }, pollIntervalMs);
    return () => clearInterval(interval);
  }, [getChats, pollIntervalMs]);

  return { chats, status, getChats, getMessages, sendMessage };
}