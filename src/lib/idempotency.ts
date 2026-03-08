import { eq } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { idempotencyKeys } from '../db/schema';

export function getCachedResponse<T>(
  tx: BetterSQLite3Database,
  key: string,
): T | null {
  const row = tx
    .select()
    .from(idempotencyKeys)
    .where(eq(idempotencyKeys.key, key))
    .get();

  return row ? (JSON.parse(row.response) as T) : null;
}

export function storeResponse<T>(
  tx: BetterSQLite3Database,
  key: string,
  response: T,
): void {
  tx.insert(idempotencyKeys)
    .values({
      key,
      response: JSON.stringify(response),
      createdAt: new Date(),
    })
    .run();
}
