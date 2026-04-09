import express from 'express';
import { z } from 'zod';
import { telegramService } from '../services/telegramService.js';

const router = express.Router();

// Get all tracked chats
router.get('/chats', (req, res) => {
  try {
    const chats = telegramService.getChats();
    res.json({ chats });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get messages for a specific chat
router.get('/chats/:chatId/messages', (req, res) => {
  try {
    const { chatId } = req.params;
    const messages = telegramService.getMessages(chatId);
    res.json({ messages });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Schema for sending a message
const SendMessageSchema = z.object({
  chatId: z.union([z.string(), z.number()]),
  text: z.string().min(1).max(4096)
});

// Send a message
router.post('/messages', async (req, res) => {
  try {
    const { chatId, text } = SendMessageSchema.parse(req.body);
    const message = await telegramService.sendMessage(chatId, text);
    res.json({ message });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    res.status(500).json({ error: error.message });
  }
});

export const telegramRouter = router;
