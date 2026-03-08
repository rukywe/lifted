import { describe, it, expect } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import path from 'node:path';
import { getCachedResponse, storeResponse } from '../src/lib/idempotency';

const MIGRATIONS_FOLDER = path.join(process.cwd(), 'src', 'db', 'migrations');

describe('lib/idempotency', () => {
  it('returns null when key is missing', () => {
    const client = new Database(':memory:');
    const db = drizzle(client);
    migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });

    const result = getCachedResponse<{ id: string }>(db, 'no-such-key');
    expect(result).toBeNull();
  });

  it('round-trips store and get', () => {
    const client = new Database(':memory:');
    const db = drizzle(client);
    migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });

    const payload = { id: 'booking-123', status: 'held' };
    storeResponse(db, 'key-1', payload);

    const cached = getCachedResponse<typeof payload>(db, 'key-1');
    expect(cached).toEqual(payload);
  });

  it('handles different data types correctly', () => {
    const client = new Database(':memory:');
    const db = drizzle(client);
    migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });

    const complexPayload = {
      id: 'booking-123',
      numbers: [1, 2, 3],
      nested: { a: 1, b: 'test' },
      date: new Date('2025-03-10T09:00:00Z'),
      null: null,
      boolean: true
    };

    storeResponse(db, 'key-complex', complexPayload);
    const cached = getCachedResponse<typeof complexPayload>(db, 'key-complex');

    expect(cached).toEqual({
      id: 'booking-123',
      numbers: [1, 2, 3],
      nested: { a: 1, b: 'test' },
      date: '2025-03-10T09:00:00.000Z',
      null: null,
      boolean: true
    });
  });
});
