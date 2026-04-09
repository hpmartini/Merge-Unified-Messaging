import { useState, useEffect, useCallback, useRef } from 'react';
import { Platform } from '../../types';

export interface SlackChat {
  id: string;
  name: string;
  isChannel?: boolean;
}

export interface SlackMessage {
  id: string;
  chatId: string;
  text: string;
  sender: 'me' | 'other';
  senderName: string;
  timestamp: string;
  platform: 'slack';
  threadId?: string;
}

interface UseSlackOptions {
  onChatsLoaded?: (chats: SlackChat[]) => void;
  onMessagesLoaded?: (chatId: string, messages: SlackMessage[]) => void;
}

export function useSlack(options: UseSlackOptions = {}, pollIntervalMs = 5000) {
  const [chats, setChats] = useState<SlackChat[]>([]);
  const [status, setStatus] = useState<'disconnected' | 'ready'>('disconnected');
  
  const optionsRef = useRef(options);
  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  const getChats = useCallback(async () => {
    try {
      const res = await fetch('/api/slack/chats');
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
      console.error('[Slack] Failed to fetch chats', e);
      setStatus('disconnected');
    }
  }, []);

  const getMessages = useCallback(async (chatId: string) => {
    try {
      const res = await fetch(`/api/slack/chats/${chatId}/messages`);
      if (res.ok) {
        const data = await res.json();
        const msgs = Array.isArray(data) ? data : data.messages || [];
        if (optionsRef.current.onMessagesLoaded) {
          optionsRef.current.onMessagesLoaded(chatId, msgs);
        }
      }
    } catch (e) {
      console.error(`[Slack] Failed to fetch messages for ${chatId}`, e);
    }
  }, []);

  const sendMessage = useCallback(async (chatId: string, text: string, threadId?: string) => {
    try {
      const res = await fetch('/api/slack/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: chatId, content: text, threadId })
      });
      if (res.ok) {
        getMessages(chatId);
      }
    } catch (e) {
      console.error('[Slack] Failed to send message', e);
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
