/**
 * Container Repository
 *
 * Data access layer for Container entity
 * Handles all database operations for containers table
 * Uses parameterized queries to prevent SQL injection
 *
 * Implementation: T002 - Create app/src/repositories/ContainerRepository.ts
 */

import { v4 as uuidv4 } from 'uuid';
import type { Container, ContainerRow, ServiceError } from '../models/Container';
import { getDatabase } from '../db/client';

/**
 * ContainerRepository handles all container-related database operations
 * Uses parameterized SQL queries for safety
 */
export class ContainerRepository {
  /**
   * Create a new container in the database
   *
   * @param name - Container name (1-50 chars, trimmed by service layer)
   * @param spaceId - The space id this container belongs to
   * @returns The created Container object with generated id and timestamp
   * @throws ServiceError if database operation fails
   *
   * SQL: INSERT INTO containers (id, name, space_id, created_at) VALUES (?, ?, ?, ?)
   * Parameterized query prevents SQL injection
   */
  static async createContainer(name: string, spaceId: string): Promise<Container> {
    try {
      const db = getDatabase();

      // Generate UUID and current ISO 8601 timestamp
      const id = uuidv4();
      const now = new Date().toISOString();

      // Execute parameterized INSERT query
      await db.runAsync(
        'INSERT INTO containers (id, name, space_id, created_at) VALUES (?, ?, ?, ?)',
        [id, name, spaceId, now]
      );

      // Return the created Container object
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
        message: 'Failed to create container. Try again.',
      };

      // Log error for debugging
      console.error('[ContainerRepository.createContainer] Database error:', error);

      throw serviceError;
    }
  }

  /**
   * Get all containers for a specific space
   *
   * @param spaceId - The space id to retrieve containers for
   * @returns Array of Container objects ordered by newest first
   * @throws ServiceError if database operation fails
   *
   * SQL: SELECT * FROM containers WHERE space_id = ? ORDER BY created_at DESC
   */
  static async getContainersBySpaceId(spaceId: string): Promise<Container[]> {
    try {
      const db = getDatabase();

      const result = await db.getAllAsync(
        'SELECT * FROM containers WHERE space_id = ? ORDER BY created_at DESC',
        [spaceId]
      );

      // Map database rows (snake_case) to Container objects (camelCase)
      return result.map((row: ContainerRow) => ({
        id: row.id,
        name: row.name,
        spaceId: row.space_id,
        createdAt: row.created_at,
      }));
    } catch (error) {
      // Convert database error to ServiceError
      const serviceError: ServiceError = {
        code: 'DB_ERROR',
        message: 'Failed to retrieve containers. Try again.',
      };

      // Log error for debugging
      console.error('[ContainerRepository.getContainersBySpaceId] Database error:', error);

      throw serviceError;
    }
  }
}
