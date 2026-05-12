/**
 * Migration 008: Add photo_uri column to spaces table
 *
 * Feature: 013 - Photo Inventory
 */

import { getDatabase } from '../client';

export async function addSpacePhotoUri(): Promise<void> {
  const db = getDatabase();
  await db.execAsync(`ALTER TABLE spaces ADD COLUMN photo_uri TEXT DEFAULT NULL;`);
}
