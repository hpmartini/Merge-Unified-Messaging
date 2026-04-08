import { describe, it, expect, vi, beforeEach } from 'vitest';
import { signToken, verifyToken } from '../server/auth/jwt.js';
import { authenticate } from '../server/auth/middleware.js';
import { registerSchema, loginSchema } from '../server/auth/schemas.js';

describe('JWT Utils', () => {
  beforeEach(() => {
    process.env.JWT_SECRET = 'super-secret-test-key-12345';
  });

  it('should sign and verify a token', () => {
    const payload = { id: '123', email: 'test@example.com' };
    const token = signToken(payload);
    
    expect(typeof token).toBe('string');
    
    const decoded = verifyToken(token);
    expect(decoded.id).toBe(payload.id);
    expect(decoded.email).toBe(payload.email);
  });

  it('should fail on invalid token', () => {
    expect(() => verifyToken('invalid.token.here')).toThrow();
  });
});

describe('Zod Schemas', () => {
  it('should validate correct login data', () => {
    const valid = loginSchema.safeParse({ email: 'test@example.com', password: 'password123' });
    expect(valid.success).toBe(true);
  });

  it('should reject invalid email', () => {
    const invalid = loginSchema.safeParse({ email: 'not-an-email', password: 'password123' });
    expect(invalid.success).toBe(false);
  });

  it('should reject email longer than 255 chars', () => {
    const longEmail = 'a'.repeat(250) + '@example.com'; // > 255 chars
    const invalid = loginSchema.safeParse({ email: longEmail, password: 'password123' });
    expect(invalid.success).toBe(false);
    expect(invalid.error.issues[0].message).toBe('Email too long');
  });

  it('should reject password longer than 128 chars', () => {
    const longPassword = 'a'.repeat(129);
    const invalid = loginSchema.safeParse({ email: 'test@example.com', password: longPassword });
    expect(invalid.success).toBe(false);
    expect(invalid.error.issues[0].message).toBe('Password too long');
  });
});

describe('Auth Middleware', () => {
  beforeEach(() => {
    process.env.JWT_SECRET = 'super-secret-test-key-12345';
  });

  it('should authenticate with valid token in Header', () => {
    const token = signToken({ id: 1 });
    const req = {
      headers: { authorization: `Bearer ${token}` },
      cookies: {}
    };
    const res = {};
    const next = vi.fn();

    authenticate(req, res, next);
    
    expect(next).toHaveBeenCalled();
    expect(req.user).toBeDefined();
    expect(req.user.id).toBe(1);
  });

  it('should authenticate with valid token in Cookie', () => {
    const token = signToken({ id: 2 });
    const req = {
      headers: {},
      cookies: { jwt: token }
    };
    const res = {};
    const next = vi.fn();

    authenticate(req, res, next);
    
    expect(next).toHaveBeenCalled();
    expect(req.user.id).toBe(2);
  });

  it('should return 401 if no token provided', () => {
    const req = { headers: {}, cookies: {} };
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn()
    };
    const next = vi.fn();

    authenticate(req, res, next);
    
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Authentication required. No token provided.' });
    expect(next).not.toHaveBeenCalled();
  });

  it('should return 401 on invalid token', () => {
    const req = { headers: { authorization: 'Bearer bad-token' }, cookies: {} };
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn()
    };
    const next = vi.fn();

    authenticate(req, res, next);
    
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid token.' });
    expect(next).not.toHaveBeenCalled();
  });

  it('should return 401 on expired token', () => {
    const token = signToken({ id: 99 }, '-1h');
    const req = { headers: { authorization: `Bearer ${token}` }, cookies: {} };
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn()
    };
    const next = vi.fn();

    authenticate(req, res, next);
    
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Token expired.' });
    expect(next).not.toHaveBeenCalled();
  });
});
