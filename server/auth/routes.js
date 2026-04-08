import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { registerSchema, loginSchema } from './schemas.js';
import { hashPassword, verifyPassword, needsRehash } from './password.js';
import { signToken, verifyToken } from './jwt.js';
import { db } from '../db/index.js';
import { generateToken, doubleCsrfProtection } from './csrf.js';

export const authRouter = Router();


const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts, please try again later.' }
});

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many accounts created from this IP, please try again after an hour.' }
});

// CSRF endpoint
authRouter.get('/csrf', (req, res) => {
  const token = generateToken(req, res);
  res.json({ csrfToken: token });
});

// Register
authRouter.post('/register', registerLimiter, doubleCsrfProtection, async (req, res) => {
  try {
    const data = registerSchema.parse(req.body);
    
    // Check if user exists
    const existing = await db.query('SELECT id FROM users WHERE email = $1', [data.email]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Email already in use' });
    }

    const hashed = await hashPassword(data.password);
    const displayName = data.name || data.email.split('@')[0];

    const result = await db.query(
      'INSERT INTO users (email, password_hash, display_name) VALUES ($1, $2, $3) RETURNING id, email, display_name',
      [data.email, hashed, displayName]
    );

    const user = result.rows[0];
    const token = signToken({ id: user.id, email: user.email });

    // Set token in httpOnly cookie
    res.cookie('jwt', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/'
    });

    res.status(201).json({ user, token });
  } catch (err) {
    if (err.name === 'ZodError') {
      return res.status(400).json({ error: 'Validation failed', details: err.errors });
    }
    console.error('Register error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Login
authRouter.post('/login', loginLimiter, doubleCsrfProtection, async (req, res) => {
  try {
    const data = loginSchema.parse(req.body);

    const result = await db.query('SELECT * FROM users WHERE email = $1', [data.email]);
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = result.rows[0];
    const isValid = await verifyPassword(data.password, user.password_hash);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (needsRehash(user.password_hash)) {
      const newHash = await hashPassword(data.password);
      await db.query('UPDATE users SET password_hash = $1 WHERE id = $2', [newHash, user.id]);
    }

    await db.query('UPDATE users SET last_login_at = NOW() WHERE id = $1', [user.id]);

    const token = signToken({ id: user.id, email: user.email });

    res.cookie('jwt', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/'
    });

    res.json({ user: { id: user.id, email: user.email, display_name: user.display_name }, token });
  } catch (err) {
    if (err.name === 'ZodError') {
      return res.status(400).json({ error: 'Validation failed', details: err.errors });
    }
    console.error('Login error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Logout
authRouter.post('/logout', doubleCsrfProtection, (req, res) => {
  res.clearCookie('jwt', { path: '/' });
  res.json({ message: 'Logged out successfully' });
});

// Refresh (using the existing token to get a new one, as simple approach)
authRouter.post('/refresh', doubleCsrfProtection, async (req, res) => {
  try {
    const currentToken = req.cookies.jwt;
    if (!currentToken) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const payload = verifyToken(currentToken);
    
    // Ensure user still exists and active
    const result = await db.query('SELECT id, email, is_active FROM users WHERE id = $1', [payload.id]);
    if (result.rows.length === 0 || !result.rows[0].is_active) {
      return res.status(401).json({ error: 'Invalid user' });
    }

    const newToken = signToken({ id: payload.id, email: payload.email });
    
    res.cookie('jwt', newToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/'
    });

    res.json({ token: newToken });
  } catch (err) {
    console.error('Refresh error:', err);
    res.status(401).json({ error: 'Invalid token' });
  }
});
