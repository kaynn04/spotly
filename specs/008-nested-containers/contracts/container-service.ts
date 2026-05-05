/**
 * Container Service Contract
 *
 * Defines the public API for container operations
 * Implementation: ContainerService in src/services/ContainerService.ts
 */

import type { Container, ServiceError } from '../../models';

export interface ContainerService {
  /**
   * Create a new container in a space
   *
   * @param spaceId - ID of the space to create container in
   * @param name - Container name (1-50 characters)
   * @returns Created container with ID, spaceId, name, createdAt
   * @throws ServiceError with code 'VALIDATION_ERROR' if name is empty/invalid
   * @throws ServiceError with code 'DB_ERROR' if database operation fails
   */
  createContainer(spaceId: string, name: string): Promise<Container>;

  /**
   * Get all containers for a space
   *
   * @param spaceId - ID of the space
   * @returns Array of containers ordered by createdAt (ascending)
   * @returns Empty array if no containers exist
   * @throws ServiceError with code 'DB_ERROR' if database operation fails
   */
  getContainersBySpaceId(spaceId: string): Promise<Container[]>;
}

/**
 * Container Model
 *
 * Represents a grouping of items within a space
 */
export interface Container {
  id: string;           // UUID
  spaceId: string;      // UUID, reference to Space
  name: string;         // 1-50 characters
  createdAt: string;    // ISO 8601 timestamp
}

/**
 * Service Error Response
 *
 * Standard error format for service layer
 */
export interface ServiceError {
  code: 'VALIDATION_ERROR' | 'DB_ERROR' | 'NOT_FOUND_ERROR';
  message: string;
}
