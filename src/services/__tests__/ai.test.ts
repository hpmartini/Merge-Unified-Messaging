import { describe, it, expect, beforeEach, vi } from 'vitest';
import { summarizeConversation, composeMessage } from '../ai';
import { Platform } from '../../../types';

describe('AI Service Client', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  it('sends correctly formatted summarize request', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ summary: 'Test summary' })
    });
    
    const messages = [{ 
      id: '1', 
      userId: 'user1',
      content: 'Hello', 
      timestamp: new Date('2026-03-27T10:00:00Z'), 
      isMe: true, 
      platform: Platform.Signal,
      hash: 'abc'
    }];
    
    const result = await summarizeConversation(messages, 'Contact Name');
    
    expect(result).toBe('Test summary');
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/ai/summarize',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ 
          'Content-Type': 'application/json',
          'X-Request-Timestamp': expect.any(String),
          'X-Request-Nonce': expect.any(String)
        }),
        body: expect.stringContaining('"contactName":"Contact Name"')
      })
    );
  });

  it('throws on non-OK response', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ message: 'Rate limited' })
    });
    
    await expect(summarizeConversation([], 'Test')).rejects.toThrow('Rate limited');
  });

  it('throws on network error', async () => {
    (global.fetch as any).mockRejectedValueOnce(new TypeError('Failed to fetch'));
    
    await expect(summarizeConversation([], 'Test')).rejects.toThrow('Network error: Failed to reach AI proxy for summarization.');
  });

  it('sends correctly formatted compose request', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ text: 'Improved text' })
    });
    
    const result = await composeMessage('improve', { currentDraft: 'draft' });
    
    expect(result).toBe('Improved text');
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/ai/compose',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          'X-Request-Timestamp': expect.any(String),
          'X-Request-Nonce': expect.any(String)
        }),
        body: expect.stringContaining('"action":"improve"')
      })
    );
  });
});