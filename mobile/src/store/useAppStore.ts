import { create } from 'zustand';
import { User, Message } from '../../../types';

interface AppState {
  currentUser: User | null;
  messages: Message[];
  selectedChatUserId: string | null;
  typingUsers: Record<string, boolean>;

  setCurrentUser: (user: User | null) => void;
  setMessages: (messages: Message[]) => void;
  addMessage: (message: Message) => void;
  setSelectedChatUserId: (userId: string | null) => void;
  
  // Real-time events
  setTyping: (userId: string, isTyping: boolean) => void;
  updateMessageStatus: (messageId: string, status: string) => void;
  addReaction: (messageId: string, reaction: { emoji: string; users: string[] }) => void;
}

export const useAppStore = create<AppState>((set) => ({
  currentUser: null,
  messages: [],
  selectedChatUserId: null,
  typingUsers: {},

  setCurrentUser: (user) => set({ currentUser: user }),
  setMessages: (messages) => set({ messages }),
  addMessage: (message) =>
    set((state) => {
      // Prevent duplicates
      if (state.messages.find(m => m.id === message.id)) {
        return state;
      }
      return { messages: [...state.messages, message] };
    }),
  setSelectedChatUserId: (userId) => set({ selectedChatUserId: userId }),
  
  setTyping: (userId, isTyping) =>
    set((state) => ({
      typingUsers: { ...state.typingUsers, [userId]: isTyping },
    })),
    
  updateMessageStatus: (messageId, status) =>
    set((state) => ({
      messages: state.messages.map((msg) =>
        msg.id === messageId ? { ...msg, status } : msg
      ),
    })),
    
  addReaction: (messageId, reaction) =>
    set((state) => ({
      messages: state.messages.map((msg) => {
        if (msg.id === messageId) {
          const reactions = msg.reactions ? [...msg.reactions] : [];
          const existingReactionIndex = reactions.findIndex(r => r.emoji === reaction.emoji);
          
          if (existingReactionIndex >= 0) {
            // Update existing reaction
            const existing = reactions[existingReactionIndex];
            const newUsers = Array.from(new Set([...existing.users, ...reaction.users]));
            reactions[existingReactionIndex] = { ...existing, users: newUsers };
          } else {
            // Add new reaction
            reactions.push(reaction);
          }
          
          return { ...msg, reactions };
        }
        return msg;
      }),
    })),
}));
