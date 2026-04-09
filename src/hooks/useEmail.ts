import { useState, useEffect, useCallback, useRef } from 'react';
import { Platform } from '../../types';

export interface EmailChat {
  id: string;
  title: string;
  email: string;
}

export interface EmailMessage {
  id: string;
  chatId: string;
  text: string;
  subject?: string;
  sender: 'me' | 'other';
  senderName: string;
  timestamp: string;
  platform: 'email';
}

interface UseEmailOptions {
  onChatsLoaded?: (chats: EmailChat[]) => void;
  onMessagesLoaded?: (chatId: string, messages: EmailMessage[]) => void;
}

export function useEmail(options: UseEmailOptions = {}, pollIntervalMs = 5000) {
  const [chats, setChats] = useState<EmailChat[]>([]);
  const [status, setStatus] = useState<'disconnected' | 'ready'>('disconnected');
  
  const optionsRef = useRef(options);
  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  const getChats = useCallback(async () => {
    try {
      const res = await fetch('/api/email/chats');
      if (res.ok) {
        const data = await res.json();
        const loadedChats = Array.isArray(data) ? data : data.chats || [];
        setChats(loadedChats);
        setStatus('ready');
        if (optionsRef.current.onChatsLoaded) {
          optionsRef.current.onChatsLoaded(loadedChats);
        }
      }
    } catch (e) {
      console.error('[Email] Failed to fetch chats', e);
      setStatus('disconnected');
    }
  }, []);

  const getMessages = useCallback(async (chatId: string) => {
    try {
      const res = await fetch(`/api/email/chats/${chatId}/messages`);
      if (res.ok) {
        const data = await res.json();
        const msgs = Array.isArray(data) ? data : data.messages || [];
        if (optionsRef.current.onMessagesLoaded) {
          optionsRef.current.onMessagesLoaded(chatId, msgs);
        }
      }
    } catch (e) {
      console.error(`[Email] Failed to fetch messages for ${chatId}`, e);
    }
  }, []);

  const sendMessage = useCallback(async (chatId: string, text: string, subject?: string) => {
    try {
      const res = await fetch('/api/email/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: chatId, content: text, subject })
      });
      if (res.ok) {
        getMessages(chatId);
      }
    } catch (e) {
      console.error('[Email] Failed to send message', e);
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
