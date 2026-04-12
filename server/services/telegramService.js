import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MEDIA_DIR = path.join(__dirname, '..', 'data', 'media');
if (!fs.existsSync(MEDIA_DIR)) fs.mkdirSync(MEDIA_DIR, { recursive: true });
import { Telegraf } from 'telegraf';
import pino from 'pino';
import { z } from 'zod';

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
});

const TelegramEnvSchema = z.object({
  TELEGRAM_BOT_TOKEN: z.string().min(1, 'TELEGRAM_BOT_TOKEN is required'),
  TELEGRAM_API_ID: z.string().optional(),
  TELEGRAM_API_HASH: z.string().optional()
});

class TelegramService {
  async sendReaction(chatId, messageId, reaction) {
    if (!this.bot || !this.isConnected) return false;
    try {
      await this.bot.telegram.setMessageReaction(chatId, messageId, [{ type: 'emoji', emoji: reaction }]);
      return true;
    } catch (err) {
      console.error('Failed to send Telegram reaction', err);
      return false;
    }
  }

  constructor() {
    this.bot = null;
    this.messages = [];
    this.chats = new Map();
    this.isConnected = false;
  }

  init() {
    try {
      // Validate env vars securely without logging secrets
      const env = TelegramEnvSchema.parse(process.env);
      const token = env.TELEGRAM_BOT_TOKEN;

      this.bot = new Telegraf(token);

      
      this.bot.on('message_reaction', (ctx) => {
        const reactionMsg = ctx.update.message_reaction;
        const msgId = reactionMsg.message_id;
        const chatId = reactionMsg.chat.id;
        const emojis = reactionMsg.new_reaction.map(r => r.emoji).join('');
        
        // Broadcast generic WebSocket event if implemented or just update memory
        const msg = this.messages.find(m => m.id === msgId && m.chatId === chatId);
        if (msg) {
          if (!msg.reactions) msg.reactions = [];
          msg.reactions.push({ emoji: emojis, sender: reactionMsg.actor_chat ? reactionMsg.actor_chat.id : 'other' });
        }
      });

      this.bot.on('message', (ctx) => {
        const msg = ctx.message;
        
        // Basic chat tracking
        if (!this.chats.has(ctx.chat.id)) {
          this.chats.set(ctx.chat.id, {
            id: ctx.chat.id,
            title: ctx.chat.title || ctx.chat.username || ctx.chat.first_name || 'Unknown',
            type: ctx.chat.type,
          });
        }

        // Basic message tracking
        (async () => {
          let attachments = [];
          if (msg.photo || msg.document || msg.video || msg.audio || msg.voice) {
            const fileObj = msg.photo ? msg.photo[msg.photo.length - 1] : (msg.document || msg.video || msg.audio || msg.voice);
            try {
              const fileUrl = await ctx.telegram.getFileLink(fileObj.file_id);
              const response = await fetch(fileUrl);
              const buffer = await response.arrayBuffer();
              const fileName = fileObj.file_name || `${fileObj.file_id}.${fileUrl.pathname.split('.').pop() || 'dat'}`;
              const fileId = `${Date.now()}-${fileObj.file_id}`;
              const finalName = `${fileId}_${fileName}`;
              const finalPath = path.join(MEDIA_DIR, finalName);
              fs.writeFileSync(finalPath, Buffer.from(buffer));
              
              const mediaType = msg.photo ? 'image' : msg.video ? 'video' : msg.audio || msg.voice ? 'audio' : 'document';
              attachments.push({
                id: fileId,
                type: mediaType === 'image' ? 'image' : 'document',
                mediaType,
                url: `/media/${finalName}`,
                name: fileName,
                size: (fileObj.file_size || 0).toString(),
                mimetype: fileObj.mime_type
              });
            } catch (err) {
              logger.error({ err: err.message }, 'Failed to download Telegram media');
            }
          }

          if (msg.text || msg.caption || attachments.length > 0) {
            const formattedMsg = {
              id: msg.message_id,
              chatId: ctx.chat.id,
              text: msg.text || msg.caption || '',
              sender: msg.from.id === ctx.botInfo.id ? 'me' : 'other',
              senderName: msg.from.username || msg.from.first_name || 'Unknown',
              timestamp: new Date(msg.date * 1000).toISOString(),
              reactions: [],
              platform: 'telegram',
              attachments: attachments.length > 0 ? attachments : undefined
            };
            this.messages.push(formattedMsg);
            logger.info({ chatId: ctx.chat.id, text: formattedMsg.text, hasMedia: attachments.length > 0 }, 'New Telegram message received');
          }
        })();
      });

      this.bot.launch().then(() => {
        this.isConnected = true;
        logger.info('Telegram Bot successfully launched');
      }).catch(err => {
        logger.error({ err: err.message }, 'Failed to launch Telegram bot');
      });

      // Enable graceful stop
      process.once('SIGINT', () => this.bot.stop('SIGINT'));
      process.once('SIGTERM', () => this.bot.stop('SIGTERM'));
    } catch (err) {
      if (err instanceof z.ZodError) {
        // Log validation error safely (without values)
        logger.warn('Telegram environment variables validation failed. Telegram service disabled.');
      } else {
        logger.error({ err: err.message }, 'Failed to initialize Telegram service');
      }
    }
  }

  async sendMessage(chatId, text, options = {}) {
    if (!this.bot || !this.isConnected) {
      throw new Error('Telegram bot is not connected');
    }
    
    try {
      let sentMsg;
      if (options.attachments && options.attachments.length > 0) {
        const att = options.attachments[0];
        const fileName = att.url.split('/').pop();
        const filePath = path.join(MEDIA_DIR, fileName);
        if (fs.existsSync(filePath)) {
          if (att.type === 'image' || att.mediaType === 'image') {
            sentMsg = await this.bot.telegram.sendPhoto(chatId, { source: fs.createReadStream(filePath) }, { caption: text });
          } else if (att.mediaType === 'video') {
            sentMsg = await this.bot.telegram.sendVideo(chatId, { source: fs.createReadStream(filePath) }, { caption: text });
          } else {
            sentMsg = await this.bot.telegram.sendDocument(chatId, { source: fs.createReadStream(filePath) }, { caption: text });
          }
        } else {
          sentMsg = await this.bot.telegram.sendMessage(chatId, text);
        }
      } else {
        sentMsg = await this.bot.telegram.sendMessage(chatId, text);
      }
      
      const formattedMsg = {
        id: sentMsg.message_id,
        chatId: chatId,
        text: sentMsg.text || sentMsg.caption || '',
        attachments: options.attachments,
        sender: 'me',
        senderName: 'Me',
        timestamp: new Date(sentMsg.date * 1000).toISOString(),
        platform: 'telegram'
      };
      this.messages.push(formattedMsg);
      return formattedMsg;
    } catch (err) {
      logger.error({ err: err.message, chatId }, 'Failed to send Telegram message');
      throw err;
    }
  }

  getChats() {
    return Array.from(this.chats.values());
  }

  getMessages(chatId) {
    if (!chatId) return this.messages;
    return this.messages.filter(m => m.chatId.toString() === chatId.toString());
  }
}

export const telegramService = new TelegramService();
