/**
 * Database Migrations
 * 
 * Initializes the database schema for the Spotly app
 * Runs on app startup
 * 
 * Implementation: T006 - Create app/src/db/migrations.ts
 */

import { getDatabase } from './client';

/**
 * Initialize the database schema
 * Creates tables if they don't exist
 * Safe to call multiple times (uses IF NOT EXISTS)
 */
export async function initializeDatabase() {
  const db = getDatabase();

  try {
    // Create spaces table
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS spaces (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        CHECK (length(trim(name)) > 0 AND length(name) <= 100)
      );
    `);

    // Create index for efficient queries by creation date
    await db.execAsync(`
      CREATE INDEX IF NOT EXISTS idx_spaces_created_at 
      ON spaces(created_at);
    `);

    // Create items table
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS items (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        space_id TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (space_id) REFERENCES spaces(id) ON DELETE CASCADE
      );
    `);

    // Create index for efficient queries by space_id
    await db.execAsync(`
      CREATE INDEX IF NOT EXISTS idx_items_space_id 
      ON items(space_id);
    `);

    console.log('✓ Database initialized successfully');
  } catch (error) {
    console.error('✗ Database initialization error:', error);
    throw error;
  }
}

/**
 * Reset database (for testing only)
 * Drops all tables and reinitializes
 */
export async function resetDatabase() {
  const db = getDatabase();

  try {
    await db.execAsync(`
      DROP TABLE IF EXISTS items;
      DROP TABLE IF EXISTS spaces;
    `);
    await initializeDatabase();
    console.log('✓ Database reset successfully');
  } catch (error) {
    console.error('✗ Database reset error:', error);
    throw error;
  }
}

/**
 * Get database version info
 */
export async function getDatabaseInfo() {
  const db = getDatabase();
  try {
    const result = await db.getAllAsync('SELECT name FROM sqlite_master WHERE type="table"');
    return result;
  } catch (error) {
    console.error('✗ Error getting database info:', error);
    throw error;
  }
}
