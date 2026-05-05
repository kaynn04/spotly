/**
 * Container Service
 *
 * Business logic layer for Container operations
 * Handles validation and delegates to repository for data access
 *
 * Implementation: T003 - Create app/src/services/ContainerService.ts
 */

import type { Container, ServiceError } from '../models/Container';
import { ContainerRepository } from '../repositories/ContainerRepository';

/**
 * ContainerService handles all container-related business logic
 * Validates inputs before persisting to database
 */
export class ContainerService {
  /**
   * Create a new container
   *
   * @param name - Container name from user input
   * @param spaceId - The space id this container belongs to
   * @returns The created Container object with id, name, spaceId, and timestamp
   * @throws ServiceError if validation fails or database operation fails
   *
   * Validation:
   * - Trims input
   * - Requires non-empty name after trimming
   * - Enforces maximum length of 50 characters
   */
  static async createContainer(name: string, spaceId: string): Promise<Container> {
    try {
      // Trim input
      const trimmedName = name.trim();

      // Validate: must not be empty after trimming
      if (trimmedName.length === 0) {
        const error: ServiceError = {
          code: 'VALIDATION_ERROR',
          message: 'Container name cannot be empty.',
        };
        throw error;
      }

      // Validate: must not exceed 50 characters
      if (trimmedName.length > 50) {
        const error: ServiceError = {
          code: 'VALIDATION_ERROR',
          message: 'Container name cannot exceed 50 characters.',
        };
        throw error;
      }

      // Create container in database via repository
      const container = await ContainerRepository.createContainer(trimmedName, spaceId);

      return container;
    } catch (error) {
      // If already a ServiceError, re-throw it
      if (error && typeof error === 'object' && 'code' in error) {
        throw error;
      }

      // Convert unexpected errors to ServiceError
      const serviceError: ServiceError = {
        code: 'DB_ERROR',
        message: 'Failed to create container. Try again.',
      };

      console.error('[ContainerService.createContainer] Unexpected error:', error);
      throw serviceError;
    }
  }

  /**
   * Get all containers for a space
   *
   * @param spaceId - The space id to retrieve containers for
   * @returns Array of Container objects ordered by creation date (most recent first)
   * @throws ServiceError if database operation fails
   */
  static async getContainersBySpaceId(spaceId: string): Promise<Container[]> {
    return ContainerRepository.getContainersBySpaceId(spaceId);
  }
}
