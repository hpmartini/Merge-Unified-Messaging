import { useAppStore } from './useAppStore';
import { Platform } from '../../../types';

describe('useAppStore', () => {
  beforeEach(() => {
    // Reset store before each test
    useAppStore.setState({
      currentUser: null,
      messages: [],
      selectedChatUserId: null,
      typingUsers: {},
    });
  });

  it('should initialize with default state', () => {
    const state = useAppStore.getState();
    expect(state.currentUser).toBeNull();
    expect(state.messages).toEqual([]);
    expect(state.selectedChatUserId).toBeNull();
    expect(state.typingUsers).toEqual({});
  });

  it('should set current user', () => {
    const user = {
      id: '1',
      name: 'Test User',
      avatarInitials: 'TU',
      activePlatforms: [Platform.WhatsApp],
    };
    useAppStore.getState().setCurrentUser(user);
    expect(useAppStore.getState().currentUser).toEqual(user);
  });

  it('should set and add messages', () => {
    const message1 = {
      id: 'm1',
      userId: '1',
      platform: Platform.WhatsApp,
      content: 'Hello',
      timestamp: new Date(),
      isMe: true,
      hash: 'abc',
    };
    
    useAppStore.getState().setMessages([message1]);
    expect(useAppStore.getState().messages).toEqual([message1]);

    const message2 = {
      id: 'm2',
      userId: '1',
      platform: Platform.WhatsApp,
      content: 'World',
      timestamp: new Date(),
      isMe: true,
      hash: 'def',
    };
    useAppStore.getState().addMessage(message2);
    expect(useAppStore.getState().messages).toEqual([message1, message2]);
  });

  it('should set selected chat user ID', () => {
    useAppStore.getState().setSelectedChatUserId('user_2');
    expect(useAppStore.getState().selectedChatUserId).toBe('user_2');
  });

  it('should update typing status', () => {
    useAppStore.getState().setTyping('user_1', true);
    expect(useAppStore.getState().typingUsers['user_1']).toBe(true);

    useAppStore.getState().setTyping('user_1', false);
    expect(useAppStore.getState().typingUsers['user_1']).toBe(false);
  });

  it('should update message status', () => {
    const message = {
      id: 'm1',
      userId: '1',
      platform: Platform.WhatsApp,
      content: 'Hello',
      timestamp: new Date(),
      isMe: true,
      hash: 'abc',
      status: 'sent',
    };
    useAppStore.getState().setMessages([message]);
    useAppStore.getState().updateMessageStatus('m1', 'read');
    
    expect(useAppStore.getState().messages[0].status).toBe('read');
  });

  it('should add reactions to messages', () => {
    const message = {
      id: 'm1',
      userId: '1',
      platform: Platform.WhatsApp,
      content: 'Hello',
      timestamp: new Date(),
      isMe: true,
      hash: 'abc',
      reactions: [],
    };
    useAppStore.getState().setMessages([message]);
    
    // Add new reaction
    useAppStore.getState().addReaction('m1', { emoji: '👍', users: ['user_2'] });
    expect(useAppStore.getState().messages[0].reactions).toEqual([{ emoji: '👍', users: ['user_2'] }]);

    // Append to existing reaction
    useAppStore.getState().addReaction('m1', { emoji: '👍', users: ['user_3'] });
    expect(useAppStore.getState().messages[0].reactions?.[0]?.users).toEqual(expect.arrayContaining(['user_2', 'user_3']));
  });
});
