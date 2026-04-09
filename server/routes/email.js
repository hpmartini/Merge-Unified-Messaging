import express from 'express';
import { emailService } from '../services/emailService.js';

export const emailRouter = express.Router();

// Check if email service is configured
const checkConfig = (req, res, next) => {
  if (!emailService.isConfigured) {
    return res.status(503).json({ error: 'Email service is not configured.' });
  }
  next();
};

// GET /api/email/chats
emailRouter.get('/chats', checkConfig, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit, 10) || 20;
    const chats = await emailService.getRecentChats(limit);
    res.json(chats);
  } catch (error) {
    console.error('Error fetching email chats:', error);
    res.status(500).json({ error: 'Failed to fetch email chats' });
  }
});

// GET /api/email/chats/:chatId/messages
// Using IMAP UID as chatId for simplicity in this integration phase
emailRouter.get('/chats/:chatId/messages', checkConfig, async (req, res) => {
  try {
    const { chatId } = req.params;
    const message = await emailService.getMessageDetails(chatId);
    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }
    // Return in an array to match messaging chat semantics
    res.json([message]);
  } catch (error) {
    console.error('Error fetching email message details:', error);
    res.status(500).json({ error: 'Failed to fetch message details' });
  }
});

// POST /api/email/messages
emailRouter.post('/messages', checkConfig, async (req, res) => {
  try {
    const { to, subject, text, html } = req.body;
    if (!to || (!text && !html)) {
      return res.status(400).json({ error: 'Missing required fields: to, and (text or html)' });
    }
    const info = await emailService.sendEmail(to, subject, text, html);
    res.json({ success: true, info });
  } catch (error) {
    console.error('Error sending email:', error);
    res.status(500).json({ error: 'Failed to send email' });
  }
});