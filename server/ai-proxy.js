import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import pino from 'pino';
import pinoHttp from 'pino-http';
import { createServer } from 'http';
import { config } from 'dotenv';
import fs from 'fs';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { GoogleGenerativeAI } from '@google/generative-ai';
import cookieParser from 'cookie-parser';
import multer from 'multer';
import { authRouter } from './auth/routes.js';
import { telegramService } from './services/telegramService.js';
import { telegramRouter } from './routes/telegram.js';
import { emailRouter } from './routes/email.js';
import { emailService } from './services/emailService.js';
import { slackService } from './services/slackService.js';
import { slackRouter } from './routes/slack.js';
import { authenticate } from './auth/middleware.js';
import { join, dirname } from 'path';
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

const ai = new GoogleGenerativeAI(GEMINI_API_KEY);

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
// ZOD SCHEMAS
// ============================================
const MessageSchema = z.object({
  timestamp: z.string(),
  sender: z.enum(['me', 'other']),
  senderName: z.string().max(100).optional(),
  platform: z.string().max(50),
  content: z.string().max(10000)
});

const SummarizeRequestSchema = z.object({
  messages: z.array(MessageSchema).min(1).max(500),
  options: z.object({
    blockLimit: z.number().int().min(1).max(50).default(1),
    groupingMinutes: z.number().int().min(1).max(60).default(5),
    includeMe: z.boolean().default(true),
    includeOther: z.boolean().default(true)
  }).optional().default({}),
  contactName: z.string().min(1).max(100)
});

// Validation middleware factory
function validate(schema) {
  return (req, res, next) => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof z.ZodError || error.name === 'ZodError') {
        const issues = error.errors || error.issues || [];
        logger.info({ errors: issues }, 'Validation failed');
        return res.status(400).json({
          error: 'Validation failed',
          details: issues.map(e => ({
            path: e.path ? e.path.join('.') : '',
            message: e.message
          }))
        });
      }
      next(error);
    }
  };
}

// Basic HTML/script sanitization helper
function sanitize(text) {
  if (!text) return '';
  return text.replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ============================================
// ROUTES
// ============================================

// Serve media statically
const __dirname = dirname(fileURLToPath(import.meta.url));
const MEDIA_DIR = join(__dirname, 'data', 'media');
if (!fs.existsSync(MEDIA_DIR)) fs.mkdirSync(MEDIA_DIR, { recursive: true });
app.use('/media', authenticate, express.static(MEDIA_DIR));

// Upload endpoint
const upload = multer({ dest: MEDIA_DIR });
app.post('/api/upload', authenticate, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const ext = req.file.originalname.substring(req.file.originalname.lastIndexOf('.'));
  const finalName = req.file.filename + ext;
  fs.renameSync(req.file.path, join(MEDIA_DIR, finalName));
  res.json({ url: `/media/${finalName}`, type: req.file.mimetype, size: req.file.size, name: req.file.originalname });
});

app.use('/api/auth', authRouter);

// Initialize Telegram Service
telegramService.init();
app.use('/api/telegram', telegramRouter);

// Initialize Slack Service
slackService.init();
app.use('/api/slack', slackRouter);

// Initialize Email Router
app.use('/api/email', emailRouter);

// GET /api/ai/health
app.get('/api/ai/health', (req, res) => {
  res.json({
    status: 'healthy',
    geminiConnected: !!process.env.GEMINI_API_KEY,
    version: '1.0.0'
  });
});

// GET /api/health (General Service Health)
app.get('/api/health', async (req, res) => {
  let isHealthy = true;
  
  // Check Slack connection
  const isSlackEnabled = !!process.env.SLACK_BOT_TOKEN;
  const slackActive = isSlackEnabled ? slackService.isConnected : false;
  if (isSlackEnabled && !slackActive) isHealthy = false;

  // Check Telegram connection
  const isTelegramEnabled = !!process.env.TELEGRAM_BOT_TOKEN;
  const telegramActive = isTelegramEnabled ? telegramService.isConnected : false;
  if (isTelegramEnabled && !telegramActive) isHealthy = false;

  // Check Email (IMAP/SMTP)
  let emailActive = false;
  const isEmailEnabled = !!process.env.EMAIL_HOST || emailService.isConfigured;
  if (emailService.isConfigured) {
    try {
      // Create a quick IMAP connection test to satisfy the requirement
      const imapClient = await emailService.getImapClient();
      await imapClient.logout();
      emailActive = true;
    } catch (e) {
      emailActive = false;
      isHealthy = false;
    }
  } else if (isEmailEnabled) {
    isHealthy = false;
  }

  const statusCode = isHealthy ? 200 : 503;
  
  res.status(statusCode).json({
    status: isHealthy ? 'ok' : 'error',
    timestamp: new Date().toISOString(),
    services: {
      telegram: telegramActive,
      slack: slackActive,
      email: emailActive,
      db: !!process.env.DATABASE_URL
    }
  });
});

// POST /api/ai/summarize
app.post('/api/ai/summarize', validate(SummarizeRequestSchema), async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { messages, contactName, options } = req.body;
    
    // Sanitize and format messages
    const sanitizedMessages = messages.map(m => ({
      timestamp: m.timestamp,
      sender: m.sender === 'me' ? 'Me' : contactName,
      content: sanitize(m.content)
    }));
    
    const historyText = sanitizedMessages
      .map(m => `[${m.timestamp}] ${m.sender}: ${m.content}`)
      .join('\n');
    
    const prompt = `You are a helpful assistant for a unified messaging app.
Analyze the following conversation history between "Me" (the user) and "${contactName}".
Provide a concise summary in markdown format with:
- **TL;DR**: One sentence overview.
- **Key Topics**: Bullet points of main subjects discussed.
- **Action Items**: Any tasks or follow-ups mentioned (if any).

Conversation History:
${historyText}`;

    const model = ai.getGenerativeModel({ model: 'gemini-3-flash-preview' });
    const response = await model.generateContent(prompt);
    
    const tokensUsed = response.response.usageMetadata?.totalTokenCount || 0;
    const summaryText = response.response.text();
    
    logger.info({
      endpoint: '/summarize',
      tokensUsed,
      latencyMs: Date.now() - startTime
    }, 'Summarize completed');
    
    res.json({
      summary: summaryText || 'No summary available.',
      tokensUsed,
      cached: false
    });
    
  } catch (error) {
    logger.error({ error: error.message }, 'Summarize error');
    res.status(502).json({ error: 'AI service temporarily unavailable' });
  }
});

// Error handler
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
