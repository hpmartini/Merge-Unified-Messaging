import { Platform, User, Message, Attachment } from '../../../types';
import { SignalChat, SignalMessage } from '../../../hooks/useSignal';
import { isProperName } from '../contacts';

export const normalizeSignalChat = (chat: SignalChat, serverPort: number | null): User => {
  let avatarUrl: string | undefined;
  if (chat.avatarUrl && serverPort) {
    avatarUrl = `http://localhost:${serverPort}${chat.avatarUrl}`;
  }

  let name = chat.name ? chat.name.trim() : '';
  if (!name || !isProperName(name)) {
    name = chat.isGroup ? 'Unknown Group' : `Unknown Number: ${chat.id}`;
  }
  let avatarInitials: string;

  if (chat.isGroup) {
    const words = name.split(/\s+/).filter(w => w.length > 0);
    avatarInitials = words.length >= 2
      ? (words[0][0] + words[1][0]).toUpperCase()
      : name.substring(0, 2).toUpperCase() || 'GR';
  } else {
    const parts = name.split(' ').filter(p => p.length > 0);
    avatarInitials = parts.length >= 2
      ? (parts[0][0] + parts[1][0]).toUpperCase()
      : name.substring(0, 2).toUpperCase() || '??';
  }

  return {
    id: `sig-${chat.id}`,
    name: name,
    avatarInitials,
    avatarUrl,
    activePlatforms: [Platform.Signal],
    role: chat.isGroup ? 'Signal Group' : 'Signal Contact',
    lastMessageTime: chat.timestamp ? new Date(chat.timestamp * 1000) : undefined
  };
};

export const normalizeSignalMessage = (sigMsg: SignalMessage, chatId: string, serverPort: number | null): Message => {
  const userId = `sig-${chatId}`;

  let attachments: Attachment[] = [];
  if (sigMsg.media && serverPort) {
    const mediaUrl = `http://localhost:${serverPort}${sigMsg.media.url}`;
    attachments = [{
      id: sigMsg.id,
      type: sigMsg.media.type === 'image' || sigMsg.media.type === 'video' ? 'image' : 'document',
      name: sigMsg.media.filename,
      url: mediaUrl,
      size: sigMsg.media.filesize ? `${(sigMsg.media.filesize / 1024).toFixed(1)} KB` : '',
      mimetype: sigMsg.media.mimetype,
      mediaType: sigMsg.media.type
    }];
  }

  return {
    id: `sig-${sigMsg.id}`,
    userId: userId,
    platform: Platform.Signal,
    content: sigMsg.body,
    timestamp: new Date(sigMsg.timestamp * 1000),
    isMe: sigMsg.fromMe,
    hash: sigMsg.id.substring(0, 7),
    attachments
  };
};
