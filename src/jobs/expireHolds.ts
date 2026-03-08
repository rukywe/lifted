import cron from 'node-cron';
import { and, eq, lt, isNotNull } from 'drizzle-orm';
import { db } from '../db';
import { bookings } from '../db/schema';
import { logger } from '../lib/logger';

export function expireStaleHolds(): number {
  const now = new Date().toISOString();

  const stale = db
    .select({ id: bookings.id, advisorId: bookings.advisorId })
    .from(bookings)
    .where(
      and(
        eq(bookings.status, 'held'),
        isNotNull(bookings.holdExpiresAt),
        lt(bookings.holdExpiresAt, now)
      )
    )
    .all();

  for (const hold of stale) {
    db.update(bookings)
      .set({ status: 'expired' })
      .where(eq(bookings.id, hold.id))
      .run();

    logger.info(
      { bookingId: hold.id, advisorId: hold.advisorId },
      'Expired stale hold'
    );
  }

  return stale.length;
}

export function startExpireHoldsCron(): void {
  cron.schedule('* * * * *', () => {
    const count = expireStaleHolds();
    if (count > 0) {
      logger.info(`Expire holds job: ${count} hold(s) expired`);
    }
  });

  logger.info('Cron: expire-holds job scheduled (every minute)');
}
