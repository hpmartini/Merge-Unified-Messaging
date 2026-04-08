import fs from 'fs';
import path from 'path';
import pg from 'pg';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function runMigrations() {
  console.log('Starting database migrations...');
  const client = await pool.connect();
  try {
    const migrationsDir = path.join(__dirname, 'migrations');
    if (fs.existsSync(migrationsDir)) {
      const files = fs.readdirSync(migrationsDir).sort();
      for (const file of files) {
        if (file.endsWith('.sql')) {
          console.log(`Running migration: ${file}`);
          const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
          await client.query(sql);
          console.log(`Successfully applied: ${file}`);
        }
      }
    } else {
      console.log('No migrations directory found.');
    }
    console.log('Database migrations completed successfully.');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runMigrations();