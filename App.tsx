import React, { useEffect, useRef, useCallback } from 'react';
import { useAppStore } from './src/store/useAppStore';
import Sidebar from './src/components/Sidebar';
import { ChatArea } from './src/components/ChatArea';
import MediaGallery from './components/MediaGallery';
import Lightbox from './components/Lightbox';
import PDFViewer from './components/PDFViewer';
import SettingsModal from './components/SettingsModal';
import { User, Message, Platform, Attachment } from './types';
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

  // References for server ports
  const serverPortRef = useRef<number | null>(null);
  const signalServerPortRef = useRef<number | null>(null);

  // --- State ---
  const { users, setUsers } = useAppStore();
  const { selectedUser, setSelectedUser } = useAppStore();
  const { messages, setMessages } = useAppStore();
  const { isGalleryOpen, setIsGalleryOpen } = useAppStore();
  const { lightboxImage, setLightboxImage } = useAppStore();
  const { activePDF, setActivePDF } = useAppStore();
  const { showMobileChat } = useAppStore();
  const { isSettingsOpen, setIsSettingsOpen } = useAppStore();
  const { theme, setTheme } = useAppStore();

  // --- Telegram Integration ---
  const telegram = useTelegram({
    onChatsLoaded: useCallback((chats: TelegramChat[]) => {
      mergeUsers(chats.map(normalizeTelegramChat), Platform.Telegram);
    }, [mergeUsers]),
    onMessagesLoaded: useCallback((chatId: string, tgMessages: TelegramMessage[]) => {
      mergeMessages(tgMessages.map(normalizeTelegramMessage));
    }, [mergeMessages])
  });

  // --- Email Integration ---
  const email = useEmail({
    onChatsLoaded: useCallback((chats: EmailChat[]) => {
      mergeUsers(chats.map(normalizeEmailChat), Platform.Email);
    }, [mergeUsers]),
    onMessagesLoaded: useCallback((chatId: string, emailMsgs: EmailMessage[]) => {
      mergeMessages(emailMsgs.map(normalizeEmailMessage));
    }, [mergeMessages])
  });

  // --- Slack Integration ---
  const slack = useSlack({
    onChatsLoaded: useCallback((chats: SlackChat[]) => {
      mergeUsers(chats.map(normalizeSlackChat), Platform.Slack);
    }, [mergeUsers]),
    onMessagesLoaded: useCallback((chatId: string, slackMsgs: SlackMessage[]) => {
      mergeMessages(slackMsgs.map(normalizeSlackMessage));
    }, [mergeMessages])
  });

  // --- WhatsApp Integration ---
  const whatsapp = useWhatsApp('merge-app', {
    onMessage: useCallback((waMsg: WhatsAppMessage) => {
      // Need chatId from waMsg, WhatsAppMessage has contactId? Wait, App.tsx used waMsg.contactId
      const chatId = waMsg.contactId || waMsg.id.split('_')[0]; // fallback
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

  // --- Signal Integration ---
  const signal = useSignal('merge-app', {
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

  // --- Effects ---

  useEffect(() => {
    const timer = setTimeout(() => {
      whatsapp.connect();
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      signal.connect();
    }, 1000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!selectedUser && users.length > 0) {
      setSelectedUser(users[0]);
    }
  }, [users, selectedUser, setSelectedUser]);

  useEffect(() => {
    if (!selectedUser) return;

    const whatsappIds = [
      ...(selectedUser.id.startsWith('wa-') ? [selectedUser.id] : []),
      ...(selectedUser.alternateIds?.filter(id => id.startsWith('wa-')) || [])
    ];
    if (whatsapp.status === 'ready') {
      for (const waId of whatsappIds) {
        whatsapp.getMessages(waId.replace('wa-', '') + '@c.us', 100);
      }
    }

    const tgIds = [
      ...(selectedUser.id.startsWith('tg-') ? [selectedUser.id] : []),
      ...(selectedUser.alternateIds?.filter(id => id.startsWith('tg-')) || [])
    ];
    if (telegram.status === 'ready') {
      for (const tgId of tgIds) {
        telegram.getMessages(tgId.replace('tg-', ''));
      }
    }

    const emailIds = [
      ...(selectedUser.id.startsWith('email-') ? [selectedUser.id] : []),
      ...(selectedUser.alternateIds?.filter(id => id.startsWith('email-')) || [])
    ];
    if (email.status === 'ready') {
      for (const emailId of emailIds) {
        email.getMessages(emailId.replace('email-', ''));
      }
    }

    const slackIds = [
      ...(selectedUser.id.startsWith('slack-') ? [selectedUser.id] : []),
      ...(selectedUser.alternateIds?.filter(id => id.startsWith('slack-')) || [])
    ];
    if (slack.status === 'ready') {
      for (const slackId of slackIds) {
        slack.getMessages(slackId.replace('slack-', ''));
      }
    }

    const signalIds = [
      ...(selectedUser.id.startsWith('sig-') ? [selectedUser.id] : []),
      ...(selectedUser.alternateIds?.filter(id => id.startsWith('sig-')) || [])
    ];
    if (signal.status === 'ready' || signal.chats.length > 0) {
      for (const sigId of signalIds) {
        signal.getMessages(sigId.replace('sig-', ''), 100);
      }
    }
  }, [selectedUser?.id, selectedUser?.alternateIds, whatsapp.status, signal.status, signal.chats.length, telegram.status, email.status, slack.status, whatsapp.getMessages, signal.getMessages, telegram.getMessages, email.getMessages, slack.getMessages]);

  const hasPreloadedWA = useRef(false);
  useEffect(() => {
    if (whatsapp.status === 'ready' && whatsapp.chats.length > 0 && !hasPreloadedWA.current) {
      hasPreloadedWA.current = true;
      for (const chat of whatsapp.chats.slice(0, 20)) {
        whatsapp.getMessages(chat.id, 50);
      }
    }
  }, [whatsapp.status, whatsapp.chats, whatsapp.getMessages]);

  const hasPreloadedSignal = useRef(false);
  useEffect(() => {
    if ((signal.status === 'ready' || signal.chats.length > 0) && signal.chats.length > 0 && !hasPreloadedSignal.current) {
      hasPreloadedSignal.current = true;
      for (const chat of signal.chats.slice(0, 20)) {
        signal.getMessages(chat.id, 50);
      }
    }
  }, [signal.status, signal.chats, signal.getMessages]);

  const hasPreloadedEmail = useRef(false);
  useEffect(() => {
    if (email.status === 'ready' && email.chats.length > 0 && !hasPreloadedEmail.current) {
      hasPreloadedEmail.current = true;
      for (const chat of email.chats.slice(0, 20)) {
        email.getMessages(chat.id);
      }
    }
  }, [email.status, email.chats, email.getMessages]);

  const hasPreloadedSlack = useRef(false);
  useEffect(() => {
    if (slack.status === 'ready' && slack.chats.length > 0 && !hasPreloadedSlack.current) {
      hasPreloadedSlack.current = true;
      for (const chat of slack.chats.slice(0, 20)) {
        slack.getMessages(chat.id);
      }
    }
  }, [slack.status, slack.chats, slack.getMessages]);

  useEffect(() => {
    if (!selectedUser) return;
    const interval = setInterval(() => {
      const signalIds = [
        ...(selectedUser.id.startsWith('sig-') ? [selectedUser.id] : []),
        ...(selectedUser.alternateIds?.filter(id => id.startsWith('sig-')) || [])
      ];
      if ((signal.status === 'ready' || signal.chats.length > 0) && signalIds.length > 0) {
        for (const sigId of signalIds) {
          signal.getMessages(sigId.replace('sig-', ''), 100);
        }
      }
      const waIds = [
        ...(selectedUser.id.startsWith('wa-') ? [selectedUser.id] : []),
        ...(selectedUser.alternateIds?.filter(id => id.startsWith('wa-')) || [])
      ];
      if (whatsapp.status === 'ready' && waIds.length > 0) {
        for (const waId of waIds) {
          whatsapp.getMessages(waId.replace('wa-', '') + '@c.us', 100);
        }
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [selectedUser?.id, selectedUser?.alternateIds, signal.status, signal.chats.length, whatsapp.status, signal.getMessages, whatsapp.getMessages]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const handleDocumentAction = (att: Attachment) => {
    if (att.name.toLowerCase().endsWith('.pdf')) {
      setActivePDF(att);
    } else {
      const link = document.createElement('a');
      link.href = att.url;
      link.download = att.name;
      link.click();
    }
  };

  return (
    <div className="flex h-screen bg-theme-base text-theme-main overflow-hidden font-sans selection:bg-blue-500/30">
      
      <div className={`${showMobileChat ? 'hidden' : 'flex'} w-full md:w-auto md:flex h-full`}>
        <Sidebar />
      </div>

      <div className={`${showMobileChat ? 'flex' : 'hidden'} md:flex flex-1 flex-col min-w-0 relative bg-theme-base`}>
        <ChatArea whatsapp={whatsapp} signal={signal} telegram={telegram} email={email} slack={slack} />
      </div>

      <MediaGallery 
        isOpen={isGalleryOpen} 
        onClose={() => setIsGalleryOpen(false)} 
        messages={messages.filter((m: Message) => selectedUser && new Set([selectedUser.id, ...(selectedUser.alternateIds || [])]).has(m.userId))} 
        onImageClick={setLightboxImage}
        onDocView={handleDocumentAction}
      />

      <Lightbox 
        attachment={lightboxImage} 
        onClose={() => setLightboxImage(null)} 
      />

      <PDFViewer 
        attachment={activePDF} 
        onClose={() => setActivePDF(null)} 
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        currentTheme={theme}
        onSetTheme={setTheme}
        whatsapp={whatsapp}
        signal={signal}
      />
    </div>
  );
};

export default App;
