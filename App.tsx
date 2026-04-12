import React, { useEffect, useRef, useCallback } from 'react';
import { useAppStore } from './src/store/useAppStore';
import { MainLayout } from './src/layouts/MainLayout';
import { Platform } from './types';
import { useWhatsApp, WhatsAppChat, WhatsAppMessage } from './hooks/useWhatsApp';
import { useSignal, SignalChat, SignalMessage } from './hooks/useSignal';
import { useTelegram, TelegramChat, TelegramMessage } from './hooks/useTelegram';
import { useEmail, EmailChat, EmailMessage } from './src/hooks/useEmail';
import { useSlack, SlackChat, SlackMessage } from './src/hooks/useSlack';

import { 
  normalizeTelegramChat, normalizeTelegramMessage,
  normalizeEmailChat, normalizeEmailMessage,
  normalizeSlackChat, normalizeSlackMessage,
  normalizeWhatsAppChat, normalizeWhatsAppMessage,
  normalizeSignalChat, normalizeSignalMessage
} from './src/utils/adapters';
import { useUnifiedChatState } from './src/hooks/useUnifiedChatState';

const App: React.FC = () => {
  const { mergeUsers, mergeMessages } = useUnifiedChatState();

  const serverPortRef = useRef<number | null>(null);
  const signalServerPortRef = useRef<number | null>(null);
  const typingTimeoutsRef = useRef<Record<string, NodeJS.Timeout>>({});

  useEffect(() => {
    return () => {
      Object.values(typingTimeoutsRef.current).forEach(timeout => clearTimeout(timeout));
    };
  }, []);

  const { users, selectedUser, setSelectedUser, theme, setTypingUser } = useAppStore();

  const handleTyping = useCallback((chatId: string, isTyping: boolean) => {
    setTypingUser(chatId, isTyping);
    if (typingTimeoutsRef.current[chatId]) {
      clearTimeout(typingTimeoutsRef.current[chatId]);
    }
    if (isTyping) {
      typingTimeoutsRef.current[chatId] = setTimeout(() => {
        setTypingUser(chatId, false);
      }, 5000); // 5 second timeout
    }
  }, [setTypingUser]);

  const telegram = useTelegram({
    onTyping: handleTyping,
    onChatsLoaded: useCallback((chats: TelegramChat[]) => {
      mergeUsers(chats.map(normalizeTelegramChat), Platform.Telegram);
    }, [mergeUsers]),
    onMessagesLoaded: useCallback((chatId: string, tgMessages: TelegramMessage[]) => {
      mergeMessages(tgMessages.map(normalizeTelegramMessage));
    }, [mergeMessages])
  });

  const email = useEmail({
    onChatsLoaded: useCallback((chats: EmailChat[]) => {
      mergeUsers(chats.map(normalizeEmailChat), Platform.Email);
    }, [mergeUsers]),
    onMessagesLoaded: useCallback((chatId: string, emailMsgs: EmailMessage[]) => {
      mergeMessages(emailMsgs.map(normalizeEmailMessage));
    }, [mergeMessages])
  });

  const slack = useSlack({
    onChatsLoaded: useCallback((chats: SlackChat[]) => {
      mergeUsers(chats.map(normalizeSlackChat), Platform.Slack);
    }, [mergeUsers]),
    onMessagesLoaded: useCallback((chatId: string, slackMsgs: SlackMessage[]) => {
      mergeMessages(slackMsgs.map(normalizeSlackMessage));
    }, [mergeMessages])
  });

  const whatsapp = useWhatsApp('merge-app', {
    onTyping: handleTyping,
    onMessage: useCallback((waMsg: WhatsAppMessage) => {
      const chatId = waMsg.contactId || waMsg.id.split('_')[0];
      mergeMessages([normalizeWhatsAppMessage(waMsg, chatId, serverPortRef.current)]);
    }, [mergeMessages]),
    onChatsLoaded: useCallback((chats: WhatsAppChat[]) => {
      mergeUsers(chats.map(chat => normalizeWhatsAppChat(chat, serverPortRef.current)), Platform.WhatsApp);
    }, [mergeUsers]),
    onMessagesLoaded: useCallback((chatId: string, waMessages: WhatsAppMessage[]) => {
      mergeMessages(waMessages.map(msg => normalizeWhatsAppMessage(msg, chatId, serverPortRef.current)));
    }, [mergeMessages]),
  });

  if (whatsapp.serverPort) serverPortRef.current = whatsapp.serverPort;
  useEffect(() => {
    if (whatsapp.serverPort) serverPortRef.current = whatsapp.serverPort;
  }, [whatsapp.serverPort]);

  const signal = useSignal('merge-app', {
    onTyping: handleTyping,
    onMessage: useCallback((sigMsg: SignalMessage) => {
      const chatId = sigMsg.contactId || sigMsg.id; 
      mergeMessages([normalizeSignalMessage(sigMsg, chatId, signalServerPortRef.current)], true);
    }, [mergeMessages]),
    onChatsLoaded: useCallback((chats: SignalChat[]) => {
      mergeUsers(chats.map(chat => normalizeSignalChat(chat, signalServerPortRef.current)), Platform.Signal);
    }, [mergeUsers]),
    onMessagesLoaded: useCallback((chatId: string, sigMessages: SignalMessage[]) => {
      mergeMessages(sigMessages.map(msg => normalizeSignalMessage(msg, chatId, signalServerPortRef.current)), true);
    }, [mergeMessages]),
  });

  if (signal.serverPort) signalServerPortRef.current = signal.serverPort;
  useEffect(() => {
    if (signal.serverPort) signalServerPortRef.current = signal.serverPort;
  }, [signal.serverPort]);

  useEffect(() => {
    const timer = setTimeout(() => { whatsapp.connect(); }, 500);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => { signal.connect(); }, 1000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!selectedUser && users.length > 0) {
      setSelectedUser(users[0]);
    }
  }, [users, selectedUser, setSelectedUser]);

  useEffect(() => {
    if (!selectedUser) return;

    const loadPlatformMessages = (ids: string[], status: string, getMessages: any, isSignal = false, isWa = false) => {
      if (status === 'ready' || (isSignal && signal.chats.length > 0)) {
        for (const id of ids) {
          const chatId = isWa ? id.replace('wa-', '') + '@c.us' : id.replace(/^[a-z]+-/, '');
          if (isSignal || isWa) getMessages(chatId, 100);
          else getMessages(chatId);
        }
      }
    };

    loadPlatformMessages([...(selectedUser.id.startsWith('wa-') ? [selectedUser.id] : []), ...(selectedUser.alternateIds?.filter(id => id.startsWith('wa-')) || [])], whatsapp.status, whatsapp.getMessages, false, true);
    loadPlatformMessages([...(selectedUser.id.startsWith('tg-') ? [selectedUser.id] : []), ...(selectedUser.alternateIds?.filter(id => id.startsWith('tg-')) || [])], telegram.status, telegram.getMessages);
    loadPlatformMessages([...(selectedUser.id.startsWith('email-') ? [selectedUser.id] : []), ...(selectedUser.alternateIds?.filter(id => id.startsWith('email-')) || [])], email.status, email.getMessages);
    loadPlatformMessages([...(selectedUser.id.startsWith('slack-') ? [selectedUser.id] : []), ...(selectedUser.alternateIds?.filter(id => id.startsWith('slack-')) || [])], slack.status, slack.getMessages);
    loadPlatformMessages([...(selectedUser.id.startsWith('sig-') ? [selectedUser.id] : []), ...(selectedUser.alternateIds?.filter(id => id.startsWith('sig-')) || [])], signal.status, signal.getMessages, true);
  }, [selectedUser?.id, selectedUser?.alternateIds, whatsapp.status, signal.status, signal.chats.length, telegram.status, email.status, slack.status, whatsapp.getMessages, signal.getMessages, telegram.getMessages, email.getMessages, slack.getMessages]);

  const hasPreloadedWA = useRef(false);
  useEffect(() => {
    if (whatsapp.status === 'ready' && whatsapp.chats.length > 0 && !hasPreloadedWA.current) {
      hasPreloadedWA.current = true;
      for (const chat of whatsapp.chats.slice(0, 20)) { whatsapp.getMessages(chat.id, 50); }
    }
  }, [whatsapp.status, whatsapp.chats, whatsapp.getMessages]);

  const hasPreloadedSignal = useRef(false);
  useEffect(() => {
    if ((signal.status === 'ready' || signal.chats.length > 0) && signal.chats.length > 0 && !hasPreloadedSignal.current) {
      hasPreloadedSignal.current = true;
      for (const chat of signal.chats.slice(0, 20)) { signal.getMessages(chat.id, 50); }
    }
  }, [signal.status, signal.chats, signal.getMessages]);

  const hasPreloadedEmail = useRef(false);
  useEffect(() => {
    if (email.status === 'ready' && email.chats.length > 0 && !hasPreloadedEmail.current) {
      hasPreloadedEmail.current = true;
      for (const chat of email.chats.slice(0, 20)) { email.getMessages(chat.id); }
    }
  }, [email.status, email.chats, email.getMessages]);

  const hasPreloadedSlack = useRef(false);
  useEffect(() => {
    if (slack.status === 'ready' && slack.chats.length > 0 && !hasPreloadedSlack.current) {
      hasPreloadedSlack.current = true;
      for (const chat of slack.chats.slice(0, 20)) { slack.getMessages(chat.id); }
    }
  }, [slack.status, slack.chats, slack.getMessages]);

  useEffect(() => {
    if (!selectedUser) return;
    const interval = setInterval(() => {
      const signalIds = [...(selectedUser.id.startsWith('sig-') ? [selectedUser.id] : []), ...(selectedUser.alternateIds?.filter(id => id.startsWith('sig-')) || [])];
      if ((signal.status === 'ready' || signal.chats.length > 0) && signalIds.length > 0) {
        for (const sigId of signalIds) { signal.getMessages(sigId.replace('sig-', ''), 100); }
      }
      const waIds = [...(selectedUser.id.startsWith('wa-') ? [selectedUser.id] : []), ...(selectedUser.alternateIds?.filter(id => id.startsWith('wa-')) || [])];
      if (whatsapp.status === 'ready' && waIds.length > 0) {
        for (const waId of waIds) { whatsapp.getMessages(waId.replace('wa-', '') + '@c.us', 100); }
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [selectedUser?.id, selectedUser?.alternateIds, signal.status, signal.chats.length, whatsapp.status, signal.getMessages, whatsapp.getMessages]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  return <MainLayout whatsapp={whatsapp} signal={signal} telegram={telegram} email={email} slack={slack} />;
};

export default App;
