/**
 * Migration 004: Create Outside Sessions Tables
 * 
 * Creates tables for the Outside Checklist feature:
 * - outside_sessions: Temporary checklist sessions
 * - outside_session_items: Items in each session
 * 
 * Constraints:
 * - One ACTIVE session at a time (UNIQUE index)
 * - No duplicate items in same session
 * - Cascade delete when items are deleted
 */

import { SQLiteDatabase } from 'expo-sqlite';

export async function createOutsideSessionsTables(db: SQLiteDatabase) {
  try {
    // Create outside_sessions table
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS outside_sessions (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        status TEXT NOT NULL CHECK(status IN ('ACTIVE', 'COMPLETED')),
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        completed_at TEXT,
        CHECK (length(trim(title)) > 0 AND length(title) <= 100)
      );
    `);

    // UNIQUE constraint: Only one ACTIVE session allowed
    await db.execAsync(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_outside_active_session 
      ON outside_sessions(status) 
      WHERE status = 'ACTIVE';
    `);

    // Index for querying by status
    await db.execAsync(`
      CREATE INDEX IF NOT EXISTS idx_outside_sessions_status 
      ON outside_sessions(status);
    `);

    // Index for sorting by date
    await db.execAsync(`
      CREATE INDEX IF NOT EXISTS idx_outside_sessions_created_at 
      ON outside_sessions(created_at DESC);
    `);

    // Create outside_session_items table
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS outside_session_items (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        item_id TEXT NOT NULL,
        is_checked INTEGER NOT NULL DEFAULT 0,
        checked_at TEXT,
        FOREIGN KEY (session_id) REFERENCES outside_sessions(id) ON DELETE CASCADE,
        FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE
      );
    `);

    // UNIQUE constraint: No duplicate items in same session
    await db.execAsync(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_outside_session_items_unique 
      ON outside_session_items(session_id, item_id);
    `);

    // Index for querying items by session
    await db.execAsync(`
      CREATE INDEX IF NOT EXISTS idx_outside_session_items_session 
      ON outside_session_items(session_id);
    `);

    // Index for querying items by item
    await db.execAsync(`
      CREATE INDEX IF NOT EXISTS idx_outside_session_items_item 
      ON outside_session_items(item_id);
    `);

    console.log('✓ Outside sessions tables created successfully');
  } catch (error) {
    console.error('✗ Error creating outside sessions tables:', error);
    throw error;
  }
}

export async function dropOutsideSessionsTables(db: SQLiteDatabase) {
  try {
    await db.execAsync(`
      DROP TABLE IF EXISTS outside_session_items;
      DROP TABLE IF EXISTS outside_sessions;
    `);
    console.log('✓ Outside sessions tables dropped successfully');
  } catch (error) {
    console.error('✗ Error dropping outside sessions tables:', error);
    throw error;
  }
}
