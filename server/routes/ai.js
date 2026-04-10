import express from 'express';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import { aiService } from '../services/aiService.js';

export const aiRouter = express.Router();

const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: parseInt(process.env.AI_RATE_LIMIT_REQUESTS) || 60,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({ 
      error: 'Rate limit exceeded', 
      retryAfter: Math.ceil(req.rateLimit.resetTime / 1000)
    });
  }
});
aiRouter.use(limiter);

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

function validate(schema) {
  return (req, res, next) => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof z.ZodError || error.name === 'ZodError') {
        return res.status(400).json({
          error: 'Validation failed',
          details: (error.errors || error.issues || []).map(e => ({
            path: e.path ? e.path.join('.') : '',
            message: e.message
          }))
        });
      }
      next(error);
    }
  };
}

aiRouter.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    geminiConnected: aiService.isConfigured,
    version: '1.0.0'
  });
});

aiRouter.post('/summarize', validate(SummarizeRequestSchema), async (req, res) => {
  try {
    const { messages, contactName, options } = req.body;
    const result = await aiService.summarize(messages, contactName, options);
    res.json({
      summary: result.summaryText,
      tokensUsed: result.tokensUsed,
      cached: false
    });
  } catch (error) {
    res.status(502).json({ error: 'AI service temporarily unavailable' });
  }
});
