import { Message } from '../../types';

const AI_PROXY_BASE = ''; // Same origin

function getAuthHeaders() {
  // Use Web Crypto API for secure nonce generation
  const nonceArray = new Uint32Array(4);
  crypto.getRandomValues(nonceArray);
  const nonce = Array.from(nonceArray).map(n => n.toString(16).padStart(8, '0')).join('');

  return {
    'Content-Type': 'application/json',
    'X-Request-Timestamp': new Date().toISOString(),
    'X-Request-Nonce': nonce
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
  let response;
  try {
    response = await fetch(`${AI_PROXY_BASE}/api/ai/summarize`, {
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
  } catch (err) {
    throw new Error('Network error: Failed to reach AI proxy for summarization.');
  }
  
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
  let response;
  try {
    response = await fetch(`${AI_PROXY_BASE}/api/ai/compose`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ action, context })
    });
  } catch (err) {
    throw new Error('Network error: Failed to reach AI proxy for composition.');
  }
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'AI compose failed' }));
    throw new Error(error.message || 'AI compose failed');
  }
  
  const data = await response.json();
  return data.text;
}