import { Platform, User, Message } from '../../../types';
import { EmailChat, EmailMessage } from '../../hooks/useEmail';

export const normalizeEmailChat = (chat: EmailChat): User => ({
  id: `email-${chat.id}`,
  name: chat.title || chat.email,
  avatarInitials: (chat.title || chat.email || 'E').substring(0, 2).toUpperCase(),
  activePlatforms: [Platform.Email],
  role: 'Email Contact'
});

export const normalizeEmailMessage = (msg: EmailMessage): Message => ({
  id: `email-${msg.id}`,
  userId: `email-${msg.chatId}`,
  platform: Platform.Email,
  content: msg.text,
  subject: msg.subject,
  timestamp: new Date(msg.timestamp),
  isMe: msg.sender === 'me',
  hash: msg.id.toString().substring(0, 7)
});
