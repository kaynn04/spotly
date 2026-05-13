/**
 * Database Client
 * 
 * Provides singleton access to the SQLite database using expo-sqlite
 * 
 * Implementation: T005 - Create app/src/db/client.ts
 */

import { openDatabaseSync, SQLiteDatabase } from 'expo-sqlite';

let db: SQLiteDatabase | null = null;

/**
 * Get or create the database instance
 * Uses singleton pattern to ensure only one database connection
 * 
 * Note: In development with fast refresh, the database handle may become invalid.
 * This function attempts to recover by creating a fresh connection if the old one fails.
 */
export function getDatabase(): SQLiteDatabase {
  if (!db) {
    try {
      db = openDatabaseSync('synop.db');
      // Enable foreign keys
      db.execSync('PRAGMA foreign_keys = ON');
    } catch (error) {
      console.warn('[getDatabase] Failed to open database, retrying:', error);
      // Reset and try again
      db = null;
      db = openDatabaseSync('synop.db');
      db.execSync('PRAGMA foreign_keys = ON');
    }
  }
  return db;
}

/**
 * Close database connection (for testing)
 */
export function closeDatabase() {
  if (db) {
    // SQLiteDatabase doesn't expose a close method in expo-sqlite
    // Setting to null ensures a fresh connection is created on next getDatabase() call
    db = null;
  }
}
