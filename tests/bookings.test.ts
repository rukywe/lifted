import { describe, it, expect } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import path from 'node:path';
import { createBooking, confirmBooking, getBookings } from '../src/services/bookings';
import { advisors, availabilityWindows } from '../src/db/schema';

const MIGRATIONS_FOLDER = path.join(process.cwd(), 'src', 'db', 'migrations');

function createTestDb() {
  const client = new Database(':memory:');
  client.pragma('foreign_keys = ON');
  const db = drizzle(client);
  migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });

  db.insert(advisors).values({ id: 'ia-001', name: 'Sofia', createdAt: new Date() }).run();
  db.insert(availabilityWindows).values({
    advisorId: 'ia-001',
    startTime: '2025-03-10T09:00:00Z',
    endTime: '2025-03-10T12:00:00Z',
  }).run();

  return db;
}

describe('bookings service', () => {
  it('creates a held booking for a valid slot', () => {
    const db = createTestDb();

    const result = createBooking({
      candidateName: 'Alice',
      visaType: 'A',
      advisorId: 'ia-001',
      startTime: '2025-03-10T09:00:00.000Z',
    }, db);

    expect(result.status).toBe('held');
    expect(result.holdExpiresAt).toBeDefined();
    expect(result.endTime).toBe('2025-03-10T09:30:00.000Z');
  });

  it('rejects booking outside availability window', () => {
    const db = createTestDb();

    expect(() => createBooking({
      candidateName: 'Bob',
      visaType: 'A',
      advisorId: 'ia-001',
      startTime: '2025-03-10T15:00:00.000Z',
    }, db)).toThrow('Slot does not fall within an availability window');
  });

  it('rejects double-booking the same slot', () => {
    const db = createTestDb();

    createBooking({
      candidateName: 'Alice',
      visaType: 'A',
      advisorId: 'ia-001',
      startTime: '2025-03-10T09:00:00.000Z',
    }, db);

    expect(() => createBooking({
      candidateName: 'Bob',
      visaType: 'A',
      advisorId: 'ia-001',
      startTime: '2025-03-10T09:00:00.000Z',
    }, db)).toThrow('held or confirmed');
  });

  it('confirms a held booking', () => {
    const db = createTestDb();

    const held = createBooking({
      candidateName: 'Alice',
      visaType: 'A',
      advisorId: 'ia-001',
      startTime: '2025-03-10T09:00:00.000Z',
    }, db);

    const confirmed = confirmBooking(held.id, db);
    expect(confirmed.status).toBe('confirmed');
    expect(confirmed.confirmedAt).toBeDefined();
  });

  it('rejects confirmation for non-existent booking', () => {
    const db = createTestDb();

    expect(() => confirmBooking('does-not-exist', db)).toThrow('Booking not found');
  });

  it('idempotency key returns same response', () => {
    const db = createTestDb();
    const key = 'test-key-123';

    const first = createBooking({
      candidateName: 'Alice',
      visaType: 'A',
      advisorId: 'ia-001',
      startTime: '2025-03-10T09:00:00.000Z',
      idempotencyKey: key,
    }, db);

    const second = createBooking({
      candidateName: 'Alice',
      visaType: 'A',
      advisorId: 'ia-001',
      startTime: '2025-03-10T09:00:00.000Z',
      idempotencyKey: key,
    }, db);

    expect(first.id).toBe(second.id);
  });

  it('getBookings filters by status', () => {
    const db = createTestDb();

    createBooking({
      candidateName: 'Alice',
      visaType: 'A',
      advisorId: 'ia-001',
      startTime: '2025-03-10T09:00:00.000Z',
    }, db);

    const held = getBookings({ status: 'held' }, db);
    const confirmed = getBookings({ status: 'confirmed' }, db);

    expect(held).toHaveLength(1);
    expect(confirmed).toHaveLength(0);
  });
});
