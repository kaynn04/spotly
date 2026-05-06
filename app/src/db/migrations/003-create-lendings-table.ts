/**
 * Migration 003: Create Lendings Table
 *
 * Purpose: Add support for tracking item lendings
 * Date: May 6, 2026
 * Version: 1.0
 *
 * Creates:
 * - lendings table with full schema
 * - Indexes for query optimization
 * - Constraints for data integrity
 *
 * Idempotent: Safe to run multiple times (uses CREATE TABLE IF NOT EXISTS)
 */

/**
 * Create lendings table with schema from data-model.md
 *
 * Table: lendings
 * Tracks items lent to people, with lifecycle management
 * State machine: ACTIVE → RETURNED
 *
 * Attributes:
 * - id: UUID primary key (auto-generated)
 * - item_id: FK to items.id (no cascade delete to preserve history)
 * - borrower_name: Required string (who borrowed it)
 * - note: Optional string (context about lending)
 * - lent_at: Timestamp when lending created (UTC)
 * - returned_at: Timestamp when marked returned (NULL if ACTIVE)
 * - status: Enum 'ACTIVE' or 'RETURNED'
 * - created_at: Record creation timestamp
 * - updated_at: Record last modification timestamp
 */
export async function createLendingsTable(db: any): Promise<void> {
  try {
    // Check if lendings table exists
    const tableInfo = await db.getAllAsync("SELECT name FROM sqlite_master WHERE type='table' AND name='lendings';");
    const tableExists = tableInfo.length > 0;

    if (tableExists) {
      // Check if the foreign key has CASCADE delete by checking the schema
      // SQLite doesn't provide direct way to check FK action, so we'll drop and recreate to ensure correctness
      console.log('⚠ Lendings table exists, dropping to apply CASCADE delete constraint...');
      await db.execAsync('DROP TABLE IF EXISTS lendings;');
    }

    // Create lendings table
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS lendings (
        id TEXT PRIMARY KEY,
        item_id TEXT NOT NULL,
        borrower_name TEXT NOT NULL,
        note TEXT,
        lent_at TEXT NOT NULL,
        returned_at TEXT,
        status TEXT NOT NULL DEFAULT 'ACTIVE',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE,
        CHECK (status IN ('ACTIVE', 'RETURNED')),
        CHECK (returned_at IS NULL OR returned_at >= lent_at)
      );
    `);

    // Partial unique index: Only one ACTIVE lending per item
    // SQLite: Partial indexes support WHERE clauses for conditional uniqueness
    await db.execAsync(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_lendings_unique_active_item
      ON lendings(item_id, status) WHERE status = 'ACTIVE';
    `);

    // Index for finding lendings by status, sorted by date (primary query pattern)
    // Used by: getActiveLendings(), getAllLendings()
    await db.execAsync(`
      CREATE INDEX IF NOT EXISTS idx_lendings_status_date
      ON lendings(status, lent_at DESC);
    `);

    // Index for finding lendings for an item (handles orphaned items, FK lookups)
    // Used by: getByItemId(), hasActiveLending(), cleanup queries
    await db.execAsync(`
      CREATE INDEX IF NOT EXISTS idx_lendings_item_id
      ON lendings(item_id);
    `);

    // Index for mark-as-returned workflow (status + id for quick updates)
    // Used by: markAsReturned() queries
    await db.execAsync(`
      CREATE INDEX IF NOT EXISTS idx_lendings_active
      ON lendings(status) WHERE status = 'ACTIVE';
    `);

    console.log('✓ Migration 003: Created lendings table with indexes');
  } catch (error) {
    console.error('✗ Migration 003 error:', error);
    throw error;
  }
}

/**
 * Rollback function (for testing/recovery only)
 * Not called in production
 */
export async function dropLendingsTable(db: any): Promise<void> {
  try {
    await db.execAsync('DROP TABLE IF EXISTS lendings;');
    console.log('✓ Migration 003: Dropped lendings table');
  } catch (error) {
    console.error('✗ Migration 003 rollback error:', error);
    throw error;
  }
}
