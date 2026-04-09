import express from 'express';
import { z } from 'zod';
import { emailService } from '../services/emailService.js';

export const emailRouter = express.Router();

// Check if email service is configured
const checkConfig = (req, res, next) => {
  if (!emailService.isConfigured) {
    return res.status(503).json({ error: 'Email service is not configured.' });
  }
  next();
};

const sendEmailSchema = z.object({
  to: z.string().email('Invalid recipient email address'),
  subject: z.string().optional(),
  text: z.string().optional(),
  html: z.string().optional()
}).refine(data => data.text || data.html, {
  message: "Either 'text' or 'html' is required",
  path: ["text"]
});

// GET /api/email/chats
emailRouter.get('/chats', checkConfig, async (req, res) => {
  try {
    const limitSchema = z.string().regex(/^\d+$/).transform(Number).optional().default("20");
    const limit = limitSchema.parse(req.query.limit);
    
    const chats = await emailService.getRecentChats(limit);
    res.json(chats);
  } catch (error) {
    console.error('Error fetching email chats:', error);
    res.status(500).json({ error: 'Failed to fetch email chats' });
  }
});

// GET /api/email/chats/:chatId/messages
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
    const validatedData = sendEmailSchema.parse(req.body);
    const info = await emailService.sendEmail(
      validatedData.to,
      validatedData.subject,
      validatedData.text,
      validatedData.html
    );
    res.json({ success: true, info });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    console.error('Error sending email:', error);
    res.status(500).json({ error: 'Failed to send email' });
  }
});
