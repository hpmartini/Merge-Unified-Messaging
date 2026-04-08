import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';

// Mock the Gemini API client before importing app
vi.mock('@google/generative-ai', () => {
  return {
    GoogleGenerativeAI: class {
      constructor() {}
      getGenerativeModel() {
        return {
          generateContent: vi.fn().mockResolvedValue({
            response: {
              text: () => 'Mock summary',
              usageMetadata: { totalTokenCount: 15 }
            }
          })
        };
      }
    }
  };
});

// Mocks to avoid starting the actual server
vi.mock('http', () => ({
  createServer: () => ({
    listen: vi.fn(),
  }),
}));

import { app } from '../server/ai-proxy.js';

describe('API Proxy', () => {
  it('GET /api/ai/health should return 200 OK', async () => {
    const res = await request(app).get('/api/ai/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('healthy');
  });

  it('should include security headers (Helmet)', async () => {
    const res = await request(app).get('/api/ai/health');
    expect(res.headers['content-security-policy']).toBeDefined();
    expect(res.headers['x-dns-prefetch-control']).toBe('off');
  });

  describe('POST /api/ai/summarize', () => {
    it('returns 400 for missing messages array', async () => {
      const res = await request(app)
        .post('/api/ai/summarize')
        .send({ contactName: 'Test' });
      expect(res.status).toBe(400);
      expect(res.body.details[0].path).toBe('messages');
    });

    it('returns 200 and summary for valid payload', async () => {
      const res = await request(app)
        .post('/api/ai/summarize')
        .send({
          messages: [{
            content: 'Hello',
            timestamp: new Date().toISOString(),
            sender: 'other',
            platform: 'test'
          }],
          contactName: 'Test'
        });
      expect(res.status).toBe(200);
      expect(res.body.summary).toBe('Mock summary');
      expect(res.body.tokensUsed).toBe(15);
    });

    it('enforces rate limits', async () => {
      const validPayload = {
        messages: [{
          content: 'test rate limit',
          timestamp: new Date().toISOString(),
          sender: 'other',
          platform: 'test'
        }],
        contactName: 'Test'
      };

      let lastStatus = 200;
      for (let i = 0; i < 65; i++) {
        const r = await request(app).post('/api/ai/summarize').send(validPayload);
        if (r.status === 429) {
          lastStatus = 429;
          break;
        }
      }
      expect(lastStatus).toBe(429);
    });
  });
});
