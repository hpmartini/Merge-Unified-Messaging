import { Router } from 'express';
import { z } from 'zod';
import { slackService } from '../services/slackService.js';
import pino from 'pino';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });
const router = Router();

const SendMessageSchema = z.object({
  chatId: z.string().min(1, 'chatId is required'),
  text: z.string().min(1, 'text is required'),
  threadId: z.string().optional()
});

router.post('/messages', async (req, res) => {
  try {
    const { chatId, text, threadId } = SendMessageSchema.parse(req.body);
    const sentMsg = await slackService.sendMessage(chatId, text, threadId);
    res.json(sentMsg);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: err.errors });
    }
    logger.error({ err: err.message }, 'Failed to send Slack message via API');
    res.status(500).json({ error: 'Failed to send message' });
  }
});

const GetMessagesSchema = z.object({
  chatId: z.string().optional()
});

router.get('/messages', (req, res) => {
  try {
    const { chatId } = GetMessagesSchema.parse(req.query);
    const messages = slackService.getMessages(chatId);
    res.json({ messages });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: err.errors });
    }
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

export const slackRouter = router;
