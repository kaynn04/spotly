/**
 * Space Repository
 *
 * Data access layer for Space entity
 * Handles all database operations for spaces table
 * Uses parameterized queries to prevent SQL injection
 *
 * Implementation: T002 - Create app/src/repositories/SpaceRepository.ts
 */

import type { Space, SpaceWithCount, SpaceRow, ServiceError } from '../models/Space';
import { getDatabase } from '../db/client';
import { generateUUID } from '../utils/uuid';

/**
 * SpaceRepository handles all space-related database operations
 * Uses parameterized SQL queries for safety
 */
export class SpaceRepository {
  /**
   * Create a new space in the database
   *
   * @param name - Trimmed space name (1-100 chars)
   * @returns The created Space object with generated id and timestamps
   * @throws ServiceError if database operation fails
   *
   * SQL: INSERT INTO spaces (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)
   * Parameterized query prevents SQL injection
   */
  static async createSpace(name: string): Promise<Space> {
    try {
      const db = getDatabase();

      // Generate UUID and current ISO 8601 timestamp
      const id = generateUUID();
      const now = new Date().toISOString();

      // Execute parameterized INSERT query
      await db.runAsync(
        'INSERT INTO spaces (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)',
        [id, name, now, now]
      );

      // Return the created Space object
      return {
        id,
        name,
        createdAt: now,
        updatedAt: now,
        photoUri: null,
      };
    } catch (error) {
      // Convert database error to ServiceError
      const serviceError: ServiceError = {
        code: 'DB_ERROR',
        message: 'Failed to create space. Try again.',
      };

      // Log error for debugging (in production, would use proper logging)
      console.error('[SpaceRepository.createSpace] Database error:', error);

      throw serviceError;
    }
  }

    /**
   * Get all spaces from the database
   *
   * @returns Array of Space objects ordered by newest first
   *
   * SQL: SELECT * FROM spaces ORDER BY created_at DESC
   */
  static async getAllSpaces(): Promise<Space[]> {
    try {
      const db = getDatabase();

      const result = await db.getAllAsync(
        'SELECT * FROM spaces ORDER BY created_at DESC'
      );

return (result as any[]).map((row: SpaceRow) => ({
        id: String(row.id),
        name: row.name,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        photoUri: row.photo_uri ?? null,
     }));
     
    } catch (error) {
      console.error('[SpaceRepository.getAllSpaces] Database error:', error);
      throw new Error('Failed to retrieve spaces');
    }
  }

  static async getAllSpacesWithCounts(): Promise<SpaceWithCount[]> {
    try {
      const db = getDatabase();
      const result = await db.getAllAsync(`
        SELECT
          s.*,
          (SELECT COUNT(*) FROM items i WHERE i.space_id = s.id AND i.container_id IS NULL) AS direct_item_count,
          (SELECT COUNT(*) FROM containers c WHERE c.space_id = s.id) AS container_count
        FROM spaces s
        ORDER BY s.created_at DESC
      `);
      return (result as any[]).map((row: any) => ({
        id: String(row.id),
        name: row.name,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        photoUri: row.photo_uri ?? null,
        itemCount: row.direct_item_count ?? 0,
        containerCount: row.container_count ?? 0,
      }));
    } catch (error) {
      console.error('[SpaceRepository.getAllSpacesWithCounts] Database error:', error);
      throw new Error('Failed to retrieve spaces with counts');
    }
  }

  /**
   * Get a single space by id
   *
   * @param id - The space id to retrieve
   * @returns Space object if found, null if not found
   * @throws ServiceError if database operation fails
   *
   * SQL: SELECT * FROM spaces WHERE id = ?
   * Parameterized query prevents SQL injection
   */
  static async getSpaceById(id: string): Promise<Space | null> {
    try {
      const db = getDatabase();

      const row = await db.getFirstAsync(
        'SELECT * FROM spaces WHERE id = ?',
        [id]
      ) as SpaceRow | null;

      if (!row) {
        return null;
      }

      return {
        id: row.id,
        name: row.name,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        photoUri: row.photo_uri ?? null,
      };
    } catch (error) {
      // Convert database error to ServiceError
      const serviceError: ServiceError = {
        code: 'DB_ERROR',
        message: 'Failed to retrieve space. Try again.',
      };

      console.error('[SpaceRepository.getSpaceById] Database error:', error);

      throw serviceError;
    }
  }

  /**
   * Delete a space from the database
   *
   * @param id - The space id to delete
   * @returns void (no return value)
   * @throws ServiceError if database operation fails
   *
   * SQL: DELETE FROM spaces WHERE id = ?
   * Parameterized query prevents SQL injection
   */
  static async deleteSpace(id: string): Promise<void> {
    try {
      const db = getDatabase();

      // Execute parameterized DELETE query
      await db.runAsync(
        'DELETE FROM spaces WHERE id = ?',
        [id]
      );
    } catch (error) {
      // Convert database error to ServiceError
      const serviceError: ServiceError = {
        code: 'DB_ERROR',
        message: 'Failed to delete space. Try again.',
      };

      console.error('[SpaceRepository.deleteSpace] Database error:', error);

      throw serviceError;
    }
  }

  /**
   * Get the total count of spaces
   *
   * @returns Number of spaces in database
   * @throws ServiceError if database operation fails
   *
   * SQL: SELECT COUNT(*) FROM spaces
   */
  static async countSpaces(): Promise<number> {
    try {
      const db = getDatabase();

      const result = await db.getFirstAsync<{ count: number }>(
        'SELECT COUNT(*) as count FROM spaces'
      );

      return result?.count ?? 0;
    } catch (error) {
      // Log error but return 0 as fallback
      console.error('[SpaceRepository.countSpaces] Database error:', error);
      return 0;
    }
  }

  static async updatePhotoUri(id: string, photoUri: string | null): Promise<void> {
    try {
      const db = getDatabase();
      const now = new Date().toISOString();
      await db.runAsync('UPDATE spaces SET photo_uri = ?, updated_at = ? WHERE id = ?', [photoUri, now, id]);
    } catch (error) {
      console.error('[SpaceRepository.updatePhotoUri] Database error:', error);
      const serviceError: ServiceError = { code: 'DB_ERROR', message: 'Failed to update space photo.' };
      throw serviceError;
    }
  }
  
}
