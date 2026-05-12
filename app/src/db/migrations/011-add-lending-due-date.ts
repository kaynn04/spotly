/**
 * Migration 011 - Add due_date column to lendings table
 *
 * Optional due date for a lending. Null means no due date set.
 * Also stores the notification identifier so it can be cancelled on return.
 */

import { SQLiteDatabase } from 'expo-sqlite';

export async function addLendingDueDate(db: SQLiteDatabase): Promise<void> {
  const cols = await db.getAllAsync<any>('PRAGMA table_info(lendings);');
  if (!cols.some((c: any) => c.name === 'due_date')) {
    await db.execAsync(`ALTER TABLE lendings ADD COLUMN due_date TEXT;`);
  }
  if (!cols.some((c: any) => c.name === 'reminder_id')) {
    await db.execAsync(`ALTER TABLE lendings ADD COLUMN reminder_id TEXT;`);
  }
}
