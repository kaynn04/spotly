/**
 * Space Service
 *
 * Business logic layer for Space operations
 * Handles validation and delegates to repository for data access
 *
 * Implementation: T004 - Create app/src/services/SpaceService.ts
 */

import type { Space, ServiceError } from '../models/Space';
import { SpaceRepository } from '../repositories/SpaceRepository';

/**
 * SpaceService handles all space-related business logic
 * Validates inputs before persisting to database
 */
export class SpaceService {
  /**
   * Create a new space
   *
   * @param name - Space name from user input
   * @returns The created Space object with id, name, and timestamps
   * @throws ServiceError if validation fails or database operation fails
   *
   * Validation:
   * - Trims input
   * - Requires non-empty name after trimming
   * - Enforces maximum length of 100 characters
   */
  static async createSpace(name: string): Promise<Space> {
    try {
      // Trim input
      const trimmedName = name.trim();

      // Validate: must not be empty after trimming
      if (trimmedName.length === 0) {
        const error: ServiceError = {
          code: 'VALIDATION_ERROR',
          message: 'Space name cannot be empty.',
        };
        throw error;
      }

      // Validate: must not exceed 100 characters
      if (trimmedName.length > 100) {
        const error: ServiceError = {
          code: 'VALIDATION_ERROR',
          message: 'Space name cannot exceed 100 characters.',
        };
        throw error;
      }

      // Create space in database via repository
      const space = await SpaceRepository.createSpace(trimmedName);

      return space;
    } catch (error) {
      // If already a ServiceError, re-throw it
      if (error && typeof error === 'object' && 'code' in error) {
        throw error;
      }

      // Convert unexpected errors to ServiceError
      const serviceError: ServiceError = {
        code: 'DB_ERROR',
        message: 'Failed to create space. Try again.',
      };

      console.error('[SpaceService.createSpace] Unexpected error:', error);
      throw serviceError;
    }
  }

  /**
   * Get all spaces
   *
   * @returns Array of Space objects ordered by creation date (most recent first)
   * @throws ServiceError if database operation fails
   */
  static async getAllSpaces(): Promise<Space[]> {
    return SpaceRepository.getAllSpaces();
  }
}
