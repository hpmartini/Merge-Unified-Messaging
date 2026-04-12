import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { telegramRouter } from '../server/routes/telegram.js';
import { telegramService } from '../server/services/telegramService.js';
import { z } from 'zod';

// Mock the telegraf module and service completely
vi.mock('../server/services/telegramService.js', () => ({
  telegramService: {
    getChats: vi.fn(),
    getMessages: vi.fn(),
    sendMessage: vi.fn(),
  }
}));

describe('Telegram Routes', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/telegram', telegramRouter);
    vi.clearAllMocks();
  });

  describe('GET /api/telegram/chats', () => {
    it('should return a list of chats', async () => {
      const mockChats = [{ id: 123, title: 'Test Chat' }];
      vi.mocked(telegramService.getChats).mockReturnValue(mockChats);

      const res = await request(app).get('/api/telegram/chats');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ chats: mockChats });
    });

    it('should handle errors from getChats', async () => {
      vi.mocked(telegramService.getChats).mockImplementation(() => {
        throw new Error('Service error');
      });

      const res = await request(app).get('/api/telegram/chats');
      expect(res.status).toBe(500);
      expect(res.body).toEqual({ error: 'Service error' });
    });
  });

  describe('GET /api/telegram/chats/:chatId/messages', () => {
    it('should return messages for a specific chat', async () => {
      const mockMessages = [{ id: 1, text: 'Hello' }];
      vi.mocked(telegramService.getMessages).mockReturnValue(mockMessages);

      const res = await request(app).get('/api/telegram/chats/123/messages');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ messages: mockMessages });
      expect(telegramService.getMessages).toHaveBeenCalledWith('123');
    });
  });

  describe('POST /api/telegram/messages', () => {
    it('should send a message successfully', async () => {
      const mockResponse = { id: 2, text: 'World' };
      vi.mocked(telegramService.sendMessage).mockResolvedValue(mockResponse);

      const res = await request(app)
        .post('/api/telegram/messages')
        .send({ chatId: '123', text: 'World' });

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ message: mockResponse });
      expect(telegramService.sendMessage).toHaveBeenCalledWith('123', 'World', { attachments: undefined });
    });

    it('should validate request body with Zod and return 400', async () => {
      const res = await request(app)
        .post('/api/telegram/messages')
        .send({ chatId: '123' }); // Missing text

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation failed');
    });
  });
});
