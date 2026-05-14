/**
 * Migration 013: Add global unique constraints for items and containers
 * 
 * Enforce global name uniqueness at database level:
 * - Items: name must be globally unique
 * - Containers: name must be globally unique
 * 
 * This removes the application-level duplicate checking burden
 * and delegates to the database for consistency.
 */

export async function addGlobalUniqueConstraints(db: any) {
  try {
    // Check if global unique index for items already exists
    const itemIndexes = await db.getAllAsync(
      "SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='items' AND name='idx_items_name_global';"
    );

    if (itemIndexes.length === 0) {
      await db.execAsync(`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_items_name_global 
        ON items(name);
      `);
      console.log('✓ Added global unique constraint for item names');
    }

    // Check if global unique index for containers already exists
    const containerIndexes = await db.getAllAsync(
      "SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='containers' AND name='idx_containers_name_global';"
    );

    if (containerIndexes.length === 0) {
      await db.execAsync(`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_containers_name_global 
        ON containers(name);
      `);
      console.log('✓ Added global unique constraint for container names');
    }
  } catch (err) {
    console.error('[Migration 013] Error adding global unique constraints:', err);
    throw err;
  }
}
