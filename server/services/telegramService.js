import { Telegraf } from 'telegraf';
import pino from 'pino';

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
});

class TelegramService {
  constructor() {
    this.bot = null;
    this.messages = [];
    this.chats = new Map();
    this.isConnected = false;
  }

  init() {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) {
      logger.warn('TELEGRAM_BOT_TOKEN not set, Telegram service disabled');
      return;
    }

    try {
      this.bot = new Telegraf(token);

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
        if (msg.text) {
          const formattedMsg = {
            id: msg.message_id,
            chatId: ctx.chat.id,
            text: msg.text,
            sender: msg.from.id === ctx.botInfo.id ? 'me' : 'other',
            senderName: msg.from.username || msg.from.first_name || 'Unknown',
            timestamp: new Date(msg.date * 1000).toISOString(),
            platform: 'telegram'
          };
          this.messages.push(formattedMsg);
          logger.info({ chatId: ctx.chat.id, text: msg.text }, 'New Telegram message received');
        }
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
      logger.error({ err: err.message }, 'Failed to initialize Telegram service');
    }
  }

  async sendMessage(chatId, text) {
    if (!this.bot || !this.isConnected) {
      throw new Error('Telegram bot is not connected');
    }
    
    try {
      const sentMsg = await this.bot.telegram.sendMessage(chatId, text);
      
      const formattedMsg = {
        id: sentMsg.message_id,
        chatId: chatId,
        text: sentMsg.text,
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
