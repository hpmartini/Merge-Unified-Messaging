import { renderHook, act } from '@testing-library/react';
import { useWhatsApp } from '../hooks/useWhatsApp';
import { useSignal } from '../hooks/useSignal';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock WebSocket
class MockWebSocket {
  onopen = null;
  onmessage = null;
  onerror = null;
  onclose = null;
  readyState = 1; // OPEN
  send = vi.fn();
  close = vi.fn();

  constructor(url) {
    MockWebSocket.instances.push(this);
    setTimeout(() => {
      if (this.onopen) this.onopen();
    }, 10);
  }
}
MockWebSocket.instances = [];
MockWebSocket.CONNECTING = 0;
MockWebSocket.OPEN = 1;
MockWebSocket.CLOSING = 2;
MockWebSocket.CLOSED = 3;
global.WebSocket = MockWebSocket;

describe('Unified Messaging Hooks - Deduplication & History Fallback', () => {
  beforeEach(() => {
    MockWebSocket.instances = [];
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('useWhatsApp', () => {
    it('deduplicates incoming messages with the same ID', async () => {
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ port: 3050, service: 'whatsapp' })
        })
      );
      
      const { result, unmount } = renderHook(() => useWhatsApp('test-session'));

      await act(async () => {
        await result.current.connect();
      });

      await new Promise((r) => setTimeout(r, 50));

      const ws = MockWebSocket.instances[0];
      expect(ws).toBeDefined();

      act(() => {
        ws.onmessage({
          data: JSON.stringify({
            type: 'message',
            message: {
              id: 'msg_123',
              from: 'user1@c.us',
              body: 'Hello',
              fromMe: false,
              timestamp: 12345,
              contactName: 'User One'
            }
          })
        });
      });

      expect(result.current.messages.get('user1@c.us')).toHaveLength(1);

      act(() => {
        ws.onmessage({
          data: JSON.stringify({
            type: 'message',
            message: {
              id: 'msg_123',
              from: 'user1@c.us',
              body: 'Hello duplicate',
              fromMe: false,
              timestamp: 12346,
              contactName: 'User One'
            }
          })
        });
      });

      expect(result.current.messages.get('user1@c.us')).toHaveLength(1);
      
      unmount();
    });

    it('sends message with provided messageId for optimistic deduplication', async () => {
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ port: 3050, service: 'whatsapp' })
        })
      );

      const { result, unmount } = renderHook(() => useWhatsApp('test-session'));
      await act(async () => {
        await result.current.connect();
      });
      await new Promise((r) => setTimeout(r, 50));

      const ws = MockWebSocket.instances[MockWebSocket.instances.length - 1];
      act(() => {
        result.current.sendMessage('user2@c.us', 'Optimistic text', 'opt_123');
      });

      expect(ws.send).toHaveBeenCalledWith(
        expect.stringContaining('"messageId":"opt_123"')
      );
      unmount();
    });
  });

  describe('useSignal', () => {
    it('deduplicates incoming messages with the same ID', async () => {
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ port: 3050, service: 'signal' })
        })
      );

      const { result, unmount } = renderHook(() => useSignal('test-session-signal-1'));
      await act(async () => {
        await result.current.connect();
      });
      await new Promise((r) => setTimeout(r, 50));

      const ws = MockWebSocket.instances[MockWebSocket.instances.length - 1];
      expect(ws).toBeDefined();

      act(() => {
        ws.onmessage({
          data: JSON.stringify({
            type: 'message',
            message: {
              id: 'sig_123',
              from: '+1234567890',
              body: 'Hello Signal',
              fromMe: false,
              timestamp: 12345,
              contactName: 'Signal User'
            }
          })
        });
      });

      expect(result.current.messages.get('+1234567890')).toHaveLength(1);

      act(() => {
        ws.onmessage({
          data: JSON.stringify({
            type: 'message',
            message: {
              id: 'sig_123',
              from: '+1234567890',
              body: 'Hello Signal Duplicate',
              fromMe: false,
              timestamp: 12345,
              contactName: 'Signal User'
            }
          })
        });
      });

      expect(result.current.messages.get('+1234567890')).toHaveLength(1);

      unmount();
    });

    it('sends message with provided messageId for optimistic deduplication', async () => {
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ port: 3050, service: 'signal' })
        })
      );

      const { result, unmount } = renderHook(() => useSignal('test-session-signal-2'));
      await act(async () => {
        await result.current.connect();
      });
      await new Promise((r) => setTimeout(r, 50));

      const ws = MockWebSocket.instances[MockWebSocket.instances.length - 1];
      expect(ws).toBeDefined();
      act(() => {
        result.current.sendMessage('+1234567890', 'Optimistic text signal', 'opt_sig_123');
      });

      expect(ws.send).toHaveBeenCalledWith(
        expect.stringContaining('"messageId":"opt_sig_123"')
      );
      unmount();
    });
  });
});
