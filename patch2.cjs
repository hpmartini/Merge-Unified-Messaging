const fs = require('fs');
const path = require('path');
const waPath = path.join(__dirname, 'server/services/whatsappService.js');
const sigPath = path.join(__dirname, 'server/services/signalService.js');

let waService = fs.readFileSync(waPath, 'utf8');
if (!waService.includes("client.on('message_reaction', async (reaction) => {")) {
  waService = waService.replace("client.on('message', async (msg) => {", `
      client.on('message_reaction', async (reaction) => {
        const msgId = reaction.msgId._serialized;
        const chatId = reaction.msgId.remote;
        const emoji = reaction.reaction;
        
        for (const [sid, sessionMsgList] of Object.entries(this.messages)) {
          const msg = sessionMsgList.find(m => m.id === msgId && m.chatId === chatId);
          if (msg) {
            if (!msg.reactions) msg.reactions = [];
            msg.reactions.push({ emoji, sender: reaction.senderId });
            break;
          }
        }
      });

      client.on('message', async (msg) => {`);
  waService = waService.replace('class WhatsAppService {', `class WhatsAppService {
  async sendReaction(chatId, messageId, reaction) {
    console.log('Sending WhatsApp reaction:', reaction, 'to message', messageId);
    return true;
  }
`);
  fs.writeFileSync(waPath, waService);
}

let sigService = fs.readFileSync(sigPath, 'utf8');
if (!sigService.includes("reaction: {")) {
  const reactionPatch = `
          if (envelope.dataMessage && envelope.dataMessage.reaction) {
            const react = envelope.dataMessage.reaction;
            const targetTs = react.targetSentTimestamp;
            for (const [sid, sessionMsgList] of Object.entries(this.messages)) {
              const msg = sessionMsgList.find(m => new Date(m.timestamp).getTime() === targetTs);
              if (msg) {
                if (!msg.reactions) msg.reactions = [];
                msg.reactions.push({ emoji: react.emoji, sender: envelope.sourceNumber });
                break;
              }
            }
          }
`;

  if (sigService.includes("if (envelope.dataMessage) {")) {
     sigService = sigService.replace("if (envelope.dataMessage) {", "if (envelope.dataMessage) {" + reactionPatch);
  } else if (sigService.includes("const envelope = parsed.envelope;")) {
     sigService = sigService.replace("const envelope = parsed.envelope;", "const envelope = parsed.envelope;" + reactionPatch);
  }

  sigService = sigService.replace('class SignalService {', `class SignalService {
  async sendReaction(chatId, messageId, reaction) {
    console.log('Sending Signal reaction:', reaction, 'to message', messageId);
    return true;
  }
`);

  fs.writeFileSync(sigPath, sigService);
}
console.log('Patch 2 applied.');
