import { eq, and, or } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import crypto from 'node:crypto';
import { db as defaultDb } from '../db';
import { bookings, availabilityWindows } from '../db/schema';
import { ConflictError, BusinessRuleError, NotFoundError } from '../lib/errors';
import { getCachedResponse, storeResponse } from '../lib/idempotency';
import {
  type VisaType,
  VISA_DURATIONS,
  BREAK_BUFFERS,
  HOLD_DURATION_MINUTES
} from '../types';

const MINUTE = 60 * 1000;

interface CreateBookingInput {
  candidateName: string;
  visaType: VisaType;
  advisorId: string;
  startTime: string;
  idempotencyKey?: string;
}

interface BookingResult {
  id: string;
  advisorId: string;
  candidateName: string;
  visaType: VisaType;
  startTime: string;
  endTime: string;
  status: string;
  holdExpiresAt: string;
}

interface BookingsFilter {
  status?: string;
  advisorId?: string;
  date?: string;
}

function toMs(iso: string): number {
  return new Date(iso).getTime();
}

function slotFitsWindow(
  dbInstance: BetterSQLite3Database,
  advisorId: string,
  startTime: string,
  endTime: string
): boolean {
  const windows = dbInstance.select().from(availabilityWindows).all();
  return windows.some(
    (w) =>
      w.advisorId === advisorId &&
      toMs(startTime) >= toMs(w.startTime) &&
      toMs(endTime) <= toMs(w.endTime)
  );
}

function hasConflict(
  dbInstance: BetterSQLite3Database,
  advisorId: string,
  startTime: string,
  endTime: string
): boolean {
  const existing = dbInstance
    .select()
    .from(bookings)
    .where(
      and(
        eq(bookings.advisorId, advisorId),
        or(eq(bookings.status, 'held'), eq(bookings.status, 'confirmed'))
      )
    )
    .all();

  return existing.some(
    (b) =>
      toMs(startTime) < toMs(b.endTime) && toMs(endTime) > toMs(b.startTime)
  );
}

function violatesBreakBuffer(
  dbInstance: BetterSQLite3Database,
  advisorId: string,
  startTime: string
): boolean {
  const confirmed = dbInstance
    .select()
    .from(bookings)
    .where(
      and(eq(bookings.advisorId, advisorId), eq(bookings.status, 'confirmed'))
    )
    .all();

  return confirmed.some((b) => {
    const bEnd = toMs(b.endTime);
    const buffer = BREAK_BUFFERS[b.visaType as VisaType] * MINUTE;
    return bEnd <= toMs(startTime) && bEnd + buffer > toMs(startTime);
  });
}

export function createBooking(
  input: CreateBookingInput,
  dbInstance?: BetterSQLite3Database
): BookingResult {
  const dbToUse = dbInstance ?? defaultDb;
  const { candidateName, visaType, advisorId, startTime, idempotencyKey } =
    input;

  const durationMs = VISA_DURATIONS[visaType] * MINUTE;
  const endTime = new Date(toMs(startTime) + durationMs).toISOString();
  const now = new Date();
  const holdExpiresAt = new Date(
    now.getTime() + HOLD_DURATION_MINUTES * MINUTE
  ).toISOString();
  const id = crypto.randomUUID();

  const result = (
    dbToUse as BetterSQLite3Database & {
      transaction: <T>(fn: (tx: BetterSQLite3Database) => T) => T;
    }
  ).transaction((tx) => {
    if (idempotencyKey) {
      const cached = getCachedResponse<BookingResult>(tx, idempotencyKey);
      if (cached) return cached;
    }

    if (!slotFitsWindow(tx, advisorId, startTime, endTime)) {
      throw new BusinessRuleError(
        'Slot does not fall within an availability window',
        'INVALID_SLOT'
      );
    }

    if (hasConflict(tx, advisorId, startTime, endTime)) {
      throw new ConflictError(
        'This slot is currently held or confirmed',
        'SLOT_UNAVAILABLE'
      );
    }

    if (violatesBreakBuffer(tx, advisorId, startTime)) {
      throw new BusinessRuleError(
        'Slot falls within a break buffer',
        'INVALID_SLOT'
      );
    }

    tx.insert(bookings)
      .values({
        id,
        advisorId,
        candidateName,
        visaType,
        startTime,
        endTime,
        status: 'held',
        holdExpiresAt,
        confirmedAt: null,
        createdAt: now,
        version: 1
      })
      .run();

    const booking: BookingResult = {
      id,
      advisorId,
      candidateName,
      visaType,
      startTime,
      endTime,
      status: 'held',
      holdExpiresAt
    };

    if (idempotencyKey) {
      storeResponse(tx, idempotencyKey, booking);
    }

    return booking;
  });

  return result;
}

export function confirmBooking(
  bookingId: string,
  dbInstance?: BetterSQLite3Database
) {
  const dbToUse = dbInstance ?? defaultDb;

  return (
    dbToUse as BetterSQLite3Database & {
      transaction: <T>(fn: (tx: BetterSQLite3Database) => T) => T;
    }
  ).transaction((tx) => {
    const booking = tx
      .select()
      .from(bookings)
      .where(and(eq(bookings.id, bookingId), eq(bookings.status, 'held')))
      .get();

    if (!booking) {
      const exists = tx
        .select()
        .from(bookings)
        .where(eq(bookings.id, bookingId))
        .get();
      if (!exists) throw new NotFoundError('Booking not found');
      throw new BusinessRuleError(
        `Booking is ${exists.status}, not held`,
        'HOLD_EXPIRED'
      );
    }

    if (new Date(booking.holdExpiresAt!) <= new Date()) {
      tx.update(bookings)
        .set({ status: 'expired' })
        .where(eq(bookings.id, bookingId))
        .run();
      throw new BusinessRuleError('Hold has expired', 'HOLD_EXPIRED');
    }

    tx.update(bookings)
      .set({
        status: 'confirmed',
        confirmedAt: new Date().toISOString(),
        holdExpiresAt: null,
        version: booking.version + 1
      })
      .where(
        and(eq(bookings.id, bookingId), eq(bookings.version, booking.version))
      )
      .run();

    return {
      ...booking,
      status: 'confirmed' as const,
      confirmedAt: new Date().toISOString(),
      holdExpiresAt: null
    };
  });
}

export function getBookings(
  filters: BookingsFilter = {},
  dbInstance?: BetterSQLite3Database
) {
  const dbToUse = dbInstance ?? defaultDb;

  let rows = dbToUse.select().from(bookings).all();

  if (filters.status) {
    rows = rows.filter((b) => b.status === filters.status);
  }
  if (filters.advisorId) {
    rows = rows.filter((b) => b.advisorId === filters.advisorId);
  }
  if (filters.date) {
    rows = rows.filter((b) => b.startTime.startsWith(filters.date!));
  }

  return rows;
}
