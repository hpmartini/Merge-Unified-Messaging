import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MEDIA_DIR = path.join(__dirname, '..', 'data', 'media');
if (!fs.existsSync(MEDIA_DIR)) fs.mkdirSync(MEDIA_DIR, { recursive: true });
import pkg from '@slack/bolt';
const { App } = pkg;
import pino from 'pino';
import { z } from 'zod';

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
});

const SlackEnvSchema = z.object({
  SLACK_BOT_TOKEN: z.string().startsWith('xoxb-', 'SLACK_BOT_TOKEN must start with xoxb-').min(20, 'SLACK_BOT_TOKEN is too short'),
  SLACK_APP_TOKEN: z.string().startsWith('xapp-', 'SLACK_APP_TOKEN must start with xapp-').min(20, 'SLACK_APP_TOKEN is too short'),
  SLACK_SIGNING_SECRET: z.string().min(32, 'SLACK_SIGNING_SECRET must be at least 32 characters').optional()
});

class SlackService {
  async sendReaction(chatId, messageId, reaction) {
    if (!this.app || !this.isConnected) return false;
    try {
      await this.app.client.reactions.add({ channel: chatId, name: reaction, timestamp: messageId });
      return true;
    } catch (err) {
      console.error('Failed to send Slack reaction', err);
      return false;
    }
  }

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
      
      this.app.event('reaction_added', async ({ event }) => {
        const msgId = event.item.ts;
        const chatId = event.item.channel;
        const emoji = event.reaction;
        
        const msg = this.messages.find(m => m.id === msgId && m.chatId === chatId);
        if (msg) {
          if (!msg.reactions) msg.reactions = [];
          msg.reactions.push({ emoji, sender: event.user });
        }
      });

      this.app.message(async ({ message, say }) => {
        // Skip bot messages
        if (message.bot_id) return;
        if (!message.text && (!message.files || message.files.length === 0)) return;
        
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
          name: result.user.real_name || result.user.profile?.real_name || result.user.name,
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
    let attachments = [];
    
    if (msg.files && msg.files.length > 0 && this.app && this.app.client) {
      for (const file of msg.files) {
        if (file.url_private_download) {
          try {
            const response = await fetch(file.url_private_download, {
              headers: {
                Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}`
              }
            });
            const buffer = await response.arrayBuffer();
            const fileName = file.name || `${file.id}.${file.filetype || 'dat'}`;
            const finalName = `${file.id}_${fileName}`;
            const finalPath = path.join(MEDIA_DIR, finalName);
            fs.writeFileSync(finalPath, Buffer.from(buffer));
            
            const mediaType = file.mimetype?.startsWith('image') ? 'image' : file.mimetype?.startsWith('video') ? 'video' : file.mimetype?.startsWith('audio') ? 'audio' : 'document';
            attachments.push({
              id: file.id,
              type: mediaType === 'image' ? 'image' : 'document',
              mediaType,
              url: `/media/${finalName}`,
              name: fileName,
              size: (file.size || 0).toString(),
              mimetype: file.mimetype
            });
          } catch (err) {
            logger.error({ err: err.message }, 'Failed to download Slack file');
          }
        }
      }
    }
    
    const formattedMsg = {
      id: msg.ts,
      chatId: channelId,
      threadId: msg.thread_ts || null,
      text: msg.text || '',
      attachments: attachments.length > 0 ? attachments : undefined,
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

  async sendMessage(chatId, text, threadTs = null, attachments = []) {
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

      let result;
      if (attachments && attachments.length > 0) {
        const att = attachments[0];
        const fileName = att.url.split('/').pop();
        const filePath = path.join(MEDIA_DIR, fileName);
        if (fs.existsSync(filePath)) {
          // Slack bolt files.uploadV2
          result = await this.app.client.files.uploadV2({
            channel_id: chatId,
            initial_comment: text,
            thread_ts: threadTs,
            file: fs.createReadStream(filePath),
            filename: fileName
          });
          // map result so it looks like postMessage
          result = { ok: true, ts: Date.now().toString() / 1000, message: { text, thread_ts: threadTs } };
        } else {
          result = await this.app.client.chat.postMessage(options);
        }
      } else {
        result = await this.app.client.chat.postMessage(options);
      }
      
      if (result.ok) {
        const sentMsg = result.message;
        const formattedMsg = {
          id: result.ts,
          chatId: chatId,
          threadId: sentMsg.thread_ts || null,
          text: sentMsg.text || text || '',
        attachments: attachments.length > 0 ? attachments : undefined,
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
