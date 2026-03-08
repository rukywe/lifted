import { eq, or } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { db } from '../db';
import { advisors, availabilityWindows, bookings } from '../db/schema';
import {
  type VisaType,
  type BookableSlot,
  VISA_DURATIONS,
  BREAK_BUFFERS,
  BookingStatus
} from '../types';

export interface AvailabilityFilters {
  visaType?: VisaType;
  advisorId?: string;
  date?: string;
}

interface GroupedSlots {
  [date: string]: BookableSlot[];
}

interface BookingRecord {
  advisorId: string;
  visaType: VisaType;
  startTime: string;
  endTime: string;
  status: BookingStatus;
}

const MINUTE = 60 * 1000;

function toMs(iso: string): number {
  return new Date(iso).getTime();
}

function slotsOverlap(
  slotStart: number,
  slotEnd: number,
  booking: BookingRecord
): boolean {
  return slotStart < toMs(booking.endTime) && slotEnd > toMs(booking.startTime);
}

function breakBufferEnd(booking: BookingRecord): number {
  const buffer = BREAK_BUFFERS[booking.visaType as VisaType] * MINUTE;
  return toMs(booking.endTime) + buffer;
}

function cursorAfterOverlaps(
  slotStart: number,
  slotEnd: number,
  windowBookings: BookingRecord[]
): number {
  let latest = 0;
  for (const b of windowBookings) {
    if (!slotsOverlap(slotStart, slotEnd, b)) continue;
    const end = b.status === 'confirmed' ? breakBufferEnd(b) : toMs(b.endTime);
    latest = Math.max(latest, end);
  }
  return latest;
}

function cursorInBreakBuffer(
  cursor: number,
  confirmedBookings: BookingRecord[]
): number | null {
  for (const b of confirmedBookings) {
    const bEnd = toMs(b.endTime);
    const bufferEnd = breakBufferEnd(b);
    if (bEnd <= cursor && bufferEnd > cursor) return bufferEnd;
  }
  return null;
}

function fetchAdvisorMap(
  dbInstance: BetterSQLite3Database,
  advisorId?: string
): Map<string, string> {
  const rows = advisorId
    ? dbInstance.select().from(advisors).where(eq(advisors.id, advisorId)).all()
    : dbInstance.select().from(advisors).all();
  return new Map(rows.map((a) => [a.id, a.name]));
}

function fetchWindows(
  dbInstance: BetterSQLite3Database,
  advisorId?: string,
  date?: string
) {
  let rows = dbInstance.select().from(availabilityWindows).all();
  if (advisorId) rows = rows.filter((w) => w.advisorId === advisorId);
  if (date) rows = rows.filter((w) => w.startTime.startsWith(date));
  return rows;
}

function fetchActiveBookings(
  dbInstance: BetterSQLite3Database
): BookingRecord[] {
  const now = new Date().toISOString();
  return dbInstance
    .select()
    .from(bookings)
    .where(or(eq(bookings.status, 'held'), eq(bookings.status, 'confirmed')))
    .all()
    .filter((b) => {
      if (b.status === 'held' && b.holdExpiresAt && b.holdExpiresAt < now) return false;
      return true;
    });
}

function generateSlotsForWindow(
  windowStart: number,
  windowEnd: number,
  visaType: VisaType,
  advisorId: string,
  advisorName: string,
  windowBookings: BookingRecord[]
): BookableSlot[] {
  const durationMs = VISA_DURATIONS[visaType] * MINUTE;
  if (windowEnd - windowStart < durationMs) return [];

  const confirmed = windowBookings
    .filter((b) => b.status === 'confirmed')
    .sort((a, b) => toMs(a.startTime) - toMs(b.startTime));

  const slots: BookableSlot[] = [];
  let cursor = windowStart;

  while (cursor + durationMs <= windowEnd) {
    const slotEnd = cursor + durationMs;

    const jumpTo = cursorAfterOverlaps(cursor, slotEnd, windowBookings);
    if (jumpTo > 0) {
      cursor = jumpTo;
      continue;
    }

    const bufferEnd = cursorInBreakBuffer(cursor, confirmed);
    if (bufferEnd !== null) {
      cursor = bufferEnd;
      continue;
    }

    slots.push({
      advisorId,
      advisorName,
      start: new Date(cursor).toISOString(),
      end: new Date(slotEnd).toISOString(),
      visaType
    });

    cursor += durationMs;
  }

  return slots;
}

function groupByDate(slots: BookableSlot[], grouped: GroupedSlots): void {
  for (const slot of slots) {
    const date = slot.start.split('T')[0];
    if (!grouped[date]) grouped[date] = [];
    grouped[date].push(slot);
  }
}

export function getAvailableSlots(
  filters: AvailabilityFilters = {},
  dbInstance?: BetterSQLite3Database
): GroupedSlots {
  const dbToUse = dbInstance ?? db;
  const visaTypes: VisaType[] = filters.visaType
    ? [filters.visaType]
    : ['A', 'B'];
  const advisorMap = fetchAdvisorMap(dbToUse, filters.advisorId);
  const windows = fetchWindows(dbToUse, filters.advisorId, filters.date);
  const activeBookings = fetchActiveBookings(dbToUse);

  const grouped: GroupedSlots = {};

  for (const window of windows) {
    const windowStart = toMs(window.startTime);
    const windowEnd = toMs(window.endTime);

    const windowBookings = activeBookings.filter(
      (b) =>
        b.advisorId === window.advisorId &&
        toMs(b.startTime) < windowEnd &&
        toMs(b.endTime) > windowStart
    );

    for (const visaType of visaTypes) {
      const slots = generateSlotsForWindow(
        windowStart,
        windowEnd,
        visaType,
        window.advisorId,
        advisorMap.get(window.advisorId) ?? '',
        windowBookings
      );
      groupByDate(slots, grouped);
    }
  }

  return grouped;
}
