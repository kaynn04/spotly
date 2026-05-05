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
    // Enable foreign keys
    await db.execAsync('PRAGMA foreign_keys = ON;');

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

    // Create containers table
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS containers (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        space_id TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (space_id) REFERENCES spaces(id) ON DELETE CASCADE,
        CHECK (length(trim(name)) > 0 AND length(name) <= 50)
      );
    `);

    // Create index for efficient container queries by space_id
    await db.execAsync(`
      CREATE INDEX IF NOT EXISTS idx_containers_space_id 
      ON containers(space_id);
    `);

    // First: Create items table with minimal schema if it doesn't exist
    // This handles both new databases and existing ones
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS items (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        space_id TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);

    // Create indexes
    await db.execAsync(`
      CREATE INDEX IF NOT EXISTS idx_items_space_id 
      ON items(space_id);
    `);

    // Second: Add container_id column if it doesn't exist (migration for existing dbs)
    try {
      await db.execAsync(`
        ALTER TABLE items ADD COLUMN container_id TEXT;
      `);
      console.log('✓ Added container_id column to items table');
    } catch (migrationError: any) {
      // Column already exists, which is fine - skip silently
      console.log('✓ container_id column already exists');
    }

    // Create index on container_id after column is guaranteed to exist
    await db.execAsync(`
      CREATE INDEX IF NOT EXISTS idx_items_container_id 
      ON items(container_id);
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
      DROP TABLE IF EXISTS containers;
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
