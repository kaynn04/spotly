/**
 * Migration 006: Add foreign key constraints to items table
 *
 * SQLite doesn't support ALTER TABLE ADD CONSTRAINT, so we must:
 * 1. Create a new table with proper FK constraints
 * 2. Copy data from old table
 * 3. Drop old table
 * 4. Rename new table
 * 5. Recreate indexes
 *
 * FK behavior:
 * - space_id → spaces(id) ON DELETE CASCADE (delete space = delete its items)
 * - container_id → containers(id) ON DELETE SET NULL (delete container = items become space-level)
 *
 * Idempotent: Checks if FK already exists before running.
 */

export async function addItemsForeignKeys(db: any): Promise<void> {
  // Check if items table already has foreign keys
  const fkList = await db.getAllAsync<any>('PRAGMA foreign_key_list(items);');
  const hasSpaceFk = fkList.some((fk: any) => fk.table === 'spaces');
  const hasContainerFk = fkList.some((fk: any) => fk.table === 'containers');

  if (hasSpaceFk && hasContainerFk) {
    console.log('✓ items table already has foreign keys, skipping');
    return;
  }

  console.log('⚙ Adding foreign keys to items table...');

  // Must be done outside a transaction for safety
  await db.execAsync('PRAGMA foreign_keys = OFF;');

  try {
    await db.execAsync(`
      BEGIN TRANSACTION;

      CREATE TABLE IF NOT EXISTS items_new (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        space_id TEXT NOT NULL,
        container_id TEXT,
        description TEXT,
        quantity INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT,
        FOREIGN KEY (space_id) REFERENCES spaces(id) ON DELETE CASCADE,
        FOREIGN KEY (container_id) REFERENCES containers(id) ON DELETE SET NULL
      );

      INSERT INTO items_new (id, name, space_id, container_id, description, quantity, created_at, updated_at)
        SELECT id, name, space_id, container_id, description, quantity, created_at, updated_at
        FROM items;

      DROP TABLE items;

      ALTER TABLE items_new RENAME TO items;

      CREATE INDEX IF NOT EXISTS idx_items_space_id ON items(space_id);
      CREATE INDEX IF NOT EXISTS idx_items_container_id ON items(container_id);
      CREATE INDEX IF NOT EXISTS idx_items_updated_at ON items(updated_at);

      COMMIT;
    `);

    console.log('✓ Added foreign keys to items table (space_id CASCADE, container_id SET NULL)');
  } catch (error) {
    await db.execAsync('ROLLBACK;').catch(() => {});
    console.error('✗ Failed to add foreign keys to items table:', error);
    throw error;
  } finally {
    await db.execAsync('PRAGMA foreign_keys = ON;');
  }
}
