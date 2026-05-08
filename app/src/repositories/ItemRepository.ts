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
    containerId?: string | null,
    description?: string | null,
    quantity?: number
  ): Promise<Item> {
    try {
      const db = getDatabase();

      // Generate UUID and current ISO 8601 timestamp
      const id = generateUUID();
      const now = new Date().toISOString();
      const qty = quantity ?? 1;

      // Execute parameterized INSERT query (handle optional containerId)
      await db.runAsync(
        'INSERT INTO items (id, name, space_id, container_id, description, quantity, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [id, name, spaceId, containerId ?? null, description ?? null, qty, now]
      );

      // Return the created Item object
      return {
        id,
        name,
        description: description ?? null,
        quantity: qty,
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

      return (result as any[]).map((row: ItemRow) => ({
        id: row.id,
        name: row.name,
        description: row.description ?? null,
        quantity: row.quantity ?? 1,
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

      return (result as any[]).map((row: ItemRow) => ({
        id: row.id,
        name: row.name,
        description: row.description ?? null,
        quantity: row.quantity ?? 1,
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

      const now = new Date().toISOString();
      try {
        await db.runAsync(
          'UPDATE items SET space_id = ?, container_id = NULL, updated_at = ? WHERE id = ?',
          [newSpaceId, now, itemId]
        );
      } catch {
        // updated_at column may not exist yet (migration pending restart)
        await db.runAsync(
          'UPDATE items SET space_id = ?, container_id = NULL WHERE id = ?',
          [newSpaceId, itemId]
        );
      }
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

      const now = new Date().toISOString();
      try {
        await db.runAsync(
          'UPDATE items SET container_id = ?, updated_at = ? WHERE id = ?',
          [containerId || null, now, itemId]
        );
      } catch {
        await db.runAsync(
          'UPDATE items SET container_id = ? WHERE id = ?',
          [containerId || null, itemId]
        );
      }
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
   * Update an item's space_id and container_id atomically
   * Used when moving an item to a container in a (possibly different) space
   *
   * @param itemId - The item id to move
   * @param newSpaceId - The destination space id
   * @param newContainerId - The destination container id (empty string to place at root)
   */
  static async updateSpaceAndContainer(itemId: string, newSpaceId: string, newContainerId: string): Promise<void> {
    try {
      const db = getDatabase();
      const now = new Date().toISOString();
      try {
        await db.runAsync(
          'UPDATE items SET space_id = ?, container_id = ?, updated_at = ? WHERE id = ?',
          [newSpaceId, newContainerId || null, now, itemId]
        );
      } catch {
        await db.runAsync(
          'UPDATE items SET space_id = ?, container_id = ? WHERE id = ?',
          [newSpaceId, newContainerId || null, itemId]
        );
      }
    } catch (error) {
      const serviceError: ServiceError = {
        code: 'DB_ERROR',
        message: 'Failed to move item. Try again.',
      };
      console.error('[ItemRepository.updateSpaceAndContainer] Database error:', error);
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
   *      ORDER BY items.created_at DESC LIMIT <limit>
   */
  static async getRecentItems(
    limit: number = 5
  ): Promise<Array<{ id: string; name: string; spaceName: string; createdAt: string }>> {
    try {
      const db = getDatabase();

      // Sanitize limit to be a positive integer
      const sanitizedLimit = Math.max(1, Math.min(1000, Math.floor(limit)));

      const result = await db.getAllAsync(
        `SELECT items.id, items.name, items.created_at, spaces.name as space_name
         FROM items
         JOIN spaces ON items.space_id = spaces.id
         ORDER BY items.created_at DESC
         LIMIT ?`,
        [sanitizedLimit]
      );

      return result.map((row: any) => ({
        id: row.id,
        name: row.name,
        spaceName: row.space_name,
        createdAt: row.created_at,
      }));
    } catch (error) {
      console.error('[ItemRepository.getRecentItems] Database error:', error);
      return [];
    }
  }

  static async getRecentlyMovedItems(
    limit: number = 5
  ): Promise<Array<{ id: string; name: string; spaceName: string; containerName: string | null; updatedAt: string }>> {
    try {
      const db = getDatabase();
      const sanitizedLimit = Math.max(1, Math.min(1000, Math.floor(limit)));
      const result = await db.getAllAsync(
        `SELECT i.id, i.name, i.updated_at,
                s.name as space_name,
                c.name as container_name
         FROM items i
         JOIN spaces s ON i.space_id = s.id
         LEFT JOIN containers c ON i.container_id = c.id
         WHERE i.updated_at IS NOT NULL AND i.updated_at > i.created_at
         ORDER BY i.updated_at DESC
         LIMIT ?`,
        [sanitizedLimit]
      );
      return result.map((row: any) => ({
        id: row.id,
        name: row.name,
        spaceName: row.space_name,
        containerName: row.container_name ?? null,
        updatedAt: row.updated_at,
      }));
    } catch (error) {
      console.error('[ItemRepository.getRecentlyMovedItems] Database error:', error);
      return [];
    }
  }

  /**
   * Instance method: Get all items
   * 
   * Used by lending feature for item selection
   * Returns all items with their space information
   * 
   * @returns Array of all items
   * @throws Error if database query fails
   */
  async getAll(): Promise<Item[]> {
    try {
      const db = getDatabase();
      const result = await db.getAllAsync(`
        SELECT 
          i.id,
          i.name,
          i.space_id,
          i.container_id,
          i.created_at,
          s.name as space,
          c.name as container
        FROM items i
        LEFT JOIN spaces s ON i.space_id = s.id
        LEFT JOIN containers c ON i.container_id = c.id
        ORDER BY i.name ASC
      `);

      return (result as any[]).map((row: any) => ({
        id: row.id,
        name: row.name,
        description: row.description ?? null,
        quantity: row.quantity ?? 1,
        spaceId: row.space_id,
        containerId: row.container_id,
        createdAt: row.created_at,
        space: row.space ? { name: row.space } : null,
        container: row.container ? { name: row.container } : null,
      }));
    } catch (error) {
      console.error('[ItemRepository.getAll] Database error:', error);
      throw error;
    }
  }

  /**
   * Instance method: Get item by ID
   * 
   * Used by lending feature for item lookup and validation
   * Returns a single item with its space/container information
   * 
   * @param id - Item ID
   * @returns Item object or null if not found
   * @throws Error if database query fails
   */
  async getById(id: string): Promise<Item | null> {
    console.log('[ItemRepository.getById] Looking up item:', id);
    try {
      const db = getDatabase();
      const result = await db.getFirstAsync<any>(`
        SELECT 
          i.id,
          i.name,
          i.description,
          i.quantity,
          i.space_id,
          i.container_id,
          i.created_at,
          s.name as space,
          c.name as container
        FROM items i
        LEFT JOIN spaces s ON i.space_id = s.id
        LEFT JOIN containers c ON i.container_id = c.id
        WHERE i.id = ?
      `, [id]);

      if (!result) {
        console.log('[ItemRepository.getById] Item not found:', id);
        return null;
      }

      const item: Item = {
        id: result.id,
        name: result.name,
        description: result.description ?? null,
        quantity: result.quantity ?? 1,
        spaceId: result.space_id,
        containerId: result.container_id,
        createdAt: result.created_at,
        space: result.space ? { name: result.space } : null,
        container: result.container ? { name: result.container } : null,
      };
      console.log('[ItemRepository.getById] Item found:', item);
      return item;
    } catch (error) {
      console.error('[ItemRepository.getById] Database error:', error);
      throw error;
    }
  }

  /**
   * Static: Get item by ID with space/container info
   */
  static async getItemById(id: string): Promise<Item | null> {
    const repo = new ItemRepository();
    return repo.getById(id);
  }

  /**
   * Update item fields (name, description, quantity)
   */
  static async updateItem(id: string, updates: { name?: string; description?: string | null; quantity?: number }): Promise<void> {
    try {
      const db = getDatabase();
      const fields: string[] = [];
      const values: any[] = [];

      if (updates.name !== undefined) { fields.push('name = ?'); values.push(updates.name); }
      if (updates.description !== undefined) { fields.push('description = ?'); values.push(updates.description); }
      if (updates.quantity !== undefined) { fields.push('quantity = ?'); values.push(updates.quantity); }

      if (fields.length === 0) return;
      values.push(id);

      await db.runAsync(`UPDATE items SET ${fields.join(', ')} WHERE id = ?`, values);
    } catch (error) {
      console.error('[ItemRepository.updateItem] Database error:', error);
      const serviceError: ServiceError = { code: 'DB_ERROR', message: 'Failed to update item.' };
      throw serviceError;
    }
  }
}
