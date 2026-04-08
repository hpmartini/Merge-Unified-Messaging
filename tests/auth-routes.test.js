import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../server/ai-proxy.js';
import { db } from '../server/db/index.js';
import * as passwordUtils from '../server/auth/password.js';

vi.mock('../server/db/index.js', () => ({
  db: {
    query: vi.fn(),
  }
}));

describe('Auth Routes', () => {
  let csrfToken = '';
  let cookie = [];

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.JWT_SECRET = 'super-secret-test-key-12345';
  });

  it('GET /api/auth/csrf - should return a CSRF token', async () => {
    const res = await request(app).get('/api/auth/csrf');
    expect(res.status).toBe(200);
    expect(res.body.csrfToken).toBeDefined();
    
    // Save token and cookie for subsequent tests
    csrfToken = res.body.csrfToken;
    cookie = res.headers['set-cookie'];
  });

  it('POST /api/auth/register - should fail without CSRF token', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'test@example.com', password: 'password123' });
    
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('Invalid CSRF token');
  });

  it('POST /api/auth/register - should create user and return JWT', async () => {
    db.query.mockResolvedValueOnce({ rows: [] }); // User check
    db.query.mockResolvedValueOnce({ rows: [{ id: 'uuid', email: 'test@example.com', display_name: 'test' }] }); // Insert

    const res = await request(app)
      .post('/api/auth/register')
      .set('x-csrf-token', csrfToken)
      .set('Cookie', cookie)
      .send({ email: 'test@example.com', password: 'password123', name: 'test' });
    
    expect(res.status).toBe(201);
    expect(res.body.user.email).toBe('test@example.com');
    expect(res.headers['set-cookie'][0]).toMatch(/jwt=/);
  });

  it('POST /api/auth/login - should authenticate and return JWT', async () => {
    const hashed = await passwordUtils.hashPassword('password123');
    db.query.mockResolvedValueOnce({ rows: [{ id: 'uuid', email: 'test@example.com', password_hash: hashed }] }); // User check
    db.query.mockResolvedValueOnce({ rows: [] }); // Update last_login

    const res = await request(app)
      .post('/api/auth/login')
      .set('x-csrf-token', csrfToken)
      .set('Cookie', cookie)
      .send({ email: 'test@example.com', password: 'password123' });
    
    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(res.headers['set-cookie'][0]).toMatch(/jwt=/);
  });

  it('POST /api/auth/logout - should clear cookie', async () => {
    const res = await request(app)
      .post('/api/auth/logout')
      .set('x-csrf-token', csrfToken)
      .set('Cookie', cookie);
    
    expect(res.status).toBe(200);
    expect(res.headers['set-cookie'][0]).toMatch(/jwt=;/);
  });
});
