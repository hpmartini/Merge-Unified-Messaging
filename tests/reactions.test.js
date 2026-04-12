import { signToken } from '../server/auth/jwt.js';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../server/ai-proxy.js';
import { telegramService } from '../server/services/telegramService.js';
import { slackService } from '../server/services/slackService.js';

vi.mock('../server/services/telegramService.js', () => ({
  telegramService: {
    init: vi.fn(),
    isConnected: true,
    sendReaction: vi.fn().mockResolvedValue(true),
    messages: [
      { id: 'msg1', chatId: 'chat1', text: 'hello', platform: 'telegram', reactions: [] }
    ]
  }
}));

vi.mock('../server/services/slackService.js', () => ({
  slackService: {
    init: vi.fn(),
    isConnected: true,
    sendReaction: vi.fn().mockResolvedValue(true),
    messages: [
      { id: 'msg2', chatId: 'channel1', text: 'hi', platform: 'slack', reactions: [] }
    ]
  }
}));

describe('Reactions API', () => {
  beforeEach(() => { process.env.JWT_SECRET = 'test_secret'; });

  it('should expose POST /api/messages/:id/react', async () => {
    const res = await request(app)
      .post('/api/messages/msg1/react')
      .set('Authorization', `Bearer ${signToken({ id: 1, username: 'testuser' })}`)
      .send({ platform: 'telegram', chatId: 'chat1', reaction: '👍' });
      
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(telegramService.sendReaction).toHaveBeenCalledWith('chat1', 'msg1', '👍');
  });
});
