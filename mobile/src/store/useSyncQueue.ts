import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Message } from '../../../types';

export interface PendingMessage extends Message {
  syncStatus: 'pending' | 'syncing' | 'failed';
  syncRetryCount: number;
}

interface SyncQueueState {
  pendingMessages: PendingMessage[];
  addPendingMessage: (message: Message) => void;
  removePendingMessage: (messageId: string) => void;
  updateMessageStatus: (messageId: string, status: 'pending' | 'syncing' | 'failed') => void;
  incrementRetryCount: (messageId: string) => void;
  clearQueue: () => void;
}

export const useSyncQueue = create<SyncQueueState>()(
  persist(
    (set) => ({
      pendingMessages: [],

      addPendingMessage: (message) =>
        set((state) => ({
          pendingMessages: [
            ...state.pendingMessages,
            { ...message, syncStatus: 'pending', syncRetryCount: 0 },
          ],
        })),

      removePendingMessage: (messageId) =>
        set((state) => ({
          pendingMessages: state.pendingMessages.filter((m) => m.id !== messageId),
        })),

      updateMessageStatus: (messageId, status) =>
        set((state) => ({
          pendingMessages: state.pendingMessages.map((m) =>
            m.id === messageId ? { ...m, syncStatus: status } : m
          ),
        })),

      incrementRetryCount: (messageId) =>
        set((state) => ({
          pendingMessages: state.pendingMessages.map((m) =>
            m.id === messageId ? { ...m, syncRetryCount: m.syncRetryCount + 1 } : m
          ),
        })),

      clearQueue: () => set({ pendingMessages: [] }),
    }),
    {
      name: 'sync-queue-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
