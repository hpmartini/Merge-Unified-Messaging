import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Mock `pg` module
vi.mock('pg', () => {
  const queryMock = vi.fn();
  const releaseMock = vi.fn();
  const connectMock = vi.fn().mockResolvedValue({
    query: queryMock,
    release: releaseMock,
  });
  const endMock = vi.fn();
  
  const PoolMock = vi.fn().mockImplementation(function() {
    return {
      connect: connectMock,
      end: endMock,
    };
  });

  return {
    default: {
      Pool: PoolMock,
    },
    Pool: PoolMock,
  };
});

describe('Database Migration Script', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('should run migrations by reading the 001_auth_schema.sql and calling client.query', async () => {
    // To test the top-level execution without causing process.exit in case of error,
    // we can just import the module and wait for its promises (if possible), 
    // but since it's top-level await or promise, we can dynamically import it.
    
    // We also want to ensure we don't really exit the process if it fails,
    // but with the mock, it should succeed.
    
    const pg = await import('pg');
    
    // Dynamically import the migrate script to execute it
    await import('../server/db/migrate.js');
    
    // Give it a moment to finish async operations
    await new Promise(resolve => setTimeout(resolve, 100));

    // Get the mocked pool instance
    const poolInstance = pg.default.Pool.mock.results[0].value;
    expect(poolInstance.connect).toHaveBeenCalled();

    // Get the mocked client
    const clientMock = await poolInstance.connect.mock.results[0].value;
    
    expect(clientMock.query).toHaveBeenCalled();
    
    // Verify it read the sql file
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const schemaPath = path.join(__dirname, '../server/db/migrations/001_auth_schema.sql');
    
    // The actual path might differ, we check if query was called with the file's content
    let fileContent = '';
    try {
      fileContent = fs.readFileSync(schemaPath, 'utf8');
    } catch (e) {
      console.error('Migration file not found at', schemaPath);
    }
    
    expect(fileContent).toBeTruthy();
    expect(clientMock.query).toHaveBeenCalledWith(fileContent);
    expect(clientMock.release).toHaveBeenCalled();
    expect(poolInstance.end).toHaveBeenCalled();
  });
});
