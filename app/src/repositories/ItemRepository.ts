/**
 * Item Repository
 *
 * Data access layer for Item entity
 * Handles all database operations for items table
 * Uses parameterized queries to prevent SQL injection
 *
 * Implementation: T003 - Create app/src/repositories/ItemRepository.ts
 */

import type { Item, ItemRow, ServiceError } from '../models/Item';
import { getDatabase } from '../db/client';
import { generateUUID } from '../utils/uuid';

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
      const id = generateUUID();
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
      console.error('[ItemRepository.createItem] Error details:', {
        errorMessage: error instanceof Error ? error.message : String(error),
        errorCode: (error as any)?.code,
        errorStack: error instanceof Error ? error.stack : undefined,
      });

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
        containerId: row.container_id,
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
   * Get all items in a specific container
   *
   * @param containerId - The container id to retrieve items for
   * @returns Array of Item objects ordered by newest first
   * @throws ServiceError if database operation fails
   *
   * SQL: SELECT * FROM items WHERE container_id = ? ORDER BY created_at DESC
   */
  static async getItemsByContainerId(containerId: string): Promise<Item[]> {
    try {
      const db = getDatabase();

      const result = await db.getAllAsync(
        'SELECT * FROM items WHERE container_id = ? ORDER BY created_at DESC',
        [containerId]
      );

      return result.map((row: ItemRow) => ({
        id: row.id,
        name: row.name,
        spaceId: row.space_id,
        createdAt: row.created_at,
        containerId: row.container_id,
      }));
    } catch (error) {
      // Convert database error to ServiceError
      const serviceError: ServiceError = {
        code: 'DB_ERROR',
        message: 'Failed to retrieve container items. Try again.',
      };

      // Log error for debugging
      console.error('[ItemRepository.getItemsByContainerId] Database error:', error);

      throw serviceError;
    }
  }

  /**
   * Update an item's space_id to move it to a different space
   * Also clears container_id if item was in a container
   *
   * @param itemId - The item id to move
   * @param newSpaceId - The new space id to move the item to
   * @returns void (no return value)
   * @throws ServiceError if database operation fails
   *
   * SQL: UPDATE items SET space_id = ?, container_id = NULL WHERE id = ?
   * Parameterized query prevents SQL injection
   * Clears container_id to remove item from container when moving to different space
   */
  static async updateSpaceId(itemId: string, newSpaceId: string): Promise<void> {
    try {
      const db = getDatabase();

      // Execute parameterized UPDATE query
      // When moving to a different space, remove from container (container_id = NULL)
      await db.runAsync(
        'UPDATE items SET space_id = ?, container_id = NULL WHERE id = ?',
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
   * Update an item's container_id to move it to a different container
   * Pass empty string to clear container (move to root space)
   *
   * @param itemId - The item id to move
   * @param containerId - The new container id (empty string to move to root space)
   * @returns void (no return value)
   * @throws ServiceError if database operation fails
   *
   * SQL: UPDATE items SET container_id = ? WHERE id = ?
   * Parameterized query prevents SQL injection
   * Empty string sets container_id to NULL
   */
  static async updateContainerId(itemId: string, containerId: string): Promise<void> {
    try {
      const db = getDatabase();

      // Execute parameterized UPDATE query
      // Empty string is converted to NULL for root space
      await db.runAsync(
        'UPDATE items SET container_id = ? WHERE id = ?',
        [containerId || null, itemId]
      );
    } catch (error) {
      // Convert database error to ServiceError
      const serviceError: ServiceError = {
        code: 'DB_ERROR',
        message: 'Failed to move item to container. Try again.',
      };

      // Log error for debugging
      console.error('[ItemRepository.updateContainerId] Database error:', error);

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

  /**
   * Get the total count of items across all spaces
   *
   * @returns Number of items in database
   * @throws ServiceError if database operation fails
   *
   * SQL: SELECT COUNT(*) FROM items
   */
  static async countItems(): Promise<number> {
    try {
      const db = getDatabase();

      const result = await db.getFirstAsync<{ count: number }>(
        'SELECT COUNT(*) as count FROM items'
      );

      return result?.count ?? 0;
    } catch (error) {
      // Log error but return 0 as fallback
      console.error('[ItemRepository.countItems] Database error:', error);
      return 0;
    }
  }

  /**
   * Get the N most recent items across all spaces
   *
   * @param limit - Number of items to return (default: 5)
   * @returns Array of items with space name, ordered by creation date (newest first)
   * @throws ServiceError if database operation fails
   *
   * SQL: SELECT items.id, items.name, items.created_at, spaces.name as space_name
   *      FROM items JOIN spaces ON items.space_id = spaces.id
   *      ORDER BY items.created_at DESC LIMIT ?
   */
  static async getRecentItems(
    limit: number = 5
  ): Promise<Array<{ id: string; name: string; spaceName: string; createdAt: string }>> {
    try {
      const db = getDatabase();

      const result = await db.getAllAsync(
        `SELECT items.id, items.name, items.created_at, spaces.name as space_name
         FROM items
         JOIN spaces ON items.space_id = spaces.id
         ORDER BY items.created_at DESC
         LIMIT ?`,
        [limit]
      );

      return result.map((row: any) => ({
        id: row.id,
        name: row.name,
        spaceName: row.space_name,
        createdAt: row.created_at,
      }));
    } catch (error) {
      // Log error but return empty array as fallback
      console.error('[ItemRepository.getRecentItems] Database error:', error);
      return [];
    }
  }
}
