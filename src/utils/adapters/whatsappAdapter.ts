import { Platform, User, Message, Attachment } from '../../../types';
import { WhatsAppChat, WhatsAppMessage } from '../../../hooks/useWhatsApp';
import { isProperName } from '../contacts';

export const normalizeWhatsAppChat = (chat: WhatsAppChat, serverPort: number | null): User => {
  let name = chat.name ? chat.name.trim() : '';
  if (!name || !isProperName(name)) {
    name = chat.isGroup ? 'Unknown Group' : `Unknown Number: ${chat.id}`;
  }
  
  const chatIdClean = chat.id.replace('@c.us', '').replace('@lid', '').replace('@g.us', '');
  const waId = `wa-${chatIdClean}`;

  let avatarUrl: string | undefined;
  if (chat.avatarUrl && serverPort) {
    avatarUrl = `http://localhost:${serverPort}${chat.avatarUrl}`;
  }

  const chatTime = chat.timestamp ? new Date(chat.timestamp * 1000) : undefined;

  return {
    id: waId,
    name: name,
    avatarInitials: name.split(' ').filter(n => n.length > 0).map(n => n[0]).join('').substring(0, 2).toUpperCase() || '??',
    avatarUrl,
    activePlatforms: [Platform.WhatsApp],
    role: chat.isGroup ? 'WhatsApp Group' : 'WhatsApp Contact',
    lastMessageTime: chatTime
  };
};

export const normalizeWhatsAppMessage = (waMsg: WhatsAppMessage, chatId: string, serverPort: number | null): Message => {
  const userId = `wa-${chatId.replace('@c.us', '')}`;
  let attachments: Attachment[] = [];
  if (waMsg.media && serverPort) {
    const mediaUrl = `http://localhost:${serverPort}${waMsg.media.url}`;
    attachments = [{
      id: waMsg.id,
      type: waMsg.media.type === 'image' || waMsg.media.type === 'video' ? 'image' : 'document',
      name: waMsg.media.filename,
      url: mediaUrl,
      size: waMsg.media.filesize ? `${(waMsg.media.filesize / 1024).toFixed(1)} KB` : '',
      mimetype: waMsg.media.mimetype,
      mediaType: waMsg.media.type
    }];
  }

  return {
    id: `wa-${waMsg.id}`,
    userId: userId,
    platform: Platform.WhatsApp,
    content: waMsg.body,
    timestamp: new Date(waMsg.timestamp * 1000),
    isMe: waMsg.fromMe,
    hash: waMsg.id.substring(0, 7),
    attachments
  };
};
