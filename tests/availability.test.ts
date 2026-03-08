import { describe, it, expect } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import path from 'node:path';
import { getAvailableSlots } from '../src/services/availability';
import { advisors, availabilityWindows, bookings } from '../src/db/schema';

const MIGRATIONS_FOLDER = path.join(process.cwd(), 'src', 'db', 'migrations');

function createTestDb() {
  const client = new Database(':memory:');
  client.pragma('foreign_keys = ON');
  const db = drizzle(client);
  migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
  return db;
}

describe('availability service', () => {
  it('Sofia 20-min window produces zero slots for both visa types', () => {
    const db = createTestDb();
    const now = new Date();

    db.insert(advisors).values({ id: 'ia-001', name: 'Sofia Andersson', createdAt: now }).run();
    db.insert(availabilityWindows).values({
      advisorId: 'ia-001',
      startTime: '2025-03-11T14:00:00Z',
      endTime: '2025-03-11T14:20:00Z',
    }).run();

    const typeA = getAvailableSlots({ advisorId: 'ia-001', date: '2025-03-11', visaType: 'A' }, db);
    const typeB = getAvailableSlots({ advisorId: 'ia-001', date: '2025-03-11', visaType: 'B' }, db);

    expect(typeA['2025-03-11'] ?? []).toHaveLength(0);
    expect(typeB['2025-03-11'] ?? []).toHaveLength(0);
  });

  it('Rajan back-to-back windows are treated as two independent windows', () => {
    const db = createTestDb();
    const now = new Date();

    db.insert(advisors).values({ id: 'ia-002', name: 'Rajan Patel', createdAt: now }).run();
    db.insert(availabilityWindows).values({
      advisorId: 'ia-002',
      startTime: '2025-03-10T09:00:00Z',
      endTime: '2025-03-10T09:30:00Z',
    }).run();
    db.insert(availabilityWindows).values({
      advisorId: 'ia-002',
      startTime: '2025-03-10T09:33:00Z',
      endTime: '2025-03-10T11:30:00Z',
    }).run();

    const typeA = getAvailableSlots({ advisorId: 'ia-002', date: '2025-03-10', visaType: 'A' }, db);
    const slots = typeA['2025-03-10'] ?? [];

    expect(slots.length).toBe(4);
    expect(slots[0].start).toBe('2025-03-10T09:00:00.000Z');
    expect(slots[1].start).toBe('2025-03-10T09:33:00.000Z');
  });

  it('Break buffer after Type A shrinks available slots correctly', () => {
    const db = createTestDb();
    const now = new Date();

    db.insert(advisors).values({ id: 'ia-001', name: 'Sofia', createdAt: now }).run();
    db.insert(availabilityWindows).values({
      advisorId: 'ia-001',
      startTime: '2025-03-10T09:00:00Z',
      endTime: '2025-03-10T11:00:00Z',
    }).run();
    db.insert(bookings).values({
      id: 'b1',
      advisorId: 'ia-001',
      candidateName: 'Alice',
      visaType: 'A',
      startTime: '2025-03-10T09:00:00Z',
      endTime: '2025-03-10T09:30:00Z',
      status: 'confirmed',
      holdExpiresAt: null,
      confirmedAt: '2025-03-10T09:30:00Z',
      createdAt: now,
      version: 1,
    }).run();

    const typeA = getAvailableSlots({ advisorId: 'ia-001', date: '2025-03-10', visaType: 'A' }, db);
    const slots = typeA['2025-03-10'] ?? [];

    const firstSlotStart = slots[0]?.start ?? '';
    expect(firstSlotStart).toBe('2025-03-10T09:35:00.000Z');
  });

  it('Break buffer after Type B shrinks available slots correctly', () => {
    const db = createTestDb();
    const now = new Date();

    db.insert(advisors).values({ id: 'ia-001', name: 'Sofia', createdAt: now }).run();
    db.insert(availabilityWindows).values({
      advisorId: 'ia-001',
      startTime: '2025-03-10T09:00:00Z',
      endTime: '2025-03-10T12:00:00Z',
    }).run();
    db.insert(bookings).values({
      id: 'b1',
      advisorId: 'ia-001',
      candidateName: 'Bob',
      visaType: 'B',
      startTime: '2025-03-10T09:00:00Z',
      endTime: '2025-03-10T10:00:00Z',
      status: 'confirmed',
      holdExpiresAt: null,
      confirmedAt: '2025-03-10T10:00:00Z',
      createdAt: now,
      version: 1,
    }).run();

    const typeA = getAvailableSlots({ advisorId: 'ia-001', date: '2025-03-10', visaType: 'A' }, db);
    const slots = typeA['2025-03-10'] ?? [];

    const firstSlotStart = slots[0]?.start ?? '';
    expect(firstSlotStart).toBe('2025-03-10T10:10:00.000Z');
  });

  it('Break buffer pushing slot past window end drops the slot', () => {
    const db = createTestDb();
    const now = new Date();

    db.insert(advisors).values({ id: 'ia-001', name: 'Sofia', createdAt: now }).run();
    db.insert(availabilityWindows).values({
      advisorId: 'ia-001',
      startTime: '2025-03-10T09:00:00Z',
      endTime: '2025-03-10T10:00:00Z',
    }).run();
    db.insert(bookings).values({
      id: 'b1',
      advisorId: 'ia-001',
      candidateName: 'Carol',
      visaType: 'B',
      startTime: '2025-03-10T09:00:00Z',
      endTime: '2025-03-10T10:00:00Z',
      status: 'confirmed',
      holdExpiresAt: null,
      confirmedAt: '2025-03-10T10:00:00Z',
      createdAt: now,
      version: 1,
    }).run();

    const typeA = getAvailableSlots({ advisorId: 'ia-001', date: '2025-03-10', visaType: 'A' }, db);
    const slots = typeA['2025-03-10'] ?? [];

    expect(slots).toHaveLength(0);
  });
});
