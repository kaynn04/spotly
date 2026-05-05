/**
 * Database Client
 * 
 * Provides singleton access to the SQLite database using expo-sqlite
 * 
 * Implementation: T005 - Create app/src/db/client.ts
 */

import { openDatabaseSync } from 'expo-sqlite';

let db: any = null;

/**
 * Get or create the database instance
 * Uses singleton pattern to ensure only one database connection
 */
export function getDatabase() {
  if (!db) {
    db = openDatabaseSync('spotly.db');
    // Enable foreign keys (optional, for future item relationships)
    db.execSync('PRAGMA foreign_keys = ON');
  }
  return db;
}

/**
 * Close database connection (for testing)
 */
export function closeDatabase() {
  if (db) {
    db.close();
    db = null;
  }
}
