/**
 * Database Migrations
 * 
 * Initializes the database schema for the Synop app
 * Runs on app startup
 * 
 * Implementation: T006 - Create app/src/db/migrations.ts
 */

import { getDatabase } from './client';
import { createLendingsTable } from './migrations/003-create-lendings-table';
import { createOutsideSessionsTables } from './migrations/004-create-outside-tables';
import { addItemsUpdatedAt } from './migrations/005-add-items-updated-at';
import { addItemsForeignKeys } from './migrations/006-add-items-foreign-keys';
import { addItemPhotoUri } from './migrations/007-add-item-photo-uri';
import { addSpacePhotoUri } from './migrations/008-add-space-photo-uri';
import { addContainerPhotoUri } from './migrations/009-add-container-photo-uri';
import { createLendingPhotosTable } from './migrations/010-create-lending-photos-table';
import { addLendingDueDate } from './migrations/011-add-lending-due-date';
import { addItemWarranty } from './migrations/012-add-item-warranty';
import { addGlobalUniqueConstraints } from './migrations/013-add-global-unique-constraints';

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

    // Ensure space names are unique
    await db.execAsync(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_spaces_name 
      ON spaces(name);
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

    // Ensure container names are unique within a space
    await db.execAsync(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_containers_name_space 
      ON containers(name, space_id);
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

    // Ensure item names are unique within their location (Space or Container)
    await db.execAsync(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_items_name_location 
      ON items(name, space_id, IFNULL(container_id, 'root'));
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

    // Add foreign keys to items table (Migration 006)
    try {
      await addItemsForeignKeys(db);
    } catch (err) {
      console.error('⚠ Items foreign keys migration failed:', err);
    }

    // Add photo_uri column to items table (Migration 007)
    try {
      const cols = await db.getAllAsync<any>("PRAGMA table_info(items);");
      if (!cols.some((col: any) => col.name === 'photo_uri')) {
        await addItemPhotoUri();
        console.log('✓ Added photo_uri column to items');
      }
    } catch (err) {
      console.error('⚠ Items photo_uri migration failed:', err);
    }

    // Add photo_uri column to spaces table (Migration 008)
    try {
      const spaceCols = await db.getAllAsync<any>("PRAGMA table_info(spaces);");
      if (!spaceCols.some((col: any) => col.name === 'photo_uri')) {
        await addSpacePhotoUri();
        console.log('✓ Added photo_uri column to spaces');
      }
    } catch (err) {
      console.error('⚠ Spaces photo_uri migration failed:', err);
    }

    // Add photo_uri column to containers table (Migration 009)
    try {
      const containerCols = await db.getAllAsync<any>("PRAGMA table_info(containers);");
      if (!containerCols.some((col: any) => col.name === 'photo_uri')) {
        await addContainerPhotoUri();
        console.log('✓ Added photo_uri column to containers');
      }
    } catch (err) {
      console.error('⚠ Containers photo_uri migration failed:', err);
    }

    // Create lending_photos table (Migration 010)
    try {
      const tables = await db.getAllAsync<any>("SELECT name FROM sqlite_master WHERE type='table' AND name='lending_photos';");
      if (tables.length === 0) {
        await createLendingPhotosTable(db);
        console.log('✓ Created lending_photos table');
      }
    } catch (err) {
      console.error('⚠ Lending photos table creation failed:', err);
    }

    // Add due_date + reminder_id columns to lendings (Migration 011)
    try {
      await addLendingDueDate(db);
    } catch (err) {
      console.error('⚠ Lending due_date migration failed:', err);
    }

    // Add warranty_expiry + warranty_reminder_id columns to items (Migration 012)
    try {
      await addItemWarranty(db);
    } catch (err) {
      console.error('⚠ Item warranty migration failed:', err);
    }

    // Add lost item tracking columns
    try {
      const itemCols = await db.getAllAsync<any>("PRAGMA table_info(items);");
      if (!itemCols.some((col: any) => col.name === 'lost_at')) {
        await db.execAsync(`ALTER TABLE items ADD COLUMN lost_at TEXT;`);
        console.log('✓ Added lost_at column to items');
      }
      const refreshedItemCols = await db.getAllAsync<any>("PRAGMA table_info(items);");
      if (!refreshedItemCols.some((col: any) => col.name === 'lost_outside_session_id')) {
        await db.execAsync(`ALTER TABLE items ADD COLUMN lost_outside_session_id TEXT;`);
        console.log('✓ Added lost_outside_session_id column to items');
      }
      const finalItemCols = await db.getAllAsync<any>("PRAGMA table_info(items);");
      if (!finalItemCols.some((col: any) => col.name === 'lost_note')) {
        await db.execAsync(`ALTER TABLE items ADD COLUMN lost_note TEXT;`);
        console.log('✓ Added lost_note column to items');
      }
    } catch (err) {
      console.error('Lost item columns migration failed:', err);
    }

    // Add global unique constraints for items and containers (Migration 013)
    try {
      await addGlobalUniqueConstraints(db);
    } catch (err) {
      console.error('⚠ Global unique constraints migration failed:', err);
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

    // Delete all stored photos to free device storage
    const FileSystem = await import('expo-file-system/legacy');
    const photosDir = `${FileSystem.documentDirectory}photos/`;
    const info = await FileSystem.getInfoAsync(photosDir);
    if (info.exists) {
      await FileSystem.deleteAsync(photosDir, { idempotent: true });
    }

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
