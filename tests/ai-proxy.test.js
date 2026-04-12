import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';

// Mock the Gemini API client before importing app
vi.mock('@google/generative-ai', () => {
  return {
    GoogleGenerativeAI: class {
      constructor(apiKey) {
        this.apiKey = apiKey;
      }
      getGenerativeModel() {
        return {
          generateContent: vi.fn().mockImplementation(async (opts) => {
            const promptStr = typeof opts === 'string' ? opts : JSON.stringify(opts);
            if (this.apiKey === 'invalid_key' || promptStr.includes('force_error')) {
               throw new Error('GoogleGenerativeAI Error: invalid API key or bad request');
            }
            return {
              response: {
                text: () => 'Mock summary',
                usageMetadata: { totalTokenCount: 15 }
              }
            };
          })
        };
      }
    }
  };
});



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

  describe('POST /api/ai/summarize Edge Cases', () => {
    it('returns 400 for missing messages array (Invalid Zod)', async () => {
      const res = await request(app)
        .post('/api/ai/summarize')
        .send({ contactName: 'Test' });
      expect(res.status).toBe(400);
      expect(res.body.errors[0].path).toBe('messages');
    });

    it('returns 400 for completely invalid payload structure', async () => {
      const res = await request(app)
        .post('/api/ai/summarize')
        .send([1, 2, 3]);
      expect(res.status).toBe(400);
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

    it('handles payloads up to 5MB and rejects > 5MB', async () => {
      // Generate a ~4.5MB payload using many messages so it passes Zod
      const messages = [];
      const longString = 'A'.repeat(9000); // within 10k limit
      for (let i = 0; i < 400; i++) {
        messages.push({
          content: longString,
          timestamp: new Date().toISOString(),
          sender: 'other',
          platform: 'test'
        });
      }
      
      const resPass = await request(app)
        .post('/api/ai/summarize')
        .send({
          messages,
          contactName: 'LargeTest'
        });
      // Should successfully parse body and run logic (200)
      expect(resPass.status).toBe(200);
      
      // 6MB single string payload (bypassing Zod because express rejects it first)
      const hugeContent = 'A'.repeat(6000000);
      const resFail = await request(app)
        .post('/api/ai/summarize')
        .send({
          messages: [{
            content: hugeContent,
            timestamp: new Date().toISOString(),
            sender: 'other',
            platform: 'test'
          }],
          contactName: 'HugeTest'
        });
      // Express body-parser limit
      expect(resFail.status).toBe(413);
    });

    it('handles Gemini API errors (e.g. backend error) gracefully with 502', async () => {
      const res = await request(app)
        .post('/api/ai/summarize')
        .send({
          messages: [{
            content: 'force_error',
            timestamp: new Date().toISOString(),
            sender: 'other',
            platform: 'test'
          }],
          contactName: 'Test'
        });
      // As seen in server implementation, it returns 502 for external API failures
      expect(res.status).toBe(502);
      expect(res.body.error).toBeDefined();
    });

  });
});
