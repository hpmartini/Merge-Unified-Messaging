import { z } from 'zod';

export const MessageSchema = z.object({
  timestamp: z.string(),
  sender: z.enum(['me', 'other']),
  senderName: z.string().max(100).optional(),
  platform: z.string().max(50),
  content: z.string().max(10000)
});

export const SummarizeRequestSchema = z.object({
  messages: z.array(MessageSchema).min(1).max(500),
  options: z.object({
    blockLimit: z.number().int().min(1).max(50).default(1),
    groupingMinutes: z.number().int().min(1).max(60).default(5),
    includeMe: z.boolean().default(true),
    includeOther: z.boolean().default(true)
  }).optional().default({}),
  contactName: z.string().min(1).max(100)
});
