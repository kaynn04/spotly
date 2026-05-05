/**
 * Database module exports
 * 
 * Re-exports database initialization and client functions
 */

export { getDatabase, closeDatabase } from './client';
export { initializeDatabase, resetDatabase, getDatabaseInfo } from './migrations';
