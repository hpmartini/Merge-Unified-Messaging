import { Router } from 'express';
import { validate } from '../utils/validate.js';
import { SummarizeRequestSchema } from '../schemas/aiSchemas.js';
import { aiService } from '../services/aiService.js';
import pino from 'pino';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });
export const aiRouter = Router();

aiRouter.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    geminiConnected: aiService.isConfigured,
    version: '1.0.0'
  });
});

aiRouter.post('/summarize', validate(SummarizeRequestSchema), async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { messages, contactName, options } = req.body;
    
    if (!aiService.isConfigured) {
      return res.status(503).json({ error: 'AI not configured' });
    }

    const { tokensUsed, summaryText } = await aiService.summarize(messages, contactName, options);
    
    logger.info({
      endpoint: '/summarize',
      tokensUsed,
      latencyMs: Date.now() - startTime
    }, 'Summarize completed');
    
    res.json({
      summary: summaryText,
      tokensUsed,
      cached: false
    });
    
  } catch (error) {
    logger.error({ error: error.message }, 'Summarize error');
    res.status(502).json({ error: 'AI service temporarily unavailable' });
  }
});
