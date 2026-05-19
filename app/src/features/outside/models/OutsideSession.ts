/**
 * Outside Session Domain Models
 * 
 * Types and DTOs for managing temporary outside checklist sessions.
 */

export enum OutsideSessionStatus {
  ACTIVE = 'ACTIVE',
  COMPLETED = 'COMPLETED',
}

export interface OutsideSession {
  id: string;
  title: string;
  status: OutsideSessionStatus;
  created_at: string; // ISO timestamp
  completed_at: string | null;
}

export interface OutsideSessionCreateDTO {
  title: string;
}

export interface OutsideSessionUpdateDTO {
  status?: OutsideSessionStatus;
  completed_at?: string | null;
}

export interface OutsideSessionWithItemCount extends OutsideSession {
  item_count: number;
  checked_count: number;
  return_checked_count: number;
}

/**
 * Service-level error codes
 */
export enum OutsideSessionErrorCode {
  ACTIVE_SESSION_EXISTS = 'ACTIVE_SESSION_EXISTS',
  SESSION_NOT_FOUND = 'SESSION_NOT_FOUND',
  SESSION_NOT_ACTIVE = 'SESSION_NOT_ACTIVE',
  INVALID_TITLE = 'INVALID_TITLE',
  DATABASE_ERROR = 'DATABASE_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

export class OutsideSessionError extends Error {
  constructor(
    public code: OutsideSessionErrorCode,
    message: string,
    public details?: Record<string, any>
  ) {
    super(message);
    this.name = 'OutsideSessionError';
  }
}
