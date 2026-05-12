/**
 * Item Service
 *
 * Business logic layer for Item operations
 * Handles validation and delegates to repository for data access
 *
 * Implementation: T004 - Create app/src/services/ItemService.ts
 */

import type { Item, ServiceError } from '../models/Item';
import { ItemRepository } from '../repositories/ItemRepository';
import { PhotoService } from './PhotoService';

/**
 * ItemService handles all item-related business logic
 * Validates inputs before persisting to database
 */
export class ItemService {
  /**
   * Create a new item
   *
   * @param spaceId - The space id this item belongs to
   * @param name - Item name from user input
   * @param containerId - Optional container id (null for space-level items)
   * @returns The created Item object with id, name, spaceId, and timestamp
   * @throws ServiceError if validation fails or database operation fails
   *
   * Validation:
   * - Trims input
   * - Requires non-empty name after trimming
   */
  static async createItem(
    spaceId: string,
    name: string,
    containerId?: string | null,
    description?: string | null,
    quantity?: number,
    photoUri?: string | null
  ): Promise<Item> {
    try {
      // Trim input
      const trimmedName = name.trim();

      // Validate: must not be empty after trimming
      if (trimmedName.length === 0) {
        const error: ServiceError = {
          code: 'VALIDATION_ERROR',
          message: 'Item name cannot be empty.',
        };
        throw error;
      }

      // Create item in database via repository
      const item = await ItemRepository.createItem(trimmedName, spaceId, containerId, description, quantity, photoUri);

      return item;
    } catch (error) {
      // If already a ServiceError, re-throw it
      if (error && typeof error === 'object' && 'code' in error) {
        throw error;
      }

      // Convert unexpected errors to ServiceError
      const serviceError: ServiceError = {
        code: 'DB_ERROR',
        message: 'Failed to create item. Try again.',
      };

      console.error('[ItemService.createItem] Unexpected error:', error);
      throw serviceError;
    }
  }

  /**
   * Get all items for a specific space
   *
   * @param spaceId - The space id to retrieve items for
   * @returns Array of Item objects ordered by creation date (most recent first)
   * @throws ServiceError if database operation fails
   */
  static async getItemsBySpaceId(spaceId: string): Promise<Item[]> {
    return ItemRepository.getItemsBySpaceId(spaceId);
  }

  /**
   * Get all items in a specific container
   *
   * @param containerId - The container id to retrieve items for
   * @returns Array of Item objects ordered by creation date (most recent first)
   * @throws ServiceError if database operation fails
   */
  static async getItemsByContainerId(containerId: string): Promise<Item[]> {
    return ItemRepository.getItemsByContainerId(containerId);
  }

  /**
   * Move an item to a different space
   *
   * @param itemId - The item id to move
   * @param currentSpaceId - The current space id (for validation)
   * @param newSpaceId - The new space id to move the item to
   * @returns void (no return value)
   * @throws ServiceError if validation fails or database operation fails
   *
   * Validation:
   * - Prevents moving item to its current space (no-op)
   */
  static async moveItem(
    itemId: string,
    currentSpaceId: string,
    newSpaceId: string
  ): Promise<void> {
    try {
      // Validate: prevent moving to same space
      if (newSpaceId === currentSpaceId) {
        const error: ServiceError = {
          code: 'VALIDATION_ERROR',
          message: 'Cannot move item to same space.',
        };
        throw error;
      }

      // Move item in database via repository
      await ItemRepository.updateSpaceId(itemId, newSpaceId);
    } catch (error) {
      // If already a ServiceError, re-throw it
      if (error && typeof error === 'object' && 'code' in error) {
        throw error;
      }

      // Convert unexpected errors to ServiceError
      const serviceError: ServiceError = {
        code: 'DB_ERROR',
        message: 'Failed to move item. Try again.',
      };

      console.error('[ItemService.moveItem] Unexpected error:', error);
      throw serviceError;
    }
  }

  /**
   * Move an item to a container within the same space
   * Pass empty string to move item to root space (remove from container)
   *
   * @param itemId - The item id to move
   * @param spaceId - The space id (for validation)
   * @param containerId - The container id to move the item to (empty string for root space)
   * @returns void (no return value)
   * @throws ServiceError if validation fails or database operation fails
   *
   * Validation:
   * - Item must be in the same space as the container
   * - Empty containerId moves item to root of space
   */
  static async moveItemToContainer(
    itemId: string,
    spaceId: string,
    containerId: string
  ): Promise<void> {
    try {
      // Move item to container in database via repository — updates both space_id and container_id
      await ItemRepository.updateSpaceAndContainer(itemId, spaceId, containerId);
    } catch (error) {
      // If already a ServiceError, re-throw it
      if (error && typeof error === 'object' && 'code' in error) {
        throw error;
      }

      // Convert unexpected errors to ServiceError
      const serviceError: ServiceError = {
        code: 'DB_ERROR',
        message: 'Failed to move item to container. Try again.',
      };

      console.error('[ItemService.moveItemToContainer] Unexpected error:', error);
      throw serviceError;
    }
  }

  /**
   * Delete an item (permanent deletion)
   *
   * @param itemId - The item id to delete
   * @returns void (no return value)
   * @throws ServiceError if database operation fails
   *
   * Note: Deletion is permanent and cannot be undone.
   */
  static async deleteItem(itemId: string): Promise<void> {
    try {
      // Fetch item to get the stored photoUri before deleting
      const item = await ItemRepository.getById(itemId);
      if (item?.photoUri) {
        await PhotoService.deletePhoto(item.photoUri);
      }
      // Delete item from database via repository
      await ItemRepository.deleteItem(itemId);
    } catch (error) {
      // If already a ServiceError, re-throw it
      if (error && typeof error === 'object' && 'code' in error) {
        throw error;
      }

      // Convert unexpected errors to ServiceError
      const serviceError: ServiceError = {
        code: 'DB_ERROR',
        message: 'Failed to delete item. Try again.',
      };

      console.error('[ItemService.deleteItem] Unexpected error:', error);
      throw serviceError;
    }
  }

  /**
   * Get a single item by ID with full context (space/container names)
   */
  static async getItemById(itemId: string): Promise<Item | null> {
    return ItemRepository.getItemById(itemId);
  }

  /**
   * Get all items across all spaces
   */
  static async getAllItems(): Promise<Item[]> {
    const repo = new ItemRepository();
    return repo.getAll();
  }

  /**
   * Update item fields (name, description, quantity)
   */
  static async updateItem(itemId: string, updates: { name?: string; description?: string | null; quantity?: number }): Promise<void> {
    if (updates.name !== undefined) {
      const trimmed = updates.name.trim();
      if (trimmed.length === 0) {
        const error: ServiceError = { code: 'VALIDATION_ERROR', message: 'Item name cannot be empty.' };
        throw error;
      }
      updates.name = trimmed;
    }
    return ItemRepository.updateItem(itemId, updates);
  }
}
