/**
 * Migration 010 - Create lending_photos table
 *
 * Stores before/after photo evidence for lending records.
 * Max 4 photos per phase (before or after).
 */

import { SQLiteDatabase } from 'expo-sqlite';

export async function createLendingPhotosTable(db: SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS lending_photos (
      id TEXT PRIMARY KEY,
      lending_id TEXT NOT NULL,
      phase TEXT NOT NULL CHECK (phase IN ('before', 'after')),
      photo_uri TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (lending_id) REFERENCES lendings(id) ON DELETE CASCADE
    );
  `);

  await db.execAsync(`
    CREATE INDEX IF NOT EXISTS idx_lending_photos_lending_id
    ON lending_photos(lending_id, phase);
  `);
}
