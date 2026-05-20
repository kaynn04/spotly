/**
 * Migration 014 - Add quantity column to lendings table.
 *
 * Stores how many units were lent so inventory can be restored on return.
 */

import { SQLiteDatabase } from 'expo-sqlite';

export async function addLendingQuantity(db: SQLiteDatabase): Promise<void> {
  const cols = await db.getAllAsync<any>('PRAGMA table_info(lendings);');
  if (!cols.some((c: any) => c.name === 'quantity')) {
    await db.execAsync(`ALTER TABLE lendings ADD COLUMN quantity INTEGER NOT NULL DEFAULT 1;`);
  }
}
