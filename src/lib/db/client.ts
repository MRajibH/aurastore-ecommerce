import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const DB_DIR = path.join(process.cwd(), 'data');
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

const DB_PATH = path.join(DB_DIR, 'ecommerce.db');

const options = {
  verbose: process.env.NODE_ENV === 'development' ? console.log : undefined,
};

// Prevent multiple database connections during hot-reloads in Next.js development
const globalForDb = globalThis as unknown as {
  db: Database.Database | undefined;
};

export const db = globalForDb.db ?? new Database(DB_PATH, options);

if (process.env.NODE_ENV !== 'production') {
  globalForDb.db = db;
}

// Enable WAL journal mode for concurrent reads and writes, and foreign keys
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export default db;

// Run database tables initialization and seeding asynchronously
import('./init').then(({ initDb }) => {
  initDb().catch(error => {
    console.error('Failed to initialize database:', error);
  });
});
