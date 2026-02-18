
export enum Platform {
  WhatsApp = 'WhatsApp',
  Signal = 'Signal',
  Mail = 'Mail',
  SMS = 'SMS',
  Twitter = 'Twitter',
  LinkedIn = 'LinkedIn',
  Facebook = 'Facebook',
  Instagram = 'Instagram',
  Telegram = 'Telegram',
  WhatsAppBusiness = 'WhatsAppBusiness',
  Slack = 'Slack',
  Teams = 'Teams',
  Threema = 'Threema'
}

export interface User {
  id: string;
  name: string;
  avatarInitials: string;
  activePlatforms: Platform[];
  role?: string; // e.g., "Frontend Dev", "PM"
}

export interface Attachment {
  id: string;
  type: 'image' | 'document';
  url: string;
  name: string;
  size: string;
}

export interface Message {
  id: string; // Hash
  userId: string;
  platform: Platform;
  content: string;
  timestamp: Date;
  isMe: boolean;
  subject?: string; // For Email
  hash: string; // Short git hash
  // Reply Context
  replyToId?: string;
  replyToPlatform?: Platform;
  replyToContent?: string;
  attachments?: Attachment[];
}

export interface PlatformConfig {
  id: Platform;
  label: string;
  color: string; // Tailwind text class
  bgColor: string; // Tailwind bg class
  lineColor: string; // Hex for inline styles if needed
}
