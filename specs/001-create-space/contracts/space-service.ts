/**
 * SpaceService Contract
 *
 * This is the public interface for space management operations.
 * Defines the contract between the UI layer and service layer.
 *
 * Generated from: create_space feature specification
 * Date: 2026-05-05
 */

/**
 * Space entity as returned by the service
 */
export interface Space {
  id: string;                    // UUID
  name: string;                  // Trimmed, 1-100 characters
  createdAt: string;             // ISO 8601 timestamp
  updatedAt: string;             // ISO 8601 timestamp
}

/**
 * Space entity with item count (for UI list display)
 */
export interface SpaceWithCount extends Space {
  itemCount: number;             // Number of items in space (0+)
}

/**
 * Input for creating a new space
 */
export interface CreateSpaceInput {
  name: string;                  // Will be trimmed and validated
}

/**
 * Error response from service
 */
export interface ServiceError {
  code: string;                  // Error code (e.g., "VALIDATION_ERROR", "DB_ERROR")
  message: string;               // User-friendly error message
}

/**
 * SpaceService - Business logic for space management
 *
 * Responsibilities:
 * - Validate space name (not empty, trimmed, ≤ 100 chars)
 * - Generate unique IDs
 * - Delegate persistence to SpaceRepository
 * - Handle errors and return meaningful messages
 *
 * Usage:
 *   const spaceService = new SpaceService(repository);
 *   const space = await spaceService.create("Home");
 */
export interface ISpaceService {
  /**
   * Create a new space
   *
   * Process:
   * 1. Trim input name
   * 2. Validate name (not empty, ≤ 100 chars)
   * 3. Generate UUID
   * 4. Call repository.create()
   * 5. Return Space object
   *
   * @param name - Space name (will be trimmed)
   * @returns Created Space object with id, name, createdAt, updatedAt
   * @throws ServiceError with code "VALIDATION_ERROR" if name is invalid
   * @throws ServiceError with code "DB_ERROR" if database write fails
   * @performance MUST complete within 500ms
   */
  create(name: string): Promise<Space>;

  /**
   * Retrieve all spaces for the current user
   *
   * @returns Array of Space objects (empty array if no spaces exist)
   * @performance Should be fast (<100ms) for < 20 spaces
   */
  getAll(): Promise<Space[]>;

  /**
   * Retrieve a single space by ID
   *
   * @param id - Space UUID
   * @returns Space object or null if not found
   * @performance O(1) with indexed lookup
   */
  getById(id: string): Promise<Space | null>;

  /**
   * Retrieve a space with item count for UI display
   *
   * @param id - Space UUID
   * @returns SpaceWithCount object or null if space not found
   * @performance O(1) for space lookup; O(n) for item count (n=items in space)
   */
  getSpaceWithItemCount(id: string): Promise<SpaceWithCount | null>;

  /**
   * Delete a space by ID
   *
   * Note: Item deletion behavior defined in item management spec
   *
   * @param id - Space UUID
   * @throws ServiceError if space not found or delete fails
   * @performance O(1)
   */
  delete(id: string): Promise<void>;
}

/**
 * Error Codes
 *
 * VALIDATION_ERROR: Input validation failed (empty name, > 100 chars, etc.)
 * DB_ERROR: Database operation failed (write, read, delete)
 * NOT_FOUND: Space with given ID does not exist
 */
export const ERROR_CODES = {
  VALIDATION_ERROR: "VALIDATION_ERROR",
  DB_ERROR: "DB_ERROR",
  NOT_FOUND: "NOT_FOUND",
} as const;

/**
 * Helper to create validation error
 */
export function createValidationError(message: string): ServiceError {
  return {
    code: ERROR_CODES.VALIDATION_ERROR,
    message,
  };
}

/**
 * Helper to create DB error
 */
export function createDbError(message: string = "Failed to create space. Try again."): ServiceError {
  return {
    code: ERROR_CODES.DB_ERROR,
    message,
  };
}

/**
 * Helper to create not found error
 */
export function createNotFoundError(id: string): ServiceError {
  return {
    code: ERROR_CODES.NOT_FOUND,
    message: `Space with ID ${id} not found`,
  };
}
