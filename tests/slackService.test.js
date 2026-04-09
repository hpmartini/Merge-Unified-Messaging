import { describe, it, expect, vi, beforeEach } from 'vitest';
import { z } from 'zod';
import { slackService } from '../server/services/slackService.js';

// Mock @slack/bolt
vi.mock('@slack/bolt', () => {
  class App {
    constructor() {
      this.client = {
        users: {
          info: vi.fn().mockResolvedValue({
            ok: true,
            user: { real_name: 'Test User', profile: { image_48: 'avatar.png' } }
          })
        },
        chat: {
          postMessage: vi.fn().mockResolvedValue({
            ok: true,
            ts: '1234567890.123',
            message: { text: 'Test Message', thread_ts: '1234567890.123' }
          })
        }
      };
    }
    message() {}
    event() {}
    async start() { return true; }
  }
  return { default: { App }, App };
});

describe('SlackService', () => {
  const validEnv = {
    SLACK_BOT_TOKEN: 'xoxb-1234',
    SLACK_APP_TOKEN: 'xapp-1234',
    SLACK_SIGNING_SECRET: '0123456789abcdef0123456789abcdef'
  };

  beforeEach(() => {
    vi.clearAllMocks();
    slackService.app = null;
    slackService.messages = [];
    slackService.chats = new Map();
    slackService.userProfiles = new Map();
    slackService.isConnected = false;
  });

  describe('init', () => {
    it('should validate environment variables and start app', async () => {
      process.env = { ...process.env, ...validEnv };
      slackService.init();
      expect(slackService.isConnected).toBe(false); // It starts asynchronously, wait for it
      await new Promise(resolve => setTimeout(resolve, 0));
      expect(slackService.isConnected).toBe(true);
    });

    it('should fail validation with invalid bot token', () => {
      process.env = { ...validEnv, SLACK_BOT_TOKEN: 'invalid' };
      slackService.init();
      expect(slackService.app).toBeNull();
    });

    it('should fail validation with missing signing secret', () => {
      process.env = { ...validEnv, SLACK_SIGNING_SECRET: 'short' };
      slackService.init();
      expect(slackService.app).toBeNull();
    });
  });

  describe('sendMessage', () => {
    it('should throw if not connected', async () => {
      await expect(slackService.sendMessage('channel', 'text')).rejects.toThrow('Slack bot is not connected');
    });

    it('should send message successfully', async () => {
      process.env = { ...process.env, ...validEnv };
      slackService.init();
      await new Promise(resolve => setTimeout(resolve, 0));
      
      const result = await slackService.sendMessage('channel1', 'Hello');
      expect(result.id).toBe('1234567890.123');
      expect(result.text).toBe('Test Message');
      expect(slackService.messages.length).toBe(1);
    });
  });

  describe('getUserProfile', () => {
    it('should fetch user profile', async () => {
      process.env = { ...process.env, ...validEnv };
      slackService.init();
      await new Promise(resolve => setTimeout(resolve, 0));

      const profile = await slackService.getUserProfile('U12345');
      expect(profile.name).toBe('Test User');
      expect(profile.avatar).toBe('avatar.png');
    });

    it('should return unknown if client not initialized', async () => {
      const profile = await slackService.getUserProfile('U12345');
      expect(profile.name).toBe('Unknown');
    });
  });

  describe('handleIncomingMessage', () => {
    it('should process and store incoming message', async () => {
      process.env = { ...process.env, ...validEnv };
      slackService.init();
      await new Promise(resolve => setTimeout(resolve, 0));

      const msg = {
        ts: '1234567890.123',
        text: 'Incoming test',
        user: 'U12345',
        thread_ts: null
      };

      await slackService.handleIncomingMessage(msg, 'C12345');
      const messages = slackService.getMessages('C12345');
      expect(messages.length).toBe(1);
      expect(messages[0].text).toBe('Incoming test');
      expect(messages[0].senderName).toBe('Test User');
    });
  });
});