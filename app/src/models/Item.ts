/**
 * Item Entity
 *
 * TypeScript types for Item domain model
 * Maps to items table in SQLite
 *
 * Implementation: T001 - Create app/src/models/Item.ts
 */

/**
 * Item entity as returned by repository and service
 * Represents an item within a space (at space-level or in a container)
 */
export interface Item {
  id: string;                    // UUID, unique identifier
  name: string;                  // User-provided item name
  description?: string | null;   // Optional description/notes
  quantity: number;              // Quantity (default 1)
  spaceId: string;               // Foreign key reference to space
  containerId?: string | null;   // Optional: FK reference to container (null = space-level item)
  createdAt: string;             // ISO 8601 timestamp, immutable
  space?: { name: string } | null;       // Optional: space details with name
  container?: { name: string } | null;   // Optional: container details with name
}

/**
 * Database row representation
 * Uses snake_case to match SQLite column names
 * Repository maps this to Item (camelCase) for service layer
 */
export interface ItemRow {
  id: string;
  name: string;
  description?: string | null;
  quantity: number;
  space_id: string;
  container_id?: string | null;  // Optional container reference
  created_at: string;
}

/**
 * Service error response
 * Returned from service layer operations
 */
export interface ServiceError {
  code: 'VALIDATION_ERROR' | 'DB_ERROR' | 'NOT_FOUND';
  message: string;               // User-friendly error message
}
