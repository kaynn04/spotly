/**
 * Space Entity
 * 
 * TypeScript types for Space domain model
 * Maps to spaces table in SQLite
 * 
 * Implementation: T007 - Create app/src/models/Space.ts
 */

/**
 * Space entity as returned by repository and service
 * Represents a physical location for organizing items
 */
export interface Space {
  id: string;                    // UUID, unique identifier
  name: string;                  // User-provided name (1-100 chars, trimmed)
  createdAt: string;             // ISO 8601 timestamp, immutable
  updatedAt: string;             // ISO 8601 timestamp, updated when modified
}

/**
 * Space with item count for UI list display
 * Includes aggregated count from items table (when available)
 */
export interface SpaceWithCount extends Space {
  itemCount: number;             // Number of direct items in this space (0+)
  containerCount: number;        // Number of containers in this space (0+)
}

/**
 * Input for creating a new space
 * Raw input from UI form
 */
export interface CreateSpaceInput {
  name: string;                  // Will be trimmed and validated by service
}

/**
 * Database row representation
 * Uses snake_case to match SQLite column names
 * Repository maps this to Space (camelCase) for service layer
 */
export interface SpaceRow {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

/**
 * Service error response
 * Returned from service layer operations
 */
export interface ServiceError {
  code: 'VALIDATION_ERROR' | 'DB_ERROR' | 'NOT_FOUND';
  message: string;               // User-friendly error message
}

/**
 * Validation result
 * Used by service layer to validate inputs before persistence
 */
export interface ValidationResult {
  isValid: boolean;
  error?: string;                // Error message if validation fails
}
