const fs = require('fs');
const path = require('path');

// 1. PATCH ai-proxy.js
let aiProxy = fs.readFileSync('server/ai-proxy.js', 'utf8');
const reactRoute = `
// POST /api/messages/:id/react
app.post('/api/messages/:id/react', async (req, res) => {
  try {
    const messageId = req.params.id;
    const { platform, chatId, reaction } = req.body;
    
    if (!platform || !chatId || !reaction) {
      return res.status(400).json({ error: 'Missing required fields: platform, chatId, reaction' });
    }

    let success = false;
    if (platform === 'telegram') {
      success = await telegramService.sendReaction(chatId, messageId, reaction);
    } else if (platform === 'slack') {
      success = await slackService.sendReaction(chatId, messageId, reaction);
    } else if (platform === 'whatsapp') {
      const { whatsappService } = await import('./services/whatsappService.js');
      success = await whatsappService.sendReaction(chatId, messageId, reaction);
    } else if (platform === 'signal') {
      const { signalService } = await import('./services/signalService.js');
      success = await signalService.sendReaction(chatId, messageId, reaction);
    } else {
      return res.status(400).json({ error: 'Unsupported platform' });
    }

    res.json({ success });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
`;

if (!aiProxy.includes('/api/messages/:id/react')) {
  aiProxy = aiProxy.replace('app.use((err, req, res, next) => {', reactRoute + '\napp.use((err, req, res, next) => {');
  fs.writeFileSync('server/ai-proxy.js', aiProxy);
}

// 2. PATCH telegramService.js
let tgService = fs.readFileSync('server/services/telegramService.js', 'utf8');
if (!tgService.includes('message_reaction')) {
  tgService = tgService.replace("this.bot.on('message', (ctx) => {", `
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

      this.bot.on('message', (ctx) => {`);
  
  tgService = tgService.replace('class TelegramService {', `class TelegramService {
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
`);
  tgService = tgService.replace("timestamp: new Date(msg.date * 1000).toISOString(),", "timestamp: new Date(msg.date * 1000).toISOString(),\n              reactions: [],");
  fs.writeFileSync('server/services/telegramService.js', tgService);
}

// 3. PATCH slackService.js
let slService = fs.readFileSync('server/services/slackService.js', 'utf8');
if (!slService.includes('reaction_added')) {
  slService = slService.replace("this.app.message(async ({ message, say }) => {", `
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

      this.app.message(async ({ message, say }) => {`);
  slService = slService.replace('class SlackService {', `class SlackService {
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
`);
  slService = slService.replace("timestamp: new Date(ts * 1000).toISOString(),", "timestamp: new Date(ts * 1000).toISOString(),\n            reactions: [],");
  fs.writeFileSync('server/services/slackService.js', slService);
}

console.log('Patches applied.');
