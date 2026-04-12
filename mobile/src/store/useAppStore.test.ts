import { useAppStore } from './useAppStore';
import { Platform } from '../../../types';

describe('useAppStore', () => {
  beforeEach(() => {
    // Reset store before each test
    useAppStore.setState({
      currentUser: null,
      messages: [],
      selectedChatUserId: null,
    });
  });

  it('should initialize with default state', () => {
    const state = useAppStore.getState();
    expect(state.currentUser).toBeNull();
    expect(state.messages).toEqual([]);
    expect(state.selectedChatUserId).toBeNull();
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
});
