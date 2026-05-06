/**
 * Outside Session Item Domain Models
 * 
 * Types and DTOs for managing items within an outside checklist session.
 */

export interface OutsideSessionItem {
  id: string;
  session_id: string;
  item_id: string;
  is_checked: number | boolean;  // SQLite returns 0/1, convert to boolean as needed
  checked_at: string | null; // ISO timestamp when checked
}

export interface OutsideSessionItemCreateDTO {
  item_id: string;
}

export interface OutsideSessionItemUpdateDTO {
  is_checked?: boolean;
  checked_at?: string | null;
}

export interface OutsideSessionItemWithContext extends OutsideSessionItem {
  item_name: string;
  space_name: string | null;
  container_name: string | null;
}

/**
 * Service-level error codes for items
 */
export enum OutsideSessionItemErrorCode {
  ITEM_NOT_FOUND = 'ITEM_NOT_FOUND',
  SESSION_ITEM_NOT_FOUND = 'SESSION_ITEM_NOT_FOUND',
  DUPLICATE_ITEM = 'DUPLICATE_ITEM',
  INVALID_SESSION = 'INVALID_SESSION',
  DATABASE_ERROR = 'DATABASE_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

export class OutsideSessionItemError extends Error {
  constructor(
    public code: OutsideSessionItemErrorCode,
    message: string,
    public details?: Record<string, any>
  ) {
    super(message);
    this.name = 'OutsideSessionItemError';
  }
}
