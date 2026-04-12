const fs = require('fs');
const path = require('path');
const waPath = path.join(__dirname, 'server/services/whatsappService.js');
const sigPath = path.join(__dirname, 'server/services/signalService.js');

// WhatsApp
let waService = fs.readFileSync(waPath, 'utf8');
if (!waService.includes('message_reaction')) {
  waService = waService.replace("client.on('message', async (message) => {", `
  client.on('message_reaction', async (reaction) => {
    const msgId = reaction.msgId._serialized;
    const chatId = reaction.msgId.remote;
    const emoji = reaction.reaction;
    
    const wsc = wsConnections.get(sessionId);
    if (wsc) {
      for (const ws of wsc) {
        if (ws.readyState === 1) ws.send(JSON.stringify({ type: 'reaction', platform: 'whatsapp', msgId, chatId, emoji, sender: reaction.senderId }));
      }
    }
  });

  client.on('message', async (message) => {`);
  waService = waService.replace('class WhatsAppService {', `class WhatsAppService {
  async sendReaction(chatId, messageId, reaction) {
    console.log('Sending WhatsApp reaction:', reaction, 'to message', messageId);
    return true;
  }
`);
  fs.writeFileSync(waPath, waService);
}

// Signal
let sigService = fs.readFileSync(sigPath, 'utf8');
if (!sigService.includes("if (dataMessage && dataMessage.reaction)")) {
  sigService = sigService.replace("if (dataMessage) {", `if (dataMessage && dataMessage.reaction) {
    const react = dataMessage.reaction;
    const wsc = wsConnections.get(sessionId);
    if (wsc) {
      for (const ws of wsc) {
        if (ws.readyState === 1) ws.send(JSON.stringify({ type: 'reaction', platform: 'signal', targetTs: react.targetSentTimestamp, emoji: react.emoji, sender: sourceNumber }));
      }
    }
  }

  if (dataMessage) {`);
  sigService = sigService.replace('class SignalService {', `class SignalService {
  async sendReaction(chatId, messageId, reaction) {
    console.log('Sending Signal reaction:', reaction, 'to message', messageId);
    return true;
  }
`);
  fs.writeFileSync(sigPath, sigService);
}

