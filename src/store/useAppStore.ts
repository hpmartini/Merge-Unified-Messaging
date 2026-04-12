import { create } from 'zustand';
import { User, Message, Platform, Attachment } from '../../types';
import { USERS, INITIAL_MESSAGES } from '../../constants';

interface AppState {
  users: User[];
  selectedUser: User | null;
  messages: Message[];
  visiblePlatforms: Set<Platform>;
  replyingTo: Message | null;
  isGalleryOpen: boolean;
  lightboxImage: Attachment | null;
  activePDF: Attachment | null;
  showMobileChat: boolean;
  isSettingsOpen: boolean;
  theme: 'dark' | 'dimmed' | 'light';
  targetMessageId: string | null;
  draftAttachments: Attachment[];
  summary: string | null;
  globalSearchQuery: string;
  isSearching: boolean;
  showGlobalSearch: boolean;
  globalSearchResults: Message[];
  typingUsers: Record<string, boolean>;
  
  // Actions
  setUsers: (users: User[] | ((prev: User[]) => User[])) => void;
  setSelectedUser: (user: User | null) => void;
  setMessages: (messages: Message[] | ((prev: Message[]) => Message[])) => void;
  setVisiblePlatforms: (platforms: Set<Platform>) => void;
  setReplyingTo: (message: Message | null) => void;
  setIsGalleryOpen: (isOpen: boolean) => void;
  setLightboxImage: (image: Attachment | null) => void;
  setActivePDF: (pdf: Attachment | null) => void;
  setShowMobileChat: (show: boolean) => void;
  setIsSettingsOpen: (isOpen: boolean) => void;
  setTheme: (theme: 'dark' | 'dimmed' | 'light') => void;
  setTargetMessageId: (id: string | null) => void;
  setDraftAttachments: (attachments: Attachment[] | ((prev: Attachment[]) => Attachment[])) => void;
  setSummary: (summary: string | null) => void;
  setGlobalSearchQuery: (query: string) => void;
  setIsSearching: (isSearching: boolean) => void;
  setShowGlobalSearch: (show: boolean) => void;
  setGlobalSearchResults: (results: Message[]) => void;
  setTypingUser: (chatId: string, isTyping: boolean) => void;
  updateMessageReactions: (messageId: string, reactions: { emoji: string; users: string[] }[]) => void;
}

export const useAppStore = create<AppState>((set) => ({
  users: USERS,
  selectedUser: USERS[0] || null,
  messages: INITIAL_MESSAGES,
  visiblePlatforms: new Set(Object.values(Platform)),
  replyingTo: null,
  isGalleryOpen: false,
  lightboxImage: null,
  activePDF: null,
  showMobileChat: false,
  isSettingsOpen: false,
  theme: 'dark',
  targetMessageId: null,
  draftAttachments: [],
  summary: null,
  globalSearchQuery: '',
  isSearching: false,
  showGlobalSearch: false,
  globalSearchResults: [],
  typingUsers: {},
  
  setUsers: (users) => set((state) => ({ users: typeof users === 'function' ? users(state.users) : users })),
  setSelectedUser: (selectedUser) => set({ selectedUser }),
  setMessages: (messages) => set((state) => ({ 
    messages: typeof messages === 'function' ? messages(state.messages) : messages 
  })),
  setVisiblePlatforms: (visiblePlatforms) => set({ visiblePlatforms }),
  setReplyingTo: (replyingTo) => set({ replyingTo }),
  setIsGalleryOpen: (isGalleryOpen) => set({ isGalleryOpen }),
  setLightboxImage: (lightboxImage) => set({ lightboxImage }),
  setActivePDF: (activePDF) => set({ activePDF }),
  setShowMobileChat: (showMobileChat) => set({ showMobileChat }),
  setIsSettingsOpen: (isSettingsOpen) => set({ isSettingsOpen }),
  setTheme: (theme) => set({ theme }),
  setTargetMessageId: (targetMessageId) => set({ targetMessageId }),
  setDraftAttachments: (draftAttachments) => set((state) => ({ draftAttachments: typeof draftAttachments === 'function' ? draftAttachments(state.draftAttachments) : draftAttachments })),
  setSummary: (summary) => set({ summary }),
  setGlobalSearchQuery: (globalSearchQuery) => set({ globalSearchQuery }),
  setIsSearching: (isSearching) => set({ isSearching }),
  setShowGlobalSearch: (showGlobalSearch) => set({ showGlobalSearch }),
  setGlobalSearchResults: (globalSearchResults) => set({ globalSearchResults }),
  setTypingUser: (chatId, isTyping) => set((state) => {
    // Only update if changed
    if (state.typingUsers[chatId] === isTyping) return state;
    return { typingUsers: { ...state.typingUsers, [chatId]: isTyping } };
  }),
  updateMessageReactions: (messageId, reactions) => set((state) => {
    const msgIndex = state.messages.findIndex(m => m.id === messageId);
    if (msgIndex === -1) return state;
    const newMessages = [...state.messages];
    newMessages[msgIndex] = { ...newMessages[msgIndex], reactions };
    return { messages: newMessages };
  }),
}));
