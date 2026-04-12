import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import pino from 'pino';
import pinoHttp from 'pino-http';
import { createServer } from 'http';
import { config } from 'dotenv';
import fs from 'fs';
import rateLimit from 'express-rate-limit';
import cookieParser from 'cookie-parser';
import multer from 'multer';
import { authRouter } from './auth/routes.js';
import { aiRouter } from './routes/ai.js';
import { healthRouter } from './routes/health.js';
import { messagesRouter } from './routes/messages.js';
import { telegramService } from './services/telegramService.js';
import { telegramRouter } from './routes/telegram.js';
import { emailRouter } from './routes/email.js';
import { emailService } from './services/emailService.js';
import { slackService } from './services/slackService.js';
import { slackRouter } from './routes/slack.js';
import { authenticate } from './auth/middleware.js';
import { join, dirname, extname } from 'path';
import { fileURLToPath } from 'url';

// Load environment variables
config({ path: '.env.local' });
config({ path: '.env' });

// Load Docker Secrets
const loadSecret = (envKey, secretName) => {
  const secretPath = `/run/secrets/${secretName}`;
  try {
    if (fs.existsSync(secretPath)) {
      process.env[envKey] = fs.readFileSync(secretPath, 'utf8').trim();
    }
  } catch (err) {
    // Ignore read errors, fallback to existing process.env
  }
};

loadSecret('TELEGRAM_BOT_TOKEN', 'telegram_bot_token');
loadSecret('SLACK_APP_TOKEN', 'slack_app_token');
loadSecret('SLACK_BOT_TOKEN', 'slack_bot_token');
loadSecret('SLACK_SIGNING_SECRET', 'slack_signing_secret');
loadSecret('EMAIL_PASS', 'email_pass');

// Initialize logger
const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: process.env.NODE_ENV !== 'production' 
    ? { target: 'pino-pretty' } 
    : undefined
});

const app = express();
app.set('trust proxy', process.env.NODE_ENV === 'production' ? 'loopback' : false); // Prevent IP spoofing via X-Forwarded-For in dev/test
const PORT = parseInt(process.env.AI_PROXY_PORT) || 3044;

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_API_KEY && process.env.NODE_ENV !== 'test') {
  logger.fatal('GEMINI_API_KEY not set');
  process.exit(1);
}

// ============================================
// MIDDLEWARE
// ============================================

// Security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"]
    }
  }
}));

// CORS
app.use(cors({
  origin: process.env.FRONTEND_URL 
    ? process.env.FRONTEND_URL.split(',') 
    : ['http://localhost:3001', 'http://localhost:5173', 'http://127.0.0.1:3001'],
  methods: ['POST', 'GET', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Timestamp', 'X-Request-Nonce', 'x-csrf-token'],
  credentials: true
}));

app.use(cookieParser(process.env.COOKIE_SECRET || 'fallback-cookie-secret'));

// HTTP request logging
app.use(pinoHttp({ logger }));

// JSON parsing (Limit updated to handle max allowed messages size ~5MB)
app.use(express.json({ limit: '5mb' }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: parseInt(process.env.AI_RATE_LIMIT_REQUESTS) || 60,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn({ ip: req.ip }, 'Rate limit exceeded');
    res.status(429).json({ 
      error: 'Rate limit exceeded', 
      retryAfter: Math.ceil(req.rateLimit.resetTime / 1000)
    });
  }
});
app.use('/api/ai', limiter);

// ============================================
// ROUTES
// ============================================

// Serve media statically
const __dirname = dirname(fileURLToPath(import.meta.url));
import { createUploadMiddleware } from './utils/uploadHandler.js';

const MEDIA_DIR = join(__dirname, 'data', 'media');
if (!fs.existsSync(MEDIA_DIR)) fs.mkdirSync(MEDIA_DIR, { recursive: true });
app.use('/media', authenticate, express.static(MEDIA_DIR));

// Upload endpoint
const { upload, handleUpload } = createUploadMiddleware(MEDIA_DIR);
app.post('/api/upload', authenticate, upload.single('file'), handleUpload);

app.use('/api/auth', authRouter);

// Initialize Telegram Service
telegramService.init();
app.use('/api/telegram', telegramRouter);

// Initialize Slack Service
slackService.init();
app.use('/api/slack', slackRouter);

// Initialize Email Router
app.use('/api/email', emailRouter);

// Mount refactored routes
app.use('/api/ai', aiRouter);
app.use('/api/health', healthRouter);
app.use('/api/messages', messagesRouter);


app.use((err, req, res, next) => {
  if (err.code === 'EBADCSRFTOKEN' || err.code === 'invalidCsrfTokenError') {
    logger.warn({ ip: req.ip }, 'Invalid CSRF token');
    return res.status(403).json({ error: 'Invalid CSRF token' });
  }

  logger.error({ error: err.message, stack: err.stack }, 'Unhandled error');
  const status = err.status || err.statusCode || 500;
  
  let errorMessage = 'Internal server error';
  if (status === 413) errorMessage = 'Payload too large';
  else if (status === 400) errorMessage = 'Bad request';
  
  res.status(status).json({ error: errorMessage });
});

// Start server
const server = createServer(app);
// Only listen if not imported for testing
if (process.env.NODE_ENV !== 'test' && import.meta.url === `file://${process.argv[1]}`) {
  server.listen(PORT, () => {
    logger.info({ port: PORT }, 'AI Proxy server started');
  });
}

export { app }; // For testing
