/**
 * Container Repository
 *
 * Data access layer for Container entity
 * Handles all database operations for containers table
 * Uses parameterized queries to prevent SQL injection
 *
 * Implementation: T002 - Create app/src/repositories/ContainerRepository.ts
 */

import type { Container, ContainerRow, ServiceError } from '../models/Container';
import { getDatabase } from '../db/client';
import { generateUUID } from '../utils/uuid';

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
      const id = generateUUID();
      const now = new Date().toISOString();

      // Execute parameterized INSERT query
      await db.runAsync(
        'INSERT INTO containers (id, name, space_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
        [id, name, spaceId, now, now]
      );

      // Return the created Container object
      return {
        id,
        name,
        spaceId,
        createdAt: now,
        photoUri: null,
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
      return (result as any[]).map((row: ContainerRow) => ({
        id: row.id,
        name: row.name,
        spaceId: row.space_id,
        createdAt: row.created_at,
        photoUri: row.photo_uri ?? null,
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

  /**
   * Get a specific container by id
   *
   * @param containerId - The container id to retrieve
   * @returns Container object, or null if not found
   * @throws ServiceError if database operation fails
   *
   * SQL: SELECT * FROM containers WHERE id = ? LIMIT 1
   */
  static async getContainerById(containerId: string): Promise<Container | null> {
    try {
      const db = getDatabase();

      const result = await db.getFirstAsync(
        'SELECT * FROM containers WHERE id = ? LIMIT 1',
        [containerId]
      );

      if (!result) {
        return null;
      }

      // Map database row (snake_case) to Container object (camelCase)
      const row = result as ContainerRow;
      return {
        id: row.id,
        name: row.name,
        spaceId: row.space_id,
        createdAt: row.created_at,
        photoUri: row.photo_uri ?? null,
      };
    } catch (error) {
      // Convert database error to ServiceError
      const serviceError: ServiceError = {
        code: 'DB_ERROR',
        message: 'Failed to retrieve container. Try again.',
      };

      // Log error for debugging
      console.error('[ContainerRepository.getContainerById] Database error:', error);

      throw serviceError;
    }
  }

  /**
   * Get the total count of containers across all spaces
   *
   * @returns Number of containers in database
   * @throws ServiceError if database operation fails
   *
   * SQL: SELECT COUNT(*) FROM containers
   */
  static async countContainers(): Promise<number> {
    try {
      const db = getDatabase();

      const result = await db.getFirstAsync<{ count: number }>(
        'SELECT COUNT(*) as count FROM containers'
      );

      return result?.count ?? 0;
    } catch (error) {
      // Log error but return 0 as fallback
      console.error('[ContainerRepository.countContainers] Database error:', error);
      return 0;
    }
  }

  /**
   * Delete a container by id
   * Items inside the container will have container_id set to NULL (ON DELETE SET NULL)
   */
  static async deleteContainer(containerId: string): Promise<void> {
    try {
      const db = getDatabase();
      await db.runAsync('DELETE FROM containers WHERE id = ?', [containerId]);
    } catch (error) {
      console.error('[ContainerRepository.deleteContainer] Database error:', error);
      const serviceError: ServiceError = {
        code: 'DB_ERROR',
        message: 'Failed to delete container. Try again.',
      };
      throw serviceError;
    }
  }

  /**
   * Move a container to a different space
   */
  static async moveContainer(containerId: string, targetSpaceId: string): Promise<void> {
    try {
      const db = getDatabase();
      const now = new Date().toISOString();
      await db.withTransactionAsync(async () => {
        try {
          await db.runAsync(
            'UPDATE containers SET space_id = ?, updated_at = ? WHERE id = ?',
            [targetSpaceId, now, containerId]
          );
        } catch {
          // updated_at column may not exist yet (migration pending restart)
          await db.runAsync('UPDATE containers SET space_id = ? WHERE id = ?', [targetSpaceId, containerId]);
        }
        // Also update all items in this container to the new space
        try {
          await db.runAsync(
            'UPDATE items SET space_id = ?, updated_at = ? WHERE container_id = ?',
            [targetSpaceId, now, containerId]
          );
        } catch {
          await db.runAsync('UPDATE items SET space_id = ? WHERE container_id = ?', [targetSpaceId, containerId]);
        }
      });
    } catch (error) {
      console.error('[ContainerRepository.moveContainer] Database error:', error);
      const serviceError: ServiceError = {
        code: 'DB_ERROR',
        message: 'Failed to move container. Try again.',
      };
      throw serviceError;
    }
  }

  static async getRecentlyMovedContainers(
    limit: number = 5
  ): Promise<Array<{ id: string; name: string; spaceName: string; containerName: null; updatedAt: string }>> {
    try {
      const db = getDatabase();
      const sanitizedLimit = Math.max(1, Math.min(1000, Math.floor(limit)));
      const result = await db.getAllAsync(
        `SELECT c.id, c.name, c.updated_at,
                s.name as space_name
         FROM containers c
         JOIN spaces s ON c.space_id = s.id
         WHERE c.updated_at IS NOT NULL AND c.updated_at > c.created_at
         ORDER BY c.updated_at DESC
         LIMIT ?`,
        [sanitizedLimit]
      );
      return result.map((row: any) => ({
        id: row.id,
        name: row.name,
        spaceName: row.space_name,
        containerName: null,
        updatedAt: row.updated_at,
      }));
    } catch (error) {
      console.error('[ContainerRepository.getRecentlyMovedContainers] Database error:', error);
      return [];
    }
  }

  static async updatePhotoUri(id: string, photoUri: string | null): Promise<void> {
    try {
      const db = getDatabase();
      const now = new Date().toISOString();
      await db.runAsync('UPDATE containers SET photo_uri = ?, updated_at = ? WHERE id = ?', [photoUri, now, id]);
    } catch (error) {
      console.error('[ContainerRepository.updatePhotoUri] Database error:', error);
      const serviceError: ServiceError = { code: 'DB_ERROR', message: 'Failed to update container photo.' };
      throw serviceError;
    }
  }
}
