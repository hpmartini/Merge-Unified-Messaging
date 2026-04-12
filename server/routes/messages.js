import { Router } from 'express';
import { authenticate } from '../auth/middleware.js';
import { telegramService } from '../services/telegramService.js';
import { slackService } from '../services/slackService.js';

export const messagesRouter = Router();

messagesRouter.post('/:id/react', authenticate, async (req, res) => {
  try {
    const messageId = req.params.id;
    const { platform, chatId, reaction } = req.body;
    
    if (!platform || !chatId || !reaction) {
      return res.status(400).json({ error: 'Missing required fields: platform, chatId, reaction' });
    }

    if (typeof reaction !== 'string' || reaction.length > 10) {
      return res.status(400).json({ error: 'Invalid reaction format' });
    }

    let success = false;
    if (platform === 'telegram') {
      success = await telegramService.sendReaction(chatId, messageId, reaction);
    } else if (platform === 'slack') {
      success = await slackService.sendReaction(chatId, messageId, reaction);
    } else if (platform === 'whatsapp') {
      const { whatsappService } = await import('../services/whatsappService.js');
      success = await whatsappService.sendReaction(chatId, messageId, reaction);
    } else if (platform === 'signal') {
      const { signalService } = await import('../services/signalService.js');
      success = await signalService.sendReaction(chatId, messageId, reaction);
    } else {
      return res.status(400).json({ error: 'Unsupported platform' });
    }

    res.json({ success });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
