import { Platform, User, Message } from '../../../types';
import { SlackChat, SlackMessage } from '../../hooks/useSlack';

export const normalizeSlackChat = (chat: SlackChat): User => ({
  id: `slack-${chat.id}`,
  name: chat.name,
  avatarInitials: chat.name.substring(0, 2).toUpperCase(),
  activePlatforms: [Platform.Slack],
  role: chat.isChannel ? 'Slack Channel' : 'Slack Contact'
});

export const normalizeSlackMessage = (msg: SlackMessage): Message => ({
  id: `slack-${msg.id}`,
  userId: `slack-${msg.chatId}`,
  platform: Platform.Slack,
  content: msg.text,
  timestamp: new Date(msg.timestamp),
  isMe: msg.sender === 'me',
  hash: msg.id.toString().substring(0, 7),
  replyToId: msg.threadId ? `slack-${msg.threadId}` : undefined,
  replyToPlatform: msg.threadId ? Platform.Slack : undefined
});
