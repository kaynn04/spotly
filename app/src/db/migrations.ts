/**
 * Database Migrations
 * 
 * Initializes the database schema for the Spotly app
 * Runs on app startup
 * 
 * Implementation: T006 - Create app/src/db/migrations.ts
 */

import { getDatabase } from './client';
import { createLendingsTable, dropLendingsTable } from './migrations/003-create-lendings-table';

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

    // Check if items table exists and has correct schema
    const itemsTableInfo = await db.getAllAsync("PRAGMA table_info(items);");
    const hasContainerId = itemsTableInfo.some((col: any) => col.name === 'container_id');

    if (itemsTableInfo.length === 0) {
      // Table doesn't exist, create it with correct schema
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS items (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          space_id TEXT NOT NULL,
          container_id TEXT,
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
      `);
      console.log('✓ Created items table with container_id column');
    } else if (!hasContainerId) {
      // Table exists but is missing container_id column - drop and recreate
      console.log('⚠ Items table schema incorrect, recreating...');
      await db.execAsync('DROP TABLE IF EXISTS items;');
      await db.execAsync(`
        CREATE TABLE items (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          space_id TEXT NOT NULL,
          container_id TEXT,
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
      `);
      console.log('✓ Recreated items table with correct schema');
    } else {
      console.log('✓ Items table schema is correct');
    }

    // Create indexes
    await db.execAsync(`
      CREATE INDEX IF NOT EXISTS idx_items_space_id 
      ON items(space_id);
    `);

    await db.execAsync(`
      CREATE INDEX IF NOT EXISTS idx_items_container_id 
      ON items(container_id);
    `);

    // Create lendings table (Migration 003)
    await createLendingsTable(db);

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
      DROP TABLE IF EXISTS lendings;
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
