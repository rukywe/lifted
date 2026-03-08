import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { count } from 'drizzle-orm';
import path from 'node:path';
import fs from 'node:fs';
import { advisors, availabilityWindows } from './schema';

const DB_PATH = path.join(process.cwd(), 'bookings.db');
const MIGRATIONS_FOLDER = path.join(process.cwd(), 'src', 'db', 'migrations');
const SEED_PATH = path.join(process.cwd(), 'data', 'seed.json');

const client = new Database(DB_PATH);
client.pragma('journal_mode = WAL');
client.pragma('foreign_keys = ON');

export const db = drizzle(client);

migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });

// Seed only when empty (first run or after db:reset). Never overwrites existing data.
const advisorRow = db.select({ count: count() }).from(advisors).get();
if (!advisorRow || advisorRow.count === 0) {
  const seedRaw = fs.readFileSync(SEED_PATH, 'utf-8');
  const seed = JSON.parse(seedRaw) as {
    advisors: Array<{
      id: string;
      name: string;
      availability: Array<{ start: string; end: string }>;
    }>;
  };
  const now = new Date();
  for (const advisor of seed.advisors) {
    db.insert(advisors).values({
      id: advisor.id,
      name: advisor.name,
      createdAt: now,
    }).run();
    for (const window of advisor.availability) {
      db.insert(availabilityWindows).values({
        advisorId: advisor.id,
        startTime: window.start,
        endTime: window.end,
      }).run();
    }
  }
}
