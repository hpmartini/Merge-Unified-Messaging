import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import pino from 'pino';
import pinoHttp from 'pino-http';
import { createServer } from 'http';
import { config } from 'dotenv';

// Load environment variables
config({ path: '.env.local' });
config({ path: '.env' });

// Initialize logger
const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: process.env.NODE_ENV !== 'production' 
    ? { target: 'pino-pretty' } 
    : undefined
});

const app = express();
const PORT = parseInt(process.env.AI_PROXY_PORT) || 3044;

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
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// HTTP request logging
app.use(pinoHttp({ logger }));

// JSON parsing
app.use(express.json({ limit: '1mb' }));

// ============================================
// ROUTES
// ============================================

// GET /api/ai/health
app.get('/api/ai/health', (req, res) => {
  res.json({
    status: 'healthy',
    geminiConnected: !!process.env.GEMINI_API_KEY,
    version: '1.0.0'
  });
});

// Error handler
app.use((err, req, res, next) => {
  logger.error({ error: err.message, stack: err.stack }, 'Unhandled error');
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
const server = createServer(app);
server.listen(PORT, () => {
  logger.info({ port: PORT }, 'AI Proxy server started');
});

export { app }; // For testing
