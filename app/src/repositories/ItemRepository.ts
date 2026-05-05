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
   * @returns The created Item object with generated id and timestamp
   * @throws ServiceError if database operation fails
   *
   * SQL: INSERT INTO items (id, name, space_id, created_at) VALUES (?, ?, ?, ?)
   * Parameterized query prevents SQL injection
   */
  static async createItem(name: string, spaceId: string): Promise<Item> {
    try {
      const db = getDatabase();

      // Generate UUID and current ISO 8601 timestamp
      const id = uuidv4();
      const now = new Date().toISOString();

      // Execute parameterized INSERT query
      await db.runAsync(
        'INSERT INTO items (id, name, space_id, created_at) VALUES (?, ?, ?, ?)',
        [id, name, spaceId, now]
      );

      // Return the created Item object
      return {
        id,
        name,
        spaceId,
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
}
