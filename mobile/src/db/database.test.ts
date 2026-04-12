import { Platform } from '../../../types';
import { getDB, initDatabase, insertUser, getUser, insertMessage, getMessagesForUser, clearDatabase } from './database';
import * as SQLite from 'expo-sqlite';

// Mock expo-sqlite
jest.mock('expo-sqlite', () => {
  const mockDb = {
    execAsync: jest.fn(),
    runAsync: jest.fn(),
    getFirstAsync: jest.fn(),
    getAllAsync: jest.fn()
  };
  return {
    openDatabaseAsync: jest.fn().mockResolvedValue(mockDb)
  };
});

describe('Database Operations', () => {
  let db: any;

  beforeEach(async () => {
    jest.clearAllMocks();
    db = await getDB();
  });

  it('initializes database with tables', async () => {
    await initDatabase();
    expect(db.execAsync).toHaveBeenCalled();
    const callArgs = db.execAsync.mock.calls[0][0];
    expect(callArgs).toContain('CREATE TABLE IF NOT EXISTS users');
    expect(callArgs).toContain('CREATE TABLE IF NOT EXISTS messages');
  });

  it('inserts and retrieves a user', async () => {
    const testUser = {
      id: 'u1',
      name: 'Alice',
      avatarInitials: 'AL',
      activePlatforms: [Platform.WhatsApp],
    };

    await insertUser(testUser);
    expect(db.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('INSERT OR REPLACE INTO users'),
      'u1', 'Alice', 'AL', null, JSON.stringify([Platform.WhatsApp]), null, null, '[]'
    );

    // Mocking return value for getUser
    db.getFirstAsync.mockResolvedValueOnce({
      id: 'u1',
      name: 'Alice',
      avatarInitials: 'AL',
      activePlatforms: JSON.stringify([Platform.WhatsApp]),
    });

    const user = await getUser('u1');
    expect(user).not.toBeNull();
    expect(user?.name).toBe('Alice');
    expect(user?.activePlatforms).toEqual([Platform.WhatsApp]);
  });

  it('inserts and retrieves messages', async () => {
    const testDate = new Date();
    const testMessage = {
      id: 'm1',
      userId: 'u1',
      platform: Platform.WhatsApp,
      content: 'Hello World',
      timestamp: testDate,
      isMe: true,
      hash: 'abc1234'
    };

    await insertMessage(testMessage);
    expect(db.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('INSERT OR REPLACE INTO messages'),
      'm1', 'u1', Platform.WhatsApp, 'Hello World', testDate.toISOString(), 1, null, 'abc1234', null, null, null, null, null, null
    );

    db.getAllAsync.mockResolvedValueOnce([{
      id: 'm1',
      userId: 'u1',
      platform: Platform.WhatsApp,
      content: 'Hello World',
      timestamp: testDate.toISOString(),
      isMe: 1,
      hash: 'abc1234'
    }]);

    const messages = await getMessagesForUser('u1');
    expect(messages.length).toBe(1);
    expect(messages[0].content).toBe('Hello World');
    expect(messages[0].isMe).toBe(true);
    expect(messages[0].timestamp).toEqual(testDate);
  });
});
