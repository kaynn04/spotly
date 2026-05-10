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
import { createOutsideSessionsTables, dropOutsideSessionsTables } from './migrations/004-create-outside-tables';
import { addItemsUpdatedAt } from './migrations/005-add-items-updated-at';

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
      // Table exists but is missing container_id column - add it safely
      console.log('⚠ Items table missing container_id, adding column...');
      await db.execAsync(`ALTER TABLE items ADD COLUMN container_id TEXT;`);
      console.log('✓ Added container_id column to items table');
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

    // Add description and quantity columns if they don't exist
    const itemsCols = await db.getAllAsync<any>("PRAGMA table_info(items);");
    if (!itemsCols.some((col: any) => col.name === 'description')) {
      await db.execAsync(`ALTER TABLE items ADD COLUMN description TEXT;`);
      await db.execAsync(`ALTER TABLE items ADD COLUMN quantity INTEGER NOT NULL DEFAULT 1;`);
      console.log('✓ Added description and quantity columns to items');
    }

    // Create lendings table (Migration 003)
    try {
      await createLendingsTable(db);
    } catch (err) {
      console.error('⚠ Lendings table creation failed:', err);
    }

    // Create outside sessions tables (Migration 004)
    try {
      await createOutsideSessionsTables(db);
    } catch (err) {
      console.error('⚠ Outside sessions tables creation failed:', err);
    }

    // Add items.updated_at column (Migration 005)
    try {
      await addItemsUpdatedAt(db);
    } catch (err) {
      console.error('⚠ Items updated_at migration failed:', err);
    }

    console.log('✓ Database initialized (migrations completed with possible non-critical errors)');
  } catch (error) {
    console.error('✗ Critical database initialization error:', error);
    // Allow app to continue even if DB init has non-critical failures
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
      DROP TABLE IF EXISTS outside_session_items;
      DROP TABLE IF EXISTS outside_sessions;
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
