import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { slackRouter } from '../server/routes/slack.js';
import { slackService } from '../server/services/slackService.js';

vi.mock('../server/services/slackService.js', () => ({
  slackService: {
    sendMessage: vi.fn(),
    getMessages: vi.fn()
  }
}));

const app = express();
app.use(express.json());
app.use('/slack', slackRouter);

describe('Slack Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /slack/messages', () => {
    it('should validate missing chatId', async () => {
      const res = await request(app)
        .post('/slack/messages')
        .send({ text: 'Hello' });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation error');
    });

    it('should send a message successfully', async () => {
      const mockMsg = { id: '123', text: 'Hello', chatId: 'C123' };
      slackService.sendMessage.mockResolvedValue(mockMsg);

      const res = await request(app)
        .post('/slack/messages')
        .send({ chatId: 'C123', text: 'Hello' });
      
      expect(res.status).toBe(200);
      expect(res.body).toEqual(mockMsg);
      expect(slackService.sendMessage).toHaveBeenCalledWith('C123', 'Hello', undefined);
    });

    it('should handle service errors', async () => {
      slackService.sendMessage.mockRejectedValue(new Error('Service down'));

      const res = await request(app)
        .post('/slack/messages')
        .send({ chatId: 'C123', text: 'Hello' });
      
      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Failed to send message');
    });
  });

  describe('GET /slack/messages', () => {
    it('should return messages', async () => {
      const mockMessages = [{ id: '123', text: 'Hello' }];
      slackService.getMessages.mockReturnValue(mockMessages);

      const res = await request(app)
        .get('/slack/messages')
        .query({ chatId: 'C123' });
      
      expect(res.status).toBe(200);
      expect(res.body.messages).toEqual(mockMessages);
      expect(slackService.getMessages).toHaveBeenCalledWith('C123');
    });
  });
});