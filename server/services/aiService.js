import { GoogleGenerativeAI } from '@google/generative-ai';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const ai = GEMINI_API_KEY ? new GoogleGenerativeAI(GEMINI_API_KEY) : null;

function sanitize(text) {
  if (!text) return '';
  return text.replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export const aiService = {
  isConfigured: !!GEMINI_API_KEY,
  
  async summarize(messages, contactName, options = {}) {
    if (!this.isConfigured) throw new Error('AI not configured');
    
    const sanitizedMessages = messages.map(m => ({
      timestamp: m.timestamp,
      sender: m.sender === 'me' ? 'Me' : contactName,
      content: sanitize(m.content)
    }));
    
    const historyText = sanitizedMessages
      .map(m => `[${m.timestamp}] ${m.sender}: ${m.content}`)
      .join('\n');
    
    const prompt = `You are a helpful assistant for a unified messaging app.
Analyze the following conversation history between "Me" (the user) and "${contactName}".
Provide a concise summary in markdown format with:
- **TL;DR**: One sentence overview.
- **Key Topics**: Bullet points of main subjects discussed.
- **Action Items**: Any tasks or follow-ups mentioned (if any).

Conversation History:
${historyText}`;

    const model = ai.getGenerativeModel({ model: 'gemini-3-flash-preview' });
    const response = await model.generateContent(prompt);
    
    return {
      tokensUsed: response.response.usageMetadata?.totalTokenCount || 0,
      summaryText: response.response.text() || 'No summary available.'
    };
  }
};
