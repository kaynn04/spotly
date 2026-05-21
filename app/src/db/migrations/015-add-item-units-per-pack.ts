/**
 * Migration 015 - Add optional pack size metadata to items.
 *
 * Keeps quantity as the sellable unit count while remembering how many
 * pieces/units are inside one pack, tub, bundle, or container.
 */

import { SQLiteDatabase } from 'expo-sqlite';

export async function addItemUnitsPerPack(db: SQLiteDatabase): Promise<void> {
  const cols = await db.getAllAsync<any>('PRAGMA table_info(items);');
  if (!cols.some((c: any) => c.name === 'units_per_pack')) {
    await db.execAsync(`ALTER TABLE items ADD COLUMN units_per_pack INTEGER;`);
  }
}
