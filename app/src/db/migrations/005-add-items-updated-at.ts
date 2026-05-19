/**
 * Migration 005: Add updated_at to items and containers tables
 *
 * Purpose: Track when items/containers were last moved so the dashboard
 *          can show a "Recently Moved" section.
 *
 * Idempotent: Safe to run multiple times (checks column existence first)
 */

export async function addItemsUpdatedAt(db: any): Promise<void> {
  // ── items ──────────────────────────────────────────────────────────────
  const itemCols = await db.getAllAsync('PRAGMA table_info(items);');
  if (!itemCols.some((c: any) => c.name === 'updated_at')) {
    await db.execAsync(`ALTER TABLE items ADD COLUMN updated_at TEXT;`);
    await db.execAsync(`UPDATE items SET updated_at = created_at WHERE updated_at IS NULL;`);
    await db.execAsync(`CREATE INDEX IF NOT EXISTS idx_items_updated_at ON items(updated_at);`);
    console.log('✓ Added items.updated_at column and back-filled');
  } else {
    console.log('✓ items.updated_at already exists, skipping');
  }

  // ── containers ─────────────────────────────────────────────────────────
  const ctnCols = await db.getAllAsync('PRAGMA table_info(containers);');
  if (!ctnCols.some((c: any) => c.name === 'updated_at')) {
    await db.execAsync(`ALTER TABLE containers ADD COLUMN updated_at TEXT;`);
    await db.execAsync(`UPDATE containers SET updated_at = created_at WHERE updated_at IS NULL;`);
    await db.execAsync(`CREATE INDEX IF NOT EXISTS idx_containers_updated_at ON containers(updated_at);`);
    console.log('✓ Added containers.updated_at column and back-filled');
  } else {
    console.log('✓ containers.updated_at already exists, skipping');
  }
}
