/**
 * Migration 012 - Add warranty columns to items table
 *
 * Adds optional warranty expiry date and notification reminder ID to items.
 * One warranty per item (1:1), stored as columns rather than a separate table.
 */

import { SQLiteDatabase } from 'expo-sqlite';

export async function addItemWarranty(db: SQLiteDatabase): Promise<void> {
  const cols = await db.getAllAsync<any>('PRAGMA table_info(items);');
  if (!cols.some((c: any) => c.name === 'warranty_expiry')) {
    await db.execAsync(`ALTER TABLE items ADD COLUMN warranty_expiry TEXT;`);
  }
  if (!cols.some((c: any) => c.name === 'warranty_reminder_id')) {
    await db.execAsync(`ALTER TABLE items ADD COLUMN warranty_reminder_id TEXT;`);
  }
}
