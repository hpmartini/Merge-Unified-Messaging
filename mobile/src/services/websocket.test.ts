import { wsService } from './websocket';
import { useAppStore } from '../store/useAppStore';

jest.mock('../store/useAppStore', () => ({
  useAppStore: {
    getState: jest.fn(),
  },
}));

describe('WebSocketService', () => {
  let mockWebSocket: any;
  let mockStore: any;

  beforeEach(() => {
    mockStore = {
      addMessage: jest.fn(),
      setTyping: jest.fn(),
      updateMessageStatus: jest.fn(),
      addReaction: jest.fn(),
    };

    (useAppStore.getState as jest.Mock).mockReturnValue(mockStore);

    mockWebSocket = {
      send: jest.fn(),
      close: jest.fn(),
      readyState: 1, // OPEN
    };

    global.WebSocket = jest.fn(() => mockWebSocket) as any;
    
    // Disconnect if already connected
    wsService.disconnect();
    // Reset manual disconnect flag
    (wsService as any).manualDisconnect = false;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should handle incoming message event', () => {
    wsService.connect();
    
    const messageEvent = {
      data: JSON.stringify({
        type: 'message',
        payload: { id: 'm1', content: 'test' },
      }),
    };

    mockWebSocket.onmessage(messageEvent);

    expect(mockStore.addMessage).toHaveBeenCalledWith({ id: 'm1', content: 'test' });
  });

  it('should handle incoming typing event', () => {
    wsService.connect();
    
    const typingEvent = {
      data: JSON.stringify({
        type: 'typing',
        payload: { userId: 'u1', isTyping: true },
      }),
    };

    mockWebSocket.onmessage(typingEvent);

    expect(mockStore.setTyping).toHaveBeenCalledWith('u1', true);
  });

  it('should handle incoming receiptMessage event', () => {
    wsService.connect();
    
    const receiptEvent = {
      data: JSON.stringify({
        type: 'receiptMessage',
        payload: { messageId: 'm1', status: 'read' },
      }),
    };

    mockWebSocket.onmessage(receiptEvent);

    expect(mockStore.updateMessageStatus).toHaveBeenCalledWith('m1', 'read');
  });

  it('should handle incoming reaction event', () => {
    wsService.connect();
    
    const reactionEvent = {
      data: JSON.stringify({
        type: 'reaction',
        payload: { messageId: 'm1', reaction: { emoji: '👍', users: ['u1'] } },
      }),
    };

    mockWebSocket.onmessage(reactionEvent);

    expect(mockStore.addReaction).toHaveBeenCalledWith('m1', { emoji: '👍', users: ['u1'] });
  });
});
