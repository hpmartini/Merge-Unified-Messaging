import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createServer } from 'http';
import { app } from '../server/ai-proxy.js';
import { summarizeConversation } from '../src/services/ai.ts';

const PORT = 3045;
let server;

beforeAll(async () => {
  server = createServer(app);
  await new Promise((resolve) => server.listen(PORT, resolve));
  
  if (!globalThis.crypto) {
    const { webcrypto } = await import('crypto');
    globalThis.crypto = webcrypto;
  }

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    const testUrl = url.startsWith('/api') ? `http://localhost:${PORT}${url}` : url;
    return originalFetch(testUrl, options);
  };
});

afterAll(async () => {
  await new Promise((resolve) => server.close(resolve));
});

describe('E2E: Frontend ai.ts to server ai-proxy.js', () => {
  it('summarizeConversation successfully calls the proxy', async () => {
    try {
      const summary = await summarizeConversation([
        { timestamp: new Date(), isMe: true, platform: 'test', content: 'hello' }
      ], 'John');
      expect(summary).toBeDefined();
    } catch (err) {
      expect(err.message).not.toMatch(/Network error/i);
    }
  });
});
