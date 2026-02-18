
import { Platform, User, Message, PlatformConfig } from './types';

// --- Configuration ---

export const PLATFORM_CONFIG: Record<Platform, PlatformConfig> = {
  [Platform.WhatsApp]: { id: Platform.WhatsApp, label: 'WhatsApp', color: 'text-green-500', bgColor: 'bg-green-500', lineColor: '#22c55e' },
  [Platform.Signal]: { id: Platform.Signal, label: 'Signal', color: 'text-blue-500', bgColor: 'bg-blue-500', lineColor: '#3b82f6' },
  [Platform.Mail]: { id: Platform.Mail, label: 'Google Mail', color: 'text-amber-500', bgColor: 'bg-amber-500', lineColor: '#f59e0b' },
  [Platform.SMS]: { id: Platform.SMS, label: 'SMS', color: 'text-purple-500', bgColor: 'bg-purple-500', lineColor: '#a855f7' },
  [Platform.Twitter]: { id: Platform.Twitter, label: 'X / Twitter', color: 'text-white', bgColor: 'bg-slate-500', lineColor: '#94a3b8' },
  [Platform.LinkedIn]: { id: Platform.LinkedIn, label: 'LinkedIn', color: 'text-cyan-500', bgColor: 'bg-cyan-500', lineColor: '#06b6d4' },
  [Platform.Facebook]: { id: Platform.Facebook, label: 'Messenger', color: 'text-blue-700', bgColor: 'bg-blue-700', lineColor: '#1d4ed8' },
  [Platform.Instagram]: { id: Platform.Instagram, label: 'Instagram', color: 'text-pink-500', bgColor: 'bg-pink-500', lineColor: '#ec4899' },
  [Platform.Telegram]: { id: Platform.Telegram, label: 'Telegram', color: 'text-sky-400', bgColor: 'bg-sky-400', lineColor: '#38bdf8' },
  [Platform.WhatsAppBusiness]: { id: Platform.WhatsAppBusiness, label: 'WA Business', color: 'text-green-600', bgColor: 'bg-green-600', lineColor: '#16a34a' },
  [Platform.Slack]: { id: Platform.Slack, label: 'Slack', color: 'text-fuchsia-500', bgColor: 'bg-fuchsia-500', lineColor: '#d946ef' },
  [Platform.Teams]: { id: Platform.Teams, label: 'Teams', color: 'text-indigo-500', bgColor: 'bg-indigo-500', lineColor: '#6366f1' },
  [Platform.Threema]: { id: Platform.Threema, label: 'Threema', color: 'text-emerald-400', bgColor: 'bg-emerald-400', lineColor: '#34d399' },
};

// --- Dummy Data ---

export const USERS: User[] = [
  { id: 'u1', name: 'Alice', avatarInitials: 'AL', activePlatforms: [Platform.WhatsApp, Platform.Signal, Platform.Mail, Platform.Slack], role: 'Tech Lead' },
  { id: 'u2', name: 'Bob', avatarInitials: 'BO', activePlatforms: [Platform.WhatsApp, Platform.Telegram, Platform.SMS, Platform.Teams], role: 'Backend' },
  { id: 'u3', name: 'Chris', avatarInitials: 'CH', activePlatforms: [Platform.WhatsApp, Platform.Twitter, Platform.Facebook], role: 'Marketing' },
  { id: 'u4', name: 'Dennis', avatarInitials: 'DE', activePlatforms: [Platform.WhatsApp, Platform.LinkedIn], role: 'Recruiter' },
  { id: 'u5', name: 'Eddy', avatarInitials: 'ED', activePlatforms: [Platform.WhatsApp, Platform.Instagram, Platform.Threema], role: 'Designer' },
  { id: 'u6', name: 'Arthur Dent', avatarInitials: 'AD', activePlatforms: [Platform.Mail, Platform.WhatsAppBusiness], role: 'Local Resident' },
];

const generateHash = () => Math.random().toString(16).substring(2, 9);
const now = new Date();
const subtractMinutes = (date: Date, minutes: number) => new Date(date.getTime() - minutes * 60000);

export const INITIAL_MESSAGES: Message[] = [
  // Alice Thread
  { 
    id: 'm1', 
    userId: 'u1', 
    platform: Platform.Mail, 
    content: 'Hey team, just pushing the latest architectural diagrams. Please review the attached PDF.', 
    subject: 'Project Alpha Docs', 
    timestamp: subtractMinutes(now, 120), 
    isMe: false, 
    hash: 'a1b2c3d',
    attachments: [
      { id: 'a1', type: 'document', name: 'System_Arch_v2.pdf', size: '2.4 MB', url: '#' }
    ]
  },
  { id: 'm2', userId: 'u1', platform: Platform.WhatsApp, content: 'Did you get the email? The attachment might be large.', timestamp: subtractMinutes(now, 115), isMe: false, hash: 'e5f6g7h', replyToId: 'm1', replyToPlatform: Platform.Mail },
  { id: 'm3', userId: 'u1', platform: Platform.WhatsApp, content: 'Yep, got it. Reviewing now.', timestamp: subtractMinutes(now, 110), isMe: true, hash: 'i8j9k0l' },
  { 
    id: 'm4', 
    userId: 'u1', 
    platform: Platform.Signal, 
    content: 'Lets move to Signal for the security keys discussion. Here is the public key visual.', 
    timestamp: subtractMinutes(now, 60), 
    isMe: false, 
    hash: 'm1n2o3p',
    attachments: [
      { id: 'a2', type: 'image', name: 'pub_key_qr.png', size: '450 KB', url: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&q=80&w=200&h=200' }
    ]
  },
  { id: 'm5', userId: 'u1', platform: Platform.Signal, content: 'Keys received. Merging to main.', timestamp: subtractMinutes(now, 55), isMe: true, hash: 'q4r5s6t' },
  
  // Arthur Thread
  { id: 'm6', userId: 'u6', platform: Platform.Mail, content: 'This is a bypass announcement. Your house is scheduled for demolition.', subject: 'Re: Bulldozer outside', timestamp: subtractMinutes(now, 300), isMe: false, hash: 'x9y8z7w' },
  { id: 'm7', userId: 'u6', platform: Platform.WhatsAppBusiness, content: 'Please do not panic. It is a simple bypass.', timestamp: subtractMinutes(now, 290), isMe: false, hash: 'v6u5t4s', replyToId: 'm6', replyToPlatform: Platform.Mail },

  // Bob
  { id: 'm8', userId: 'u2', platform: Platform.Telegram, content: 'Server is down.', timestamp: subtractMinutes(now, 20), isMe: false, hash: '1234567' },
  { 
    id: 'm9', 
    userId: 'u2', 
    platform: Platform.SMS, 
    content: 'Are you online? Internet seems out too. Screenshot of the error:', 
    timestamp: subtractMinutes(now, 19), 
    isMe: false, 
    hash: '7654321',
    attachments: [
      { id: 'a3', type: 'image', name: 'error_log_500.jpg', size: '1.1 MB', url: 'https://images.unsplash.com/photo-1555949963-aa79dcee981c?auto=format&fit=crop&q=80&w=200&h=200' }
    ]
  },
];
