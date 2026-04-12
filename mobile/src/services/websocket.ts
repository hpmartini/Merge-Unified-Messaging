import { useAppStore } from '../store/useAppStore';

const WS_URL = process.env.EXPO_PUBLIC_WS_URL || 'ws://localhost:3000';

class WebSocketService {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 2000;
  private manualDisconnect = false;

  connect() {
    if (this.ws || this.manualDisconnect) return;

    try {
      this.ws = new WebSocket(WS_URL);

      this.ws.onopen = () => {
        console.log('WebSocket connected');
        this.reconnectAttempts = 0;
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.handleEvent(data);
        } catch (error) {
          console.error('Error parsing WebSocket message', error);
        }
      };

      this.ws.onclose = () => {
        console.log('WebSocket disconnected');
        this.ws = null;
        this.reconnect();
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket error', error);
      };
    } catch (error) {
      console.error('WebSocket connection failed', error);
      this.reconnect();
    }
  }

  private handleEvent(data: any) {
    const { type, payload } = data;
    const store = useAppStore.getState();

    switch (type) {
      case 'message':
        if (payload && payload.id) {
          store.addMessage(payload);
        }
        break;
      case 'typing':
        if (payload && payload.userId) {
          store.setTyping(payload.userId, payload.isTyping);
        }
        break;
      case 'receiptMessage':
        if (payload && payload.messageId && payload.status) {
          store.updateMessageStatus(payload.messageId, payload.status);
        }
        break;
      case 'reaction':
        if (payload && payload.messageId && payload.reaction) {
          store.addReaction(payload.messageId, payload.reaction);
        }
        break;
      default:
        console.warn('Unknown WebSocket event', type);
    }
  }

  private reconnect() {
    if (this.manualDisconnect) return;
    
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      setTimeout(() => {
        console.log(`Reconnecting attempt ${this.reconnectAttempts}...`);
        this.connect();
      }, this.reconnectDelay);
    }
  }

  send(type: string, payload: any) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type, payload }));
    } else {
      console.warn('WebSocket is not connected');
    }
  }

  disconnect() {
    this.manualDisconnect = true;
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}

export const wsService = new WebSocketService();
