import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import { app } from '../server/ai-proxy.js';

// Mocks to avoid starting the actual server
vi.mock('http', () => ({
  createServer: () => ({
    listen: vi.fn(),
  }),
}));

describe('API Proxy Boilerplate', () => {
  it('GET /api/ai/health should return 200 OK', async () => {
    const res = await request(app).get('/api/ai/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('healthy');
  });

  it('should include security headers (Helmet)', async () => {
    const res = await request(app).get('/api/ai/health');
    // Helmet sets Content-Security-Policy
    expect(res.headers['content-security-policy']).toBeDefined();
    // Helmet sets X-DNS-Prefetch-Control
    expect(res.headers['x-dns-prefetch-control']).toBe('off');
  });

  it('should return 404 for non-existent route', async () => {
    const res = await request(app).get('/api/ai/non-existent');
    expect(res.status).toBe(404);
  });
});
