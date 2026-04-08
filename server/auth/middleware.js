import { verifyToken } from './jwt.js';
import pino from 'pino';

const logger = pino({ name: 'auth-middleware' });

export const authenticate = (req, res, next) => {
  try {
    // Check cookie first
    let token = req.cookies?.jwt;

    // Fallback to Authorization header
    if (!token && req.headers.authorization?.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({ error: 'Authentication required. No token provided.' });
    }

    const decoded = verifyToken(token);
    // Attach user payload to request
    req.user = decoded;
    
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      logger.info('JWT expired');
      return res.status(401).json({ error: 'Token expired.' });
    } else {
      logger.warn({ err: error.message }, 'JWT verification failed');
      return res.status(401).json({ error: 'Invalid token.' });
    }
  }
};
