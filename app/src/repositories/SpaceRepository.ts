/**
 * Space Repository
 *
 * Data access layer for Space entity
 * Handles all database operations for spaces table
 * Uses parameterized queries to prevent SQL injection
 *
 * Implementation: T002 - Create app/src/repositories/SpaceRepository.ts
 */

import { v4 as uuidv4 } from 'uuid';
import type { Space, SpaceRow, ServiceError } from '@/models/Space';
import { getDatabase } from '@/db/client';

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
      const id = uuidv4();
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
   * @returns Array of Space objects ordered by creation date (most recent first)
   * @throws ServiceError if database operation fails
   *
   * SQL: SELECT id, name, created_at, updated_at FROM spaces ORDER BY created_at DESC
   */
  static async getAllSpaces(): Promise<Space[]> {
    try {
      const db = getDatabase();

      // Execute SELECT query
      const result = await db.getAllAsync<SpaceRow>(
        'SELECT id, name, created_at, updated_at FROM spaces ORDER BY created_at DESC'
      );

      // Map database rows (snake_case) to Space objects (camelCase)
      return result.map((row) => ({
        id: row.id,
        name: row.name,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }));
    } catch (error) {
      // Convert database error to ServiceError
      const serviceError: ServiceError = {
        code: 'DB_ERROR',
        message: 'Failed to retrieve spaces. Try again.',
      };

      // Log error for debugging
      console.error('[SpaceRepository.getAllSpaces] Database error:', error);

      throw serviceError;
    }
  }
}
