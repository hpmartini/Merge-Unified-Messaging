import pkg from '@slack/bolt';
const { App } = pkg;
import pino from 'pino';
import { z } from 'zod';

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
});

const SlackEnvSchema = z.object({
  SLACK_BOT_TOKEN: z.string().startsWith('xoxb-', 'SLACK_BOT_TOKEN must start with xoxb-'),
  SLACK_APP_TOKEN: z.string().startsWith('xapp-', 'SLACK_APP_TOKEN must start with xapp-'),
  SLACK_SIGNING_SECRET: z.string().optional()
});

class SlackService {
  constructor() {
    this.app = null;
    this.messages = [];
    this.chats = new Map();
    this.userProfiles = new Map();
    this.isConnected = false;
  }

  init() {
    try {
      const env = SlackEnvSchema.parse(process.env);
      
      this.app = new App({
        token: env.SLACK_BOT_TOKEN,
        appToken: env.SLACK_APP_TOKEN,
        socketMode: true,
      });

      // Handle message events
      this.app.message(async ({ message, say }) => {
        // Skip bot messages or messages without text
        if (message.bot_id || !message.text) return;
        
        await this.handleIncomingMessage(message, message.channel);
      });

      // Handle mentions
      this.app.event('app_mention', async ({ event, say }) => {
        if (!event.text) return;
        await this.handleIncomingMessage(event, event.channel);
      });

      this.app.start().then(() => {
        this.isConnected = true;
        logger.info('⚡️ Slack Bolt App is running in Socket Mode!');
      }).catch(err => {
        logger.error({ err: err.message }, 'Failed to start Slack Bolt app');
      });

    } catch (err) {
      if (err instanceof z.ZodError) {
        logger.warn('Slack environment variables validation failed. Slack service disabled.');
      } else {
        logger.error({ err: err.message }, 'Failed to initialize Slack service');
      }
    }
  }

  async getUserProfile(userId) {
    if (!userId) return { name: 'Unknown', avatar: null };
    
    if (this.userProfiles.has(userId)) {
      return this.userProfiles.get(userId);
    }

    try {
      if (!this.app || !this.app.client) return { name: 'Unknown', avatar: null };

      const result = await this.app.client.users.info({ user: userId });
      if (result.ok && result.user) {
        const profile = {
          name: result.user.real_name || result.user.name,
          avatar: result.user.profile?.image_48 || null
        };
        this.userProfiles.set(userId, profile);
        return profile;
      }
    } catch (error) {
      logger.error({ error: error.message, userId }, 'Failed to fetch Slack user profile');
    }
    
    return { name: userId, avatar: null };
  }

  async handleIncomingMessage(msg, channelId) {
    const userProfile = await this.getUserProfile(msg.user);
    
    const formattedMsg = {
      id: msg.ts,
      chatId: channelId,
      threadId: msg.thread_ts || null,
      text: msg.text,
      sender: 'other',
      senderName: userProfile.name,
      avatar: userProfile.avatar,
      timestamp: new Date(parseFloat(msg.ts) * 1000).toISOString(),
      platform: 'slack'
    };

    this.messages.push(formattedMsg);
    logger.info({ chatId: channelId, text: msg.text }, 'New Slack message received');
    
    // In a real app with WebSockets, we would broadcast here:
    // broadcastMsg(formattedMsg);
  }

  async sendMessage(chatId, text, threadTs = null) {
    if (!this.app || !this.isConnected) {
      throw new Error('Slack bot is not connected');
    }
    
    try {
      const options = {
        channel: chatId,
        text: text
      };
      
      if (threadTs) {
        options.thread_ts = threadTs;
      }

      const result = await this.app.client.chat.postMessage(options);
      
      if (result.ok) {
        const sentMsg = result.message;
        const formattedMsg = {
          id: result.ts,
          chatId: chatId,
          threadId: sentMsg.thread_ts || null,
          text: sentMsg.text,
          sender: 'me',
          senderName: 'Me',
          timestamp: new Date(parseFloat(result.ts) * 1000).toISOString(),
          platform: 'slack'
        };
        this.messages.push(formattedMsg);
        return formattedMsg;
      } else {
        throw new Error(result.error);
      }
    } catch (err) {
      logger.error({ err: err.message, chatId }, 'Failed to send Slack message');
      throw err;
    }
  }

  getMessages(chatId) {
    if (!chatId) return this.messages;
    return this.messages.filter(m => m.chatId === chatId);
  }
}

export const slackService = new SlackService();
