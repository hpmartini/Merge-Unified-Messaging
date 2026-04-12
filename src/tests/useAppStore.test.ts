import { describe, it, expect, beforeEach } from 'vitest';
import { useAppStore } from '../store/useAppStore';
import { USERS } from '../../constants';

describe('useAppStore', () => {
  beforeEach(() => {
    // Reset state before each test if necessary
    const store = useAppStore.getState();
    store.setUsers(USERS);
    store.setSelectedUser(USERS[0] || null);
  });

  it('should initialize with default state', () => {
    const state = useAppStore.getState();
    expect(state.users).toBeDefined();
    expect(state.theme).toBe('dark');
  });

  it('should update theme', () => {
    const store = useAppStore.getState();
    store.setTheme('light');
    expect(useAppStore.getState().theme).toBe('light');
  });

  it('should update message reactions', () => {
    const store = useAppStore.getState();
    const mockMessage = { id: 'msg-1', content: 'hello', timestamp: new Date(), isMe: false, platform: 'WhatsApp', userId: '1', hash: '123' };
    store.setMessages([mockMessage as any]);
    
    store.updateMessageReactions('msg-1', [
      { emoji: '🔥', users: ['user1'] }
    ]);

    const updatedMessages = useAppStore.getState().messages;
    expect(updatedMessages[0].reactions).toBeDefined();
    expect(updatedMessages[0].reactions![0].emoji).toBe('🔥');
    expect(updatedMessages[0].reactions![0].users).toContain('user1');
  });
});
