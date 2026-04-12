import * as SQLite from 'expo-sqlite';
import { Message, User, Platform } from '../../../types';

// We can open the database synchronously or asynchronously. Using the async API is recommended for modern Expo.
let db: SQLite.SQLiteDatabase | null = null;

export const getDB = async (): Promise<SQLite.SQLiteDatabase> => {
  if (!db) {
    db = await SQLite.openDatabaseAsync('unified_messaging.db');
  }
  return db;
};

export const initDatabase = async (): Promise<void> => {
  const database = await getDB();
  
  await database.execAsync(`
    PRAGMA journal_mode = WAL;
    
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      avatarInitials TEXT NOT NULL,
      avatarUrl TEXT,
      activePlatforms TEXT NOT NULL,
      role TEXT,
      lastMessageTime TEXT,
      alternateIds TEXT
    );

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      platform TEXT NOT NULL,
      content TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      isMe INTEGER NOT NULL,
      subject TEXT,
      hash TEXT NOT NULL,
      replyToId TEXT,
      replyToPlatform TEXT,
      replyToContent TEXT,
      attachments TEXT,
      status TEXT,
      reactions TEXT,
      FOREIGN KEY(userId) REFERENCES users(id)
    );
  `);
};

export const insertUser = async (user: User): Promise<void> => {
  const database = await getDB();
  await database.runAsync(
    `INSERT OR REPLACE INTO users (id, name, avatarInitials, avatarUrl, activePlatforms, role, lastMessageTime, alternateIds)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    user.id,
    user.name,
    user.avatarInitials,
    user.avatarUrl || null,
    JSON.stringify(user.activePlatforms),
    user.role || null,
    user.lastMessageTime ? user.lastMessageTime.toISOString() : null,
    JSON.stringify(user.alternateIds || [])
  );
};

export const getUser = async (id: string): Promise<User | null> => {
  const database = await getDB();
  const row: any = await database.getFirstAsync('SELECT * FROM users WHERE id = ?', id);
  if (!row) return null;

  return {
    id: row.id,
    name: row.name,
    avatarInitials: row.avatarInitials,
    avatarUrl: row.avatarUrl || undefined,
    activePlatforms: JSON.parse(row.activePlatforms || '[]'),
    role: row.role || undefined,
    lastMessageTime: row.lastMessageTime ? new Date(row.lastMessageTime) : undefined,
    alternateIds: JSON.parse(row.alternateIds || '[]')
  };
};

export const insertMessage = async (msg: Message): Promise<void> => {
  const database = await getDB();
  await database.runAsync(
    `INSERT OR REPLACE INTO messages 
     (id, userId, platform, content, timestamp, isMe, subject, hash, replyToId, replyToPlatform, replyToContent, attachments, status, reactions)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    msg.id,
    msg.userId,
    msg.platform,
    msg.content,
    msg.timestamp.toISOString(),
    msg.isMe ? 1 : 0,
    msg.subject || null,
    msg.hash,
    msg.replyToId || null,
    msg.replyToPlatform || null,
    msg.replyToContent || null,
    msg.attachments ? JSON.stringify(msg.attachments) : null,
    msg.status || null,
    msg.reactions ? JSON.stringify(msg.reactions) : null
  );
};

export const getMessagesForUser = async (userId: string): Promise<Message[]> => {
  const database = await getDB();
  const rows: any[] = await database.getAllAsync('SELECT * FROM messages WHERE userId = ? ORDER BY timestamp ASC', userId);
  
  return rows.map(row => ({
    id: row.id,
    userId: row.userId,
    platform: row.platform as Platform,
    content: row.content,
    timestamp: new Date(row.timestamp),
    isMe: row.isMe === 1,
    subject: row.subject || undefined,
    hash: row.hash,
    replyToId: row.replyToId || undefined,
    replyToPlatform: row.replyToPlatform as Platform || undefined,
    replyToContent: row.replyToContent || undefined,
    attachments: row.attachments ? JSON.parse(row.attachments) : undefined,
    status: row.status || undefined,
    reactions: row.reactions ? JSON.parse(row.reactions) : undefined
  }));
};

export const clearDatabase = async (): Promise<void> => {
  const database = await getDB();
  await database.execAsync('DELETE FROM messages; DELETE FROM users;');
};
