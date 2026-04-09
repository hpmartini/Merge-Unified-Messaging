import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';

// Mock imapflow and nodemailer before importing the service
vi.mock('imapflow', () => {
  return {
    ImapFlow: class {
      constructor(options) {
        this.options = options;
      }
      async connect() {}
      async logout() {}
      async getMailboxLock() {
        return { release: () => {} };
      }
      async *fetch() {
        yield {
          uid: 1,
          envelope: { messageId: 'msg-1', from: [{ address: 'sender@example.com' }], subject: 'Test Subject' },
          internalDate: new Date('2023-01-01'),
          flags: new Set(['\\Seen'])
        };
      }
      async fetchOne() {
        return {
          uid: 1,
          source: 'From: sender@example.com\r\nTo: user@example.com\r\nSubject: Test Subject\r\n\r\nTest body',
          envelope: { messageId: 'msg-1', from: [{ address: 'sender@example.com' }], subject: 'Test Subject' },
          internalDate: new Date('2023-01-01')
        };
      }
    }
  };
});

vi.mock('nodemailer', () => {
  return {
    default: {
      createTransport: vi.fn().mockReturnValue({
        sendMail: vi.fn().mockResolvedValue({ messageId: 'sent-123' })
      })
    }
  };
});

// Import the service after mocking
import { emailService } from '../server/services/emailService.js';
import { emailRouter } from '../server/routes/email.js';

describe('Email Service and Routes', () => {
  let app;

  beforeEach(() => {
    // Reset process.env and service state for clean testing
    process.env.EMAIL_USER = 'test@example.com';
    process.env.EMAIL_PASS = 'password123';
    process.env.IMAP_HOST = 'imap.example.com';
    process.env.SMTP_HOST = 'smtp.example.com';

    // To simulate different env configs:
    emailService.isConfigured = true;
    emailService.emailUser = 'test@example.com';
    
    // We need to initialize the mocked transporter because service initialization happened on import.
    import('nodemailer').then(nodemailer => {
      emailService.transporter = nodemailer.default.createTransport();
    });

    app = express();
    app.use(express.json());
    app.use('/api/email', emailRouter);
  });

  describe('Service Tests', () => {
    it('should correctly fetch recent chats', async () => {
      const chats = await emailService.getRecentChats();
      expect(chats).toBeInstanceOf(Array);
      expect(chats.length).toBe(1);
      expect(chats[0].subject).toBe('Test Subject');
      expect(chats[0].from).toBe('sender@example.com');
    });

    it('should correctly fetch message details', async () => {
      const msg = await emailService.getMessageDetails('1');
      expect(msg.subject).toBe('Test Subject');
      expect(msg.text).toContain('Test body');
    });

    it('should successfully mock sending an email', async () => {
      const info = await emailService.sendEmail('to@example.com', 'Subj', 'Body text', null);
      expect(info.messageId).toBe('sent-123');
    });
  });

  describe('Route Tests', () => {
    it('GET /api/email/chats should return 200 and list chats', async () => {
      const res = await request(app).get('/api/email/chats');
      expect(res.status).toBe(200);
      expect(res.body[0].subject).toBe('Test Subject');
    });

    it('GET /api/email/chats/:chatId/messages should return 200 and message details', async () => {
      const res = await request(app).get('/api/email/chats/1/messages');
      expect(res.status).toBe(200);
      expect(res.body).toBeInstanceOf(Array);
      expect(res.body[0].subject).toBe('Test Subject');
    });

    it('POST /api/email/messages should fail validation without email', async () => {
      const res = await request(app)
        .post('/api/email/messages')
        .send({ subject: 'No to' });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation failed');
    });

    it('POST /api/email/messages should fail validation with invalid email', async () => {
      const res = await request(app)
        .post('/api/email/messages')
        .send({ to: 'invalid-email', text: 'Hello' });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation failed');
    });

    it('POST /api/email/messages should succeed with valid payload', async () => {
      const res = await request(app)
        .post('/api/email/messages')
        .send({ to: 'recipient@example.com', text: 'Hello World' });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.info.messageId).toBe('sent-123');
    });
    
    it('should return 503 if service is not configured', async () => {
      emailService.isConfigured = false;
      const res = await request(app).get('/api/email/chats');
      expect(res.status).toBe(503);
      expect(res.body.error).toBe('Email service is not configured.');
    });
  });
});
