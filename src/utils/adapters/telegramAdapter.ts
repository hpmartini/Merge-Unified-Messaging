import { Platform, User, Message } from '../../../types';
import { TelegramChat, TelegramMessage } from '../../../hooks/useTelegram';

export const normalizeTelegramChat = (chat: TelegramChat): User => ({
  id: `tg-${chat.id}`,
  name: chat.title,
  avatarInitials: chat.title.substring(0, 2).toUpperCase(),
  activePlatforms: [Platform.Telegram],
  role: 'Telegram Chat'
});

export const normalizeTelegramMessage = (tgMsg: TelegramMessage, serverPort?: number | null): Message => ({
  id: `tg-${tgMsg.id}`,
  userId: `tg-${tgMsg.chatId}`,
  platform: Platform.Telegram,
  content: tgMsg.text,
  timestamp: new Date(tgMsg.timestamp),
  isMe: tgMsg.sender === 'me',
  hash: tgMsg.id.toString().substring(0, 7),
  attachments: tgMsg.attachments?.map(att => ({
    ...att,
    url: serverPort ? `http://localhost:${serverPort}${att.url}` : att.url
  })) || [],
  status: tgMsg.status
});
