import pg from 'pg';
import { config } from 'dotenv';
config({ path: '../../.env.local' });
config({ path: '../../.env' });

const { Pool } = pg;

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/merge_auth',
  max: parseInt(process.env.DATABASE_POOL_SIZE || '20', 10),
});

export const db = {
  query: (text, params) => pool.query(text, params),
  getClient: () => pool.connect(),
};
