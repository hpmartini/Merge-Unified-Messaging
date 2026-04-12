import { describe, it, expect } from 'vitest';
import { updateMessageStatus, loadData, saveData, saveMessage } from '../server/services/whatsappService.js';
import * as fs from 'fs';
import { join } from 'path';

describe('Message Receipts', () => {
  it('updates message status correctly', () => {
    const sessionId = 'test-session';
    const chatId = '12345';
    
    // Seed message
    saveMessage(sessionId, chatId, { id: 'msg1', body: 'hello', timestamp: 123456 });
    
    // Update status
    updateMessageStatus(sessionId, chatId, 'msg1', 'read');
    
    // Verify
    const messages = loadData(sessionId, 'messages');
    expect(messages[chatId][0].status).toBe('read');
  });
});
