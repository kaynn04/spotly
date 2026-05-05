/**
 * Item Repository
 *
 * Data access layer for Item entity
 * Handles all database operations for items table
 * Uses parameterized queries to prevent SQL injection
 *
 * Implementation: T003 - Create app/src/repositories/ItemRepository.ts
 */

import { v4 as uuidv4 } from 'uuid';
import type { Item, ItemRow, ServiceError } from '../models/Item';
import { getDatabase } from '../db/client';

/**
 * ItemRepository handles all item-related database operations
 * Uses parameterized SQL queries for safety
 */
export class ItemRepository {
  /**
   * Create a new item in the database
   *
   * @param name - Item name
   * @param spaceId - The space id this item belongs to
   * @param containerId - Optional container id (null for space-level items)
   * @returns The created Item object with generated id and timestamp
   * @throws ServiceError if database operation fails
   *
   * SQL: INSERT INTO items (id, name, space_id, container_id, created_at) VALUES (?, ?, ?, ?, ?)
   * Parameterized query prevents SQL injection
   */
  static async createItem(
    name: string,
    spaceId: string,
    containerId?: string | null
  ): Promise<Item> {
    try {
      const db = getDatabase();

      // Generate UUID and current ISO 8601 timestamp
      const id = uuidv4();
      const now = new Date().toISOString();

      // Execute parameterized INSERT query (handle optional containerId)
      await db.runAsync(
        'INSERT INTO items (id, name, space_id, container_id, created_at) VALUES (?, ?, ?, ?, ?)',
        [id, name, spaceId, containerId ?? null, now]
      );

      // Return the created Item object
      return {
        id,
        name,
        spaceId,
        containerId,
        createdAt: now,
      };
    } catch (error) {
      // Convert database error to ServiceError
      const serviceError: ServiceError = {
        code: 'DB_ERROR',
        message: 'Failed to create item. Try again.',
      };

      // Log error for debugging
      console.error('[ItemRepository.createItem] Database error:', error);

      throw serviceError;
    }
  }

  /**
   * Get all items for a specific space
   *
   * @param spaceId - The space id to retrieve items for
   * @returns Array of Item objects ordered by newest first
   * @throws ServiceError if database operation fails
   *
   * SQL: SELECT * FROM items WHERE space_id = ? ORDER BY created_at DESC
   */
  static async getItemsBySpaceId(spaceId: string): Promise<Item[]> {
    try {
      const db = getDatabase();

      const result = await db.getAllAsync(
        'SELECT * FROM items WHERE space_id = ? ORDER BY created_at DESC',
        [spaceId]
      );

      return result.map((row: ItemRow) => ({
        id: row.id,
        name: row.name,
        spaceId: row.space_id,
        createdAt: row.created_at,
      }));
    } catch (error) {
      // Convert database error to ServiceError
      const serviceError: ServiceError = {
        code: 'DB_ERROR',
        message: 'Failed to retrieve items. Try again.',
      };

      // Log error for debugging
      console.error('[ItemRepository.getItemsBySpaceId] Database error:', error);

      throw serviceError;
    }
  }

  /**
   * Update an item's space_id to move it to a different space
   *
   * @param itemId - The item id to move
   * @param newSpaceId - The new space id to move the item to
   * @returns void (no return value)
   * @throws ServiceError if database operation fails
   *
   * SQL: UPDATE items SET space_id = ? WHERE id = ?
   * Parameterized query prevents SQL injection
   */
  static async updateSpaceId(itemId: string, newSpaceId: string): Promise<void> {
    try {
      const db = getDatabase();

      // Execute parameterized UPDATE query
      await db.runAsync(
        'UPDATE items SET space_id = ? WHERE id = ?',
        [newSpaceId, itemId]
      );
    } catch (error) {
      // Convert database error to ServiceError
      const serviceError: ServiceError = {
        code: 'DB_ERROR',
        message: 'Failed to move item. Try again.',
      };

      // Log error for debugging
      console.error('[ItemRepository.updateSpaceId] Database error:', error);

      throw serviceError;
    }
  }

  /**
   * Delete an item from the database (permanent deletion)
   *
   * @param itemId - The item id to delete
   * @returns void (no return value)
   * @throws ServiceError if database operation fails
   *
   * SQL: DELETE FROM items WHERE id = ?
   * Parameterized query prevents SQL injection
   * Deletion is permanent - no recovery possible
   */
  static async deleteItem(itemId: string): Promise<void> {
    try {
      const db = getDatabase();

      // Execute parameterized DELETE query
      await db.runAsync(
        'DELETE FROM items WHERE id = ?',
        [itemId]
      );
    } catch (error) {
      // Convert database error to ServiceError
      const serviceError: ServiceError = {
        code: 'DB_ERROR',
        message: 'Failed to delete item. Try again.',
      };

      // Log error for debugging
      console.error('[ItemRepository.deleteItem] Database error:', error);

      throw serviceError;
    }
  }
}
