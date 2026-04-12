import { create } from 'zustand';
import { User, Message } from '../../../types'; // or wherever it is

interface AppState {
  currentUser: User | null;
  messages: Message[];
  selectedChatUserId: string | null;

  setCurrentUser: (user: User | null) => void;
  setMessages: (messages: Message[]) => void;
  addMessage: (message: Message) => void;
  setSelectedChatUserId: (userId: string | null) => void;
}

export const useAppStore = create<AppState>((set) => ({
  currentUser: null,
  messages: [],
  selectedChatUserId: null,

  setCurrentUser: (user) => set({ currentUser: user }),
  setMessages: (messages) => set({ messages }),
  addMessage: (message) =>
    set((state) => ({ messages: [...state.messages, message] })),
  setSelectedChatUserId: (userId) => set({ selectedChatUserId: userId }),
}));
