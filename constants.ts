
import { Platform, User, Message, PlatformConfig } from './types';

// --- Configuration ---

export const PLATFORM_CONFIG: Record<Platform, PlatformConfig> = {
  [Platform.WhatsApp]: { id: Platform.WhatsApp, label: 'WhatsApp', color: 'text-green-500', bgColor: 'bg-green-500', lineColor: '#22c55e' },
  [Platform.Signal]: { id: Platform.Signal, label: 'Signal', color: 'text-blue-500', bgColor: 'bg-blue-500', lineColor: '#3b82f6' },
  [Platform.Mail]: { id: Platform.Mail, label: 'GMail', color: 'text-amber-500', bgColor: 'bg-amber-500', lineColor: '#f59e0b' },
  [Platform.SMS]: { id: Platform.SMS, label: 'SMS', color: 'text-purple-500', bgColor: 'bg-purple-500', lineColor: '#a855f7' },
  [Platform.Twitter]: { id: Platform.Twitter, label: 'X / Twitter', color: 'text-white', bgColor: 'bg-slate-500', lineColor: '#94a3b8' },
  [Platform.LinkedIn]: { id: Platform.LinkedIn, label: 'LinkedIn', color: 'text-cyan-500', bgColor: 'bg-cyan-500', lineColor: '#06b6d4' },
  [Platform.Facebook]: { id: Platform.Facebook, label: 'Messenger', color: 'text-blue-700', bgColor: 'bg-blue-700', lineColor: '#1d4ed8' },
  [Platform.Instagram]: { id: Platform.Instagram, label: 'Instagram', color: 'text-pink-500', bgColor: 'bg-pink-500', lineColor: '#ec4899' },
  [Platform.Telegram]: { id: Platform.Telegram, label: 'Telegram', color: 'text-sky-400', bgColor: 'bg-sky-400', lineColor: '#38bdf8' },
  [Platform.WhatsAppBusiness]: { id: Platform.WhatsAppBusiness, label: 'WA Business', color: 'text-green-600', bgColor: 'bg-green-600', lineColor: '#16a34a' },
  [Platform.Slack]: { id: Platform.Slack, label: 'Slack', color: 'text-purple-600', bgColor: 'bg-purple-600', lineColor: '#9333ea' },
  [Platform.Teams]: { id: Platform.Teams, label: 'Teams', color: 'text-indigo-500', bgColor: 'bg-indigo-500', lineColor: '#6366f1' },
  [Platform.Threema]: { id: Platform.Threema, label: 'Threema', color: 'text-emerald-400', bgColor: 'bg-emerald-400', lineColor: '#34d399' },
  [Platform.Email]: { id: Platform.Email, label: 'Email', color: 'text-yellow-500', bgColor: 'bg-yellow-500', lineColor: '#eab308' },
};

// --- Initial Data (empty - populated from connected services) ---

export const USERS: User[] = [];

export const INITIAL_MESSAGES: Message[] = [];
