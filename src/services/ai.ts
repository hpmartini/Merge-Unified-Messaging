import { Message } from '../../types';

const AI_PROXY_BASE = ''; // Same origin

function getAuthHeaders() {
  return {
    'Content-Type': 'application/json',
    'X-Request-Timestamp': new Date().toISOString(),
    'X-Request-Nonce': Math.random().toString(36).substring(2, 15)
  };
}

export interface SummarizeOptions {
  blockLimit?: number;
  groupingMinutes?: number;
  includeMe?: boolean;
  includeOther?: boolean;
}

export async function summarizeConversation(
  messages: Message[],
  contactName: string,
  options: SummarizeOptions = {}
): Promise<string> {
  const response = await fetch(`${AI_PROXY_BASE}/api/ai/summarize`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({
      messages: messages.map(m => ({
        timestamp: m.timestamp.toISOString(),
        sender: m.isMe ? 'me' : 'other',
        platform: m.platform,
        content: m.content
      })),
      contactName,
      options
    })
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Unknown error' }));
    throw new Error(error.message || 'Summarization failed');
  }
  
  const data = await response.json();
  return data.summary;
}

export async function composeMessage(
  action: 'reply' | 'improve' | 'professional' | 'casual',
  context: { replyTo?: Message; currentDraft?: string }
): Promise<string> {
  const response = await fetch(`${AI_PROXY_BASE}/api/ai/compose`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ action, context })
  });
  
  if (!response.ok) {
    throw new Error('AI compose failed');
  }
  
  const data = await response.json();
  return data.text;
}