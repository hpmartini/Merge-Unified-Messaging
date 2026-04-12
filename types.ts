
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
  Slack = 'slack',
  Teams = 'Teams',
  Threema = 'Threema',
  Email = 'email'
}

export interface User {
  id: string;
  name: string;
  avatarInitials: string;
  avatarUrl?: string; // URL to profile picture
  activePlatforms: Platform[];
  role?: string; // e.g., "Frontend Dev", "PM"
  lastMessageTime?: Date; // For sorting contacts by recent activity
  alternateIds?: string[]; // For merged contacts (e.g., both wa-xxx and sig-xxx)
}

export interface Attachment {
  id: string;
  type: 'image' | 'document';
  url: string;
  name: string;
  size: string;
  mimetype?: string;
  mediaType?: 'image' | 'video' | 'audio' | 'document';
  uploadProgress?: number; // 0 to 100
  isUploading?: boolean;
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
  status?: 'sent' | 'delivered' | 'read' | 'failed' | string;
  reactions?: { emoji: string; users: string[] }[];
}

export interface PlatformConfig {
  id: Platform;
  label: string;
  color: string; // Tailwind text class
  bgColor: string; // Tailwind bg class
  lineColor: string; // Hex for inline styles if needed
}
