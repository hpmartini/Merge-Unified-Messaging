
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

const App: React.FC = () => {
  // --- State ---
  const { users, setUsers } = useAppStore();
  const { selectedUser, setSelectedUser } = useAppStore();
  const { messages, setMessages } = useAppStore();
  const { visiblePlatforms, setVisiblePlatforms } = useAppStore();
  const { replyingTo, setReplyingTo } = useAppStore();
  const { isGalleryOpen, setIsGalleryOpen } = useAppStore();
  const { lightboxImage, setLightboxImage } = useAppStore();
  const { activePDF, setActivePDF } = useAppStore();

  // Mobile View State
  const { showMobileChat, setShowMobileChat } = useAppStore();

  // Settings & Theme
  const { isSettingsOpen, setIsSettingsOpen } = useAppStore();
  const { theme, setTheme } = useAppStore();

  // WhatsApp Integration
  const handleWhatsAppMessage = useCallback((waMsg: WhatsAppMessage) => {
    // Convert media to attachment format
    let attachments: Attachment[] = [];
    if (waMsg.media && serverPortRef.current) {
      const mediaUrl = `http://localhost:${serverPortRef.current}${waMsg.media.url}`;
      attachments = [{
        id: waMsg.id,
        type: waMsg.media.type === 'image' || waMsg.media.type === 'video' ? 'image' : 'document',
        name: waMsg.media.filename,
        url: mediaUrl,
        size: waMsg.media.filesize ? `${(waMsg.media.filesize / 1024).toFixed(1)} KB` : '',
        mimetype: waMsg.media.mimetype,
        mediaType: waMsg.media.type
      }];
    }

    // Convert WhatsApp message to app Message format
    const newMessage: Message = {
      id: `wa-${waMsg.id}`,
      userId: `wa-${waMsg.contactId}`,
      platform: Platform.WhatsApp,
      content: waMsg.body,
      timestamp: new Date(waMsg.timestamp * 1000),
      isMe: waMsg.fromMe,
      hash: waMsg.id.substring(0, 7),
      attachments
    };

    setMessages(prev => {
      // Check if message already exists
      if (prev.find(m => m.id === newMessage.id)) return prev;
      return [...prev, newMessage];
    });
  }, []);

  // We need a ref to access serverPort in the callback
  const serverPortRef = useRef<number | null>(null);

  const handleWhatsAppChatsLoaded = useCallback((chats: WhatsAppChat[]) => {
    // Convert WhatsApp chats to Users, deduplicating by name
    // (WhatsApp can have multiple chat entries for the same contact, e.g. @c.us and @lid)
    const waUserMap = new Map<string, User>();
    for (const chat of chats) {
      if (chat.isGroup) continue;

      const normalizedName = normalizeName(chat.name);
      const chatIdClean = chat.id.replace('@c.us', '').replace('@lid', '');
      const waId = `wa-${chatIdClean}`;

      let avatarUrl: string | undefined;
      if (chat.avatarUrl && serverPortRef.current) {
        avatarUrl = `http://localhost:${serverPortRef.current}${chat.avatarUrl}`;
      }

      const chatTime = chat.timestamp ? new Date(chat.timestamp * 1000) : undefined;

      const existing = waUserMap.get(normalizedName);
      if (existing) {
        // Merge: keep the most recent entry, collect alternate IDs
        const existingIsNewer = existing.lastMessageTime && chatTime && existing.lastMessageTime > chatTime;
        waUserMap.set(normalizedName, {
          ...existing,
          avatarUrl: existing.avatarUrl || avatarUrl,
          alternateIds: [...(existing.alternateIds || []), waId],
          lastMessageTime: existingIsNewer ? existing.lastMessageTime : (chatTime || existing.lastMessageTime)
        });
      } else {
        waUserMap.set(normalizedName, {
          id: waId,
          name: chat.name,
          avatarInitials: chat.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase(),
          avatarUrl,
          activePlatforms: [Platform.WhatsApp],
          role: 'WhatsApp Contact',
          lastMessageTime: chatTime
        });
      }
    }
    const waUsers: User[] = Array.from(waUserMap.values());

    setUsers(prev => {
      // Merge WhatsApp users with existing users by ID, alternateIds, or name
      const mergedUsers = [...prev];
      const addedWaUsers: User[] = [];

      for (const waUser of waUsers) {
        // Check by exact ID match OR alternateIds match
        const existingByIdIdx = mergedUsers.findIndex(u =>
          u.id === waUser.id || (u.alternateIds || []).includes(waUser.id)
        );
        if (existingByIdIdx !== -1) {
          // Update existing user (already has this WhatsApp entry)
          const existing = mergedUsers[existingByIdIdx];
          mergedUsers[existingByIdIdx] = {
            ...existing,
            avatarUrl: existing.avatarUrl || waUser.avatarUrl,
            lastMessageTime: waUser.lastMessageTime && (!existing.lastMessageTime || waUser.lastMessageTime > existing.lastMessageTime)
              ? waUser.lastMessageTime
              : existing.lastMessageTime
          };
          continue;
        }

        // Then check by name match (for cross-platform merge)
        const normalizedWaName = normalizeName(waUser.name);
        const existingByNameIdx = mergedUsers.findIndex(u => normalizeName(u.name) === normalizedWaName);

        if (existingByNameIdx !== -1) {
          // Merge: add WhatsApp platform to existing user (e.g. Signal contact)
          const existing = mergedUsers[existingByNameIdx];
          if (!existing.activePlatforms.includes(Platform.WhatsApp)) {
            mergedUsers[existingByNameIdx] = {
              ...existing,
              activePlatforms: [...existing.activePlatforms, Platform.WhatsApp],
              avatarUrl: existing.avatarUrl || waUser.avatarUrl,
              role: 'Contact',
              alternateIds: [...(existing.alternateIds || []), waUser.id],
              lastMessageTime: waUser.lastMessageTime && (!existing.lastMessageTime || waUser.lastMessageTime > existing.lastMessageTime)
                ? waUser.lastMessageTime
                : existing.lastMessageTime
            };
          }
        } else {
          // No match, add as new user
          addedWaUsers.push(waUser);
        }
      }

      return [...mergedUsers, ...addedWaUsers];
    });
  }, []);

  const handleWhatsAppMessagesLoaded = useCallback((chatId: string, waMessages: WhatsAppMessage[]) => {
    console.log('[App] handleWhatsAppMessagesLoaded - chatId:', chatId, 'count:', waMessages.length, 'sample:', waMessages[0]);
    const userId = `wa-${chatId.replace('@c.us', '')}`;
    console.log('[App] Constructed userId:', userId);

    const newMessages: Message[] = waMessages.map(waMsg => {
      // Convert media to attachment format
      let attachments: Attachment[] = [];
      if (waMsg.media && serverPortRef.current) {
        const mediaUrl = `http://localhost:${serverPortRef.current}${waMsg.media.url}`;
        attachments = [{
          id: waMsg.id,
          type: waMsg.media.type === 'image' || waMsg.media.type === 'video' ? 'image' : 'document',
          name: waMsg.media.filename,
          url: mediaUrl,
          size: waMsg.media.filesize ? `${(waMsg.media.filesize / 1024).toFixed(1)} KB` : '',
          mimetype: waMsg.media.mimetype,
          mediaType: waMsg.media.type
        }];
      }

      return {
        id: `wa-${waMsg.id}`,
        userId: userId,
        platform: Platform.WhatsApp,
        content: waMsg.body,
        timestamp: new Date(waMsg.timestamp * 1000),
        isMe: waMsg.fromMe,
        hash: waMsg.id.substring(0, 7),
        attachments
      };
    });

    setMessages(prev => {
      // Filter out duplicates
      const existingIds = new Set(prev.map(m => m.id));
      const uniqueNew = newMessages.filter(m => !existingIds.has(m.id));
      console.log('[App] setMessages - prev count:', prev.length, 'new unique:', uniqueNew.length);
      return [...prev, ...uniqueNew];
    });
  }, []);

  const whatsapp = useWhatsApp('merge-app', {
    onMessage: handleWhatsAppMessage,
    onChatsLoaded: handleWhatsAppChatsLoaded,
    onMessagesLoaded: handleWhatsAppMessagesLoaded,
  });

  // Keep server port ref updated for avatar URLs (sync + effect for safety)
  if (whatsapp.serverPort) serverPortRef.current = whatsapp.serverPort;
  useEffect(() => {
    if (whatsapp.serverPort) serverPortRef.current = whatsapp.serverPort;
  }, [whatsapp.serverPort]);

  // Signal Integration
  const signalServerPortRef = useRef<number | null>(null);

  const handleSignalMessage = useCallback((sigMsg: SignalMessage) => {
    let attachments: Attachment[] = [];
    if (sigMsg.media && signalServerPortRef.current) {
      const mediaUrl = `http://localhost:${signalServerPortRef.current}${sigMsg.media.url}`;
      attachments = [{
        id: sigMsg.id,
        type: sigMsg.media.type === 'image' || sigMsg.media.type === 'video' ? 'image' : 'document',
        name: sigMsg.media.filename,
        url: mediaUrl,
        size: sigMsg.media.filesize ? `${(sigMsg.media.filesize / 1024).toFixed(1)} KB` : '',
        mimetype: sigMsg.media.mimetype,
        mediaType: sigMsg.media.type
      }];
    }

    const newMessage: Message = {
      id: `sig-${sigMsg.id}`,
      userId: `sig-${sigMsg.contactId}`,
      platform: Platform.Signal,
      content: sigMsg.body,
      timestamp: new Date(sigMsg.timestamp * 1000),
      isMe: sigMsg.fromMe,
      hash: sigMsg.id.substring(0, 7),
      attachments
    };

    setMessages(prev => {
      if (prev.find(m => m.id === newMessage.id)) return prev;
      return [...prev, newMessage];
    });
  }, []);

  // Helper to check if a name looks like a proper name (not a UUID, phone number only, etc.)
  const isProperName = (name: string): boolean => {
    if (!name || !name.trim()) return false;
    const trimmed = name.trim();
    // Skip UUIDs (like d1de889c-9889-4c9a-81ce-29a6efeb3571)
    if (/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(trimmed)) return false;
    // Skip pure phone numbers (but allow names with phone numbers)
    if (/^\+?[\d\s-]+$/.test(trimmed)) return false;
    // Skip very short names (likely initials or codes)
    if (trimmed.length < 2) return false;
    return true;
  };

  // Helper to normalize name for matching (merge contacts)
  const normalizeName = (name: string): string => {
    return name.trim().toLowerCase().replace(/\s+/g, ' ');
  };

  const handleSignalChatsLoaded = useCallback((chats: SignalChat[]) => {
    if (!chats || chats.length === 0) return;

    const sigUsers: User[] = chats
      .filter(chat => chat.name && chat.name.trim() && isProperName(chat.name))
      .map(chat => {
        let avatarUrl: string | undefined;
        if (chat.avatarUrl && signalServerPortRef.current) {
          avatarUrl = `http://localhost:${signalServerPortRef.current}${chat.avatarUrl}`;
        }

        const name = chat.name.trim();
        let avatarInitials: string;

        if (chat.isGroup) {
          const words = name.split(/\s+/).filter(w => w.length > 0);
          avatarInitials = words.length >= 2
            ? (words[0][0] + words[1][0]).toUpperCase()
            : name.substring(0, 2).toUpperCase() || 'GR';
        } else {
          const parts = name.split(' ').filter(p => p.length > 0);
          avatarInitials = parts.length >= 2
            ? (parts[0][0] + parts[1][0]).toUpperCase()
            : name.substring(0, 2).toUpperCase() || '??';
        }

        return {
          id: `sig-${chat.id}`,
          name: name,
          avatarInitials,
          avatarUrl,
          activePlatforms: [Platform.Signal],
          role: chat.isGroup ? 'Signal Group' : 'Signal Contact',
          lastMessageTime: chat.timestamp ? new Date(chat.timestamp * 1000) : undefined
        };
      });

    setUsers(prev => {
      // Try to merge Signal users with existing users by ID, alternateIds, or name
      const mergedUsers = [...prev];
      const addedSignalUsers: User[] = [];

      for (const sigUser of sigUsers) {
        // First check by exact ID or alternateIds match
        const existingByIdIdx = mergedUsers.findIndex(u =>
          u.id === sigUser.id || (u.alternateIds || []).includes(sigUser.id)
        );
        if (existingByIdIdx !== -1) {
          // Already exists - update metadata
          const existing = mergedUsers[existingByIdIdx];
          mergedUsers[existingByIdIdx] = {
            ...existing,
            avatarUrl: existing.avatarUrl || sigUser.avatarUrl,
            lastMessageTime: sigUser.lastMessageTime && (!existing.lastMessageTime || sigUser.lastMessageTime > existing.lastMessageTime)
              ? sigUser.lastMessageTime
              : existing.lastMessageTime
          };
          continue;
        }

        // Then check by name match (case-insensitive)
        const normalizedSigName = normalizeName(sigUser.name);
        const existingIdx = mergedUsers.findIndex(u => normalizeName(u.name) === normalizedSigName);

        if (existingIdx !== -1) {
          // Merge: add Signal platform to existing user
          const existing = mergedUsers[existingIdx];
          if (!existing.activePlatforms.includes(Platform.Signal)) {
            mergedUsers[existingIdx] = {
              ...existing,
              activePlatforms: [...existing.activePlatforms, Platform.Signal],
              avatarUrl: existing.avatarUrl || sigUser.avatarUrl,
              role: 'Contact',
              // Track the Signal ID as an alternate ID for message lookup
              alternateIds: [...(existing.alternateIds || []), sigUser.id],
              // Use the more recent timestamp
              lastMessageTime: sigUser.lastMessageTime && (!existing.lastMessageTime || sigUser.lastMessageTime > existing.lastMessageTime)
                ? sigUser.lastMessageTime
                : existing.lastMessageTime
            };
          }
        } else {
          // No match by name, add as new user
          addedSignalUsers.push(sigUser);
        }
      }

      return [...mergedUsers, ...addedSignalUsers];
    });
  }, []);

  const handleSignalMessagesLoaded = useCallback((chatId: string, sigMessages: SignalMessage[]) => {
    const userId = `sig-${chatId}`;

    const newMessages: Message[] = sigMessages.map(sigMsg => {
      let attachments: Attachment[] = [];
      if (sigMsg.media && signalServerPortRef.current) {
        const mediaUrl = `http://localhost:${signalServerPortRef.current}${sigMsg.media.url}`;
        attachments = [{
          id: sigMsg.id,
          type: sigMsg.media.type === 'image' || sigMsg.media.type === 'video' ? 'image' : 'document',
          name: sigMsg.media.filename,
          url: mediaUrl,
          size: sigMsg.media.filesize ? `${(sigMsg.media.filesize / 1024).toFixed(1)} KB` : '',
          mimetype: sigMsg.media.mimetype,
          mediaType: sigMsg.media.type
        }];
      }

      return {
        id: `sig-${sigMsg.id}`,
        userId: userId,
        platform: Platform.Signal,
        content: sigMsg.body,
        timestamp: new Date(sigMsg.timestamp * 1000),
        isMe: sigMsg.fromMe,
        hash: sigMsg.id.substring(0, 7),
        attachments
      };
    });

    setMessages(prev => {
      const existingIds = new Set(prev.map(m => m.id));
      // Also build a set of content+timestamp fingerprints to catch duplicates with different IDs
      const existingFingerprints = new Set(
        prev.filter(m => m.platform === Platform.Signal).map(m =>
          `${m.content}|${m.isMe}|${Math.floor(m.timestamp.getTime() / 5000)}`
        )
      );
      const uniqueNew = newMessages.filter(m => {
        if (existingIds.has(m.id)) return false;
        // Check fingerprint (content + isMe + timestamp within 5s window)
        const fp = `${m.content}|${m.isMe}|${Math.floor(m.timestamp.getTime() / 5000)}`;
        if (existingFingerprints.has(fp)) return false;
        return true;
      });
      if (uniqueNew.length === 0) return prev;
      return [...prev, ...uniqueNew];
    });
  }, []);

  const signal = useSignal('merge-app', {
    onMessage: handleSignalMessage,
    onChatsLoaded: handleSignalChatsLoaded,
    onMessagesLoaded: handleSignalMessagesLoaded,
  });

  if (signal.serverPort) signalServerPortRef.current = signal.serverPort;
  useEffect(() => {
    if (signal.serverPort) signalServerPortRef.current = signal.serverPort;
  }, [signal.serverPort]);

  // Auto-connect to WhatsApp on app startup (if session exists, it will reconnect)
  useEffect(() => {
    // Small delay to let the app render first
    const timer = setTimeout(() => {
      console.log('[App] Auto-connecting to WhatsApp...');
      whatsapp.connect();
    }, 500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run once on mount - intentionally not including whatsapp.connect to prevent re-runs

  // Auto-connect to Signal on app startup
  useEffect(() => {
    const timer = setTimeout(() => {
      console.log('[App] Auto-connecting to Signal...');
      signal.connect();
    }, 1000); // Slight delay after WhatsApp
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-select first user when users are loaded and none selected
  useEffect(() => {
    if (!selectedUser && users.length > 0) {
      setSelectedUser(users[0]);
    }
  }, [users, selectedUser]);

  // Load messages when selecting a user (handles merged contacts too)
  useEffect(() => {
    if (!selectedUser) return;

    console.log('[App] Load messages effect triggered for:', selectedUser.id, 'alternateIds:', selectedUser.alternateIds);

    // Collect all WhatsApp IDs (primary + alternates)
    const whatsappIds = [
      ...(selectedUser.id.startsWith('wa-') ? [selectedUser.id] : []),
      ...(selectedUser.alternateIds?.filter(id => id.startsWith('wa-')) || [])
    ];

    // Load WhatsApp messages
    if (whatsapp.status === 'ready') {
      for (const waId of whatsappIds) {
        const chatId = waId.replace('wa-', '') + '@c.us';
        console.log('[App] Requesting WhatsApp messages for:', chatId);
        whatsapp.getMessages(chatId, 100);
      }
    }

    // Collect all Signal IDs (primary + alternates)
    const signalIds = [
      ...(selectedUser.id.startsWith('sig-') ? [selectedUser.id] : []),
      ...(selectedUser.alternateIds?.filter(id => id.startsWith('sig-')) || [])
    ];

    // Load Signal messages — also load when chats are available (cached data)
    if (signal.status === 'ready' || signal.chats.length > 0) {
      console.log('[App] Signal IDs to load:', signalIds, 'status:', signal.status);
      for (const sigId of signalIds) {
        const chatId = sigId.replace('sig-', '');
        console.log('[App] Requesting Signal messages for:', chatId);
        signal.getMessages(chatId, 100);
      }
    }
  }, [selectedUser?.id, selectedUser?.alternateIds, whatsapp.status, signal.status, signal.chats.length, whatsapp.getMessages, signal.getMessages]);

  // Preload messages for all chats when platforms become ready
  const hasPreloadedWA = useRef(false);
  const hasPreloadedSignal = useRef(false);

  useEffect(() => {
    if (whatsapp.status === 'ready' && whatsapp.chats.length > 0 && !hasPreloadedWA.current) {
      hasPreloadedWA.current = true;
      console.log('[App] Preloading WhatsApp messages for', whatsapp.chats.length, 'chats');
      // Load messages for all chats (limited batch to avoid overloading)
      for (const chat of whatsapp.chats.slice(0, 20)) {
        whatsapp.getMessages(chat.id, 50);
      }
    }
  }, [whatsapp.status, whatsapp.chats, whatsapp.getMessages]);

  useEffect(() => {
    if ((signal.status === 'ready' || signal.chats.length > 0) && signal.chats.length > 0 && !hasPreloadedSignal.current) {
      hasPreloadedSignal.current = true;
      console.log('[App] Preloading Signal messages for', signal.chats.length, 'chats');
      for (const chat of signal.chats.slice(0, 20)) {
        signal.getMessages(chat.id, 50);
      }
    }
  }, [signal.status, signal.chats, signal.getMessages]);

  // Periodic refresh: re-fetch messages for the active chat every 30s to catch missed real-time updates
  useEffect(() => {
    if (!selectedUser) return;
    const interval = setInterval(() => {
      // Refresh Signal messages for active user
      const signalIds = [
        ...(selectedUser.id.startsWith('sig-') ? [selectedUser.id] : []),
        ...(selectedUser.alternateIds?.filter(id => id.startsWith('sig-')) || [])
      ];
      if ((signal.status === 'ready' || signal.chats.length > 0) && signalIds.length > 0) {
        for (const sigId of signalIds) {
          signal.getMessages(sigId.replace('sig-', ''), 100);
        }
      }
      // Refresh WhatsApp messages for active user
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

  // Apply Theme to Document
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // Keep server port ref updated for avatar URLs
  useEffect(() => {
    if (whatsapp.serverPort) serverPortRef.current = whatsapp.serverPort;
  }, [whatsapp.serverPort]);

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
      
      {/* Mobile: Toggle Sidebar visibility */}
      <div className={`${showMobileChat ? 'hidden' : 'flex'} w-full md:w-auto md:flex h-full`}>
        <Sidebar />
      </div>

      {/* Main Chat Area */}
      <div className={`${showMobileChat ? 'flex' : 'hidden'} md:flex flex-1 flex-col min-w-0 relative bg-theme-base`}>
        <ChatArea whatsapp={whatsapp} signal={signal} />
      </div>

      <MediaGallery 
        isOpen={isGalleryOpen} 
        onClose={() => setIsGalleryOpen(false)} 
        messages={messages.filter(m => selectedUser && new Set([selectedUser.id, ...(selectedUser.alternateIds || [])]).has(m.userId))} 
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
