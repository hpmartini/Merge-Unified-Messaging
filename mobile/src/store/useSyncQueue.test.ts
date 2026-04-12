import { useSyncQueue } from './useSyncQueue';
import { Platform } from '../../../types';

jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn(),
  getItem: jest.fn(),
  removeItem: jest.fn(),
}));

describe('useSyncQueue', () => {
  beforeEach(() => {
    useSyncQueue.getState().clearQueue();
  });

  const mockMessage = {
    id: 'msg-1',
    userId: 'user-1',
    platform: 'discord' as Platform,
    content: 'Hello World',
    timestamp: new Date(),
    isMe: true,
    hash: 'hash-1'
  };

  it('adds a message to the queue as pending', () => {
    useSyncQueue.getState().addPendingMessage(mockMessage);
    const state = useSyncQueue.getState();
    expect(state.pendingMessages.length).toBe(1);
    expect(state.pendingMessages[0].syncStatus).toBe('pending');
    expect(state.pendingMessages[0].syncRetryCount).toBe(0);
  });

  it('removes a message from the queue', () => {
    useSyncQueue.getState().addPendingMessage(mockMessage);
    useSyncQueue.getState().removePendingMessage('msg-1');
    const state = useSyncQueue.getState();
    expect(state.pendingMessages.length).toBe(0);
  });

  it('updates message status', () => {
    useSyncQueue.getState().addPendingMessage(mockMessage);
    useSyncQueue.getState().updateMessageStatus('msg-1', 'syncing');
    const state = useSyncQueue.getState();
    expect(state.pendingMessages[0].syncStatus).toBe('syncing');
  });

  it('increments retry count', () => {
    useSyncQueue.getState().addPendingMessage(mockMessage);
    useSyncQueue.getState().incrementRetryCount('msg-1');
    const state = useSyncQueue.getState();
    expect(state.pendingMessages[0].syncRetryCount).toBe(1);
  });
});
