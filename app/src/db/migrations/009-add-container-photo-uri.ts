/**
 * Migration 009: Add photo_uri column to containers table
 *
 * Feature: 013 - Photo Inventory
 */

import { getDatabase } from '../client';

export async function addContainerPhotoUri(): Promise<void> {
  const db = getDatabase();
  await db.execAsync(`ALTER TABLE containers ADD COLUMN photo_uri TEXT DEFAULT NULL;`);
}
