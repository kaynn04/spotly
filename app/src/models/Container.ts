/**
 * Container Entity
 *
 * TypeScript types for Container domain model
 * Maps to containers table in SQLite
 *
 * Implementation: T001 - Create app/src/models/Container.ts
 */

/**
 * Container entity as returned by repository and service
 * Represents a logical grouping of items within a space
 */
export interface Container {
  id: string;                    // UUID, unique identifier
  name: string;                  // User-provided container name (1-50 chars)
  spaceId: string;               // Foreign key reference to space
  createdAt: string;             // ISO 8601 timestamp, immutable
  updatedAt?: string | null;     // ISO 8601 timestamp, last modification
  photoUri?: string | null;      // Optional: local file path to container photo
}

/**
 * Database row representation
 * Uses snake_case to match SQLite column names
 * Repository maps this to Container (camelCase) for service layer
 */
export interface ContainerRow {
  id: string;
  name: string;
  space_id: string;
  created_at: string;
  updated_at?: string | null;
  photo_uri?: string | null;
}

/**
 * Service error response
 * Returned from service layer operations
 */
export interface ServiceError {
  code: 'VALIDATION_ERROR' | 'DB_ERROR' | 'NOT_FOUND';
  message: string;               // User-friendly error message
}
