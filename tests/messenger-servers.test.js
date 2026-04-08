import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app as signalApp } from '../server/signal-server.js';
import { app as whatsappApp } from '../server/whatsapp-server.js';
import { signToken } from '../server/auth/jwt.js';

describe('Messenger Servers Auth Integration', () => {
  let validToken;

  beforeAll(() => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
    validToken = signToken({ id: 'uuid', email: 'test@example.com' });
  });

  describe('Signal Server', () => {
    it('should reject unauthorized requests to /api/sessions without cookie', async () => {
      const res = await request(signalApp)
        .get('/api/sessions')
        .expect(401);
      
      expect(res.body).toEqual({ error: 'Authentication required. No token provided.' });
    });

    it('should allow authorized requests to /api/sessions with valid cookie', async () => {
      const res = await request(signalApp)
        .get('/api/sessions')
        .set('Cookie', `jwt=${validToken}`)
        .expect(200);
      
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('should reject unauthorized requests to /api/port', async () => {
      await request(signalApp)
        .get('/api/port')
        .expect(401);
    });
  });

  describe('WhatsApp Server', () => {
    it('should reject unauthorized requests to /api/sessions without cookie', async () => {
      const res = await request(whatsappApp)
        .get('/api/sessions')
        .expect(401);
      
      expect(res.body).toEqual({ error: 'Authentication required. No token provided.' });
    });

    it('should allow authorized requests to /api/sessions with valid cookie', async () => {
      const res = await request(whatsappApp)
        .get('/api/sessions')
        .set('Cookie', `jwt=${validToken}`)
        .expect(200);
      
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('should reject unauthorized requests to /api/port', async () => {
      await request(whatsappApp)
        .get('/api/port')
        .expect(401);
    });
  });
});
