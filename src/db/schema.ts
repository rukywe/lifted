import {
  sqliteTable,
  text,
  integer,
  unique,
} from 'drizzle-orm/sqlite-core';

export const advisors = sqliteTable('advisors', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  createdAt: integer('createdAt', { mode: 'timestamp' }).notNull(),
});

export const availabilityWindows = sqliteTable('availability_windows', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  advisorId: text('advisorId')
    .notNull()
    .references(() => advisors.id),
  startTime: text('startTime').notNull(),
  endTime: text('endTime').notNull(),
});

export const bookings = sqliteTable(
  'bookings',
  {
    id: text('id').primaryKey(),
    advisorId: text('advisorId')
      .notNull()
      .references(() => advisors.id),
    candidateName: text('candidateName').notNull(),
    visaType: text('visaType', { enum: ['A', 'B'] }).notNull(),
    startTime: text('startTime').notNull(),
    endTime: text('endTime').notNull(),
    status: text('status', {
      enum: ['held', 'confirmed', 'expired', 'cancelled'],
    }).notNull(),
    holdExpiresAt: text('holdExpiresAt'),
    confirmedAt: text('confirmedAt'),
    createdAt: integer('createdAt', { mode: 'timestamp' }).notNull(),
    version: integer('version').default(1).notNull(),
  },
  (t) => [unique('bookings_advisor_start').on(t.advisorId, t.startTime)],
);

export const waitlist = sqliteTable('waitlist', {
  id: text('id').primaryKey(),
  candidateName: text('candidateName').notNull(),
  visaType: text('visaType', { enum: ['A', 'B'] }).notNull(),
  status: text('status', {
    enum: ['waiting', 'offered', 'booked'],
  }).notNull(),
  offeredSlotId: text('offeredSlotId').references(() => bookings.id),
  offerExpiresAt: text('offerExpiresAt'),
  position: integer('position').notNull(),
  createdAt: integer('createdAt', { mode: 'timestamp' }).notNull(),
});

export const idempotencyKeys = sqliteTable('idempotency_keys', {
  key: text('key').primaryKey(),
  response: text('response').notNull(),
  createdAt: integer('createdAt', { mode: 'timestamp' }).notNull(),
});
