/**
 * Migration 007: Add photo_uri column to items table
 *
 * Adds an optional photo_uri TEXT column to store the local file path
 * of the item's photo.
 *
 * Feature: 013 - Photo Inventory
 */

import { getDatabase } from '../client';

export async function addItemPhotoUri(): Promise<void> {
  const db = getDatabase();
  await db.execAsync(`ALTER TABLE items ADD COLUMN photo_uri TEXT DEFAULT NULL;`);
}
