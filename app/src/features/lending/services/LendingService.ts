/**
 * Lending Service
 *
 * Business logic layer for lending operations.
 * Enforces all business rules and constraints.
 * Coordinates between UI and Repository layers.
 *
 * Architecture: UI → Service → Repository → SQLite
 * Responsibility: Validation, business rules, error translation
 *
 * Feature: 009 - Lending Tracker
 */

import { LendingRepository } from '../repositories/LendingRepository';
import { Lending, LendingCreateInput, LendingStatus } from '../models/Lending';
import { ItemRepository } from '../../repositories/ItemRepository';

/**
 * Service Error
 *
 * Standard error structure for service layer.
 * Service always throws ServiceError (never SQLite errors directly).
 * UI translates these to user-friendly messages.
 */
interface ServiceError extends Error {
  code: string;
  message: string;
}

/**
 * Create ServiceError
 *
 * Helper to create standard service errors with code and message
 *
 * @param code - Machine-readable error code
 * @param message - User-friendly error message
 * @returns Error with code property
 */
function createServiceError(code: string, message: string): ServiceError {
  const error = new Error(message) as ServiceError;
  error.code = code;
  error.message = message;
  return error;
}

/**
 * Lending Service
 *
 * Orchestrates lending operations with business rule enforcement.
 * Single responsibility: Business logic coordination.
 *
 * Dependencies:
 * - LendingRepository: Data access
 * - ItemRepository: Item validation
 *
 * Business Rules Enforced:
 * - BR-001: One ACTIVE lending per item
 * - BR-002: Item must exist
 * - BR-003: Borrower name required
 * - BR-004: Can only return ACTIVE lendings
 * - BR-005: Lending records are immutable after return
 *
 * Error Codes:
 * - ITEM_NOT_FOUND: Item doesn't exist
 * - INVALID_BORROWER_NAME: Borrower name invalid
 * - DUPLICATE_ACTIVE_LENDING: Item already lent out
 * - LENDING_NOT_FOUND: Lending record not found
 * - INVALID_STATUS_TRANSITION: Lending not ACTIVE (can't return)
 * - DATABASE_ERROR: Unexpected database error
 */
export class LendingService {
  private lendingRepository: LendingRepository;
  private itemRepository: ItemRepository;

  /**
   * Constructor
   *
   * Dependency injection for repositories
   *
   * @param lendingRepository - LendingRepository instance
   * @param itemRepository - ItemRepository instance
   */
  constructor(
    lendingRepository: LendingRepository,
    itemRepository: ItemRepository
  ) {
    this.lendingRepository = lendingRepository;
    this.itemRepository = itemRepository;
  }

  /**
   * Create Lending
   *
   * Creates a new lending record with full validation.
   * Enforces BR-001 (one active per item), BR-002 (item exists), BR-003 (borrower name).
   *
   * Validation Flow:
   * 1. Validate borrower_name is provided and not empty
   * 2. Validate item exists in database
   * 3. Validate item doesn't already have ACTIVE lending
   * 4. Call repository to create lending
   * 5. Return created lending
   *
   * Business Rules:
   * - BR-001: Enforced by unique constraint + hasActiveLending check
   * - BR-002: Enforced by item lookup
   * - BR-003: Enforced by borrower validation
   *
   * @param input - LendingCreateInput (item_id, borrower_name, note?)
   * @returns Created Lending record
   * @throws ServiceError with code and message if validation fails
   */
  async createLending(input: LendingCreateInput): Promise<Lending> {
    // Validate borrower_name (BR-003)
    if (!input.borrower_name || !input.borrower_name.trim()) {
      throw createServiceError(
        'INVALID_BORROWER_NAME',
        'Borrower name is required'
      );
    }

    // Validate item exists (BR-002)
    let item: any;
    try {
      item = await this.itemRepository.getById(input.item_id);
    } catch (error) {
      console.error('ItemRepository.getById error:', error);
      throw createServiceError(
        'DATABASE_ERROR',
        'Failed to check item existence'
      );
    }

    if (!item) {
      throw createServiceError('ITEM_NOT_FOUND', 'Item not found');
    }

    // Validate no ACTIVE lending already exists (BR-001)
    let hasActive: boolean;
    try {
      hasActive = await this.lendingRepository.hasActiveLending(input.item_id);
    } catch (error) {
      throw createServiceError(
        'DATABASE_ERROR',
        'Failed to check existing lendings'
      );
    }

    if (hasActive) {
      throw createServiceError(
        'DUPLICATE_ACTIVE_LENDING',
        'Item is already lent out'
      );
    }

    // All validations passed, create lending
    let lending: Lending;
    try {
      lending = await this.lendingRepository.create({
        item_id: input.item_id,
        borrower_name: input.borrower_name.trim(),
        note: input.note ? input.note.trim() : undefined,
      });
    } catch (error: any) {
      console.error('LendingService.createLending repository.create error:', error);
      // Handle unique constraint violation from repository
      if (
        error.message &&
        error.message.toLowerCase().includes('unique')
      ) {
        throw createServiceError(
          'DUPLICATE_ACTIVE_LENDING',
          'Item is already lent out'
        );
      }
      throw createServiceError(
        'DATABASE_ERROR',
        'Failed to create lending'
      );
    }

    return lending;
  }

  /**
   * Mark Lending as Returned
   *
   * Marks an ACTIVE lending as RETURNED with timestamp.
   * Enforces BR-004: Can only return ACTIVE lendings.
   *
   * Validation Flow:
   * 1. Validate lending exists
   * 2. Validate lending is ACTIVE (not already returned)
   * 3. Call repository to update status
   * 4. Return updated lending
   *
   * Business Rules:
   * - BR-004: Only ACTIVE lendings can be returned
   * - BR-005: Records immutable after return (UI handles this)
   *
   * @param lendingId - Lending UUID
   * @returns Updated Lending with status='RETURNED'
   * @throws ServiceError with code and message if validation fails
   */
  async markAsReturned(lendingId: string): Promise<Lending> {
    // Validate lending exists
    let lending: Lending | null;
    try {
      lending = await this.lendingRepository.getById(lendingId);
    } catch (error) {
      throw createServiceError(
        'DATABASE_ERROR',
        'Failed to find lending'
      );
    }

    if (!lending) {
      throw createServiceError('LENDING_NOT_FOUND', 'Lending not found');
    }

    // Validate lending is ACTIVE (BR-004)
    if (lending.status !== LendingStatus.ACTIVE) {
      throw createServiceError(
        'INVALID_STATUS_TRANSITION',
        'Item already returned'
      );
    }

    // All validations passed, mark as returned
    let updated: Lending;
    try {
      updated = await this.lendingRepository.markAsReturned(lendingId);
    } catch (error) {
      throw createServiceError(
        'DATABASE_ERROR',
        'Failed to mark lending as returned'
      );
    }

    return updated;
  }

  /**
   * Get Active Lendings
   *
   * Fetches all ACTIVE lendings (currently lent out items).
   * Used for main lending tab view.
   * Sorted by most recent first.
   *
   * @returns Array of ACTIVE Lending records
   * @throws ServiceError if query fails
   */
  async getActiveLendings(): Promise<Lending[]> {
    try {
      return await this.lendingRepository.getByStatus(LendingStatus.ACTIVE);
    } catch (error) {
      throw createServiceError(
        'DATABASE_ERROR',
        'Failed to fetch active lendings'
      );
    }
  }

  /**
   * Get All Lendings
   *
   * Fetches all lendings (ACTIVE + RETURNED).
   * Used for history view.
   * Sorted by most recent first.
   *
   * @returns Array of all Lending records
   * @throws ServiceError if query fails
   */
  async getAllLendings(): Promise<Lending[]> {
    try {
      return await this.lendingRepository.getAll();
    } catch (error) {
      throw createServiceError(
        'DATABASE_ERROR',
        'Failed to fetch lending history'
      );
    }
  }

  /**
   * Can Lend Item
   *
   * Check if an item can be lent (i.e., doesn't have ACTIVE lending).
   * Helper for UI button enable/disable and form validation.
   *
   * @param itemId - Item UUID
   * @returns true if item can be lent; false if already lent
   * @throws ServiceError if query fails
   */
  async canLendItem(itemId: string): Promise<boolean> {
    try {
      const hasActive = await this.lendingRepository.hasActiveLending(itemId);
      return !hasActive;
    } catch (error) {
      throw createServiceError(
        'DATABASE_ERROR',
        'Failed to check item lend status'
      );
    }
  }

  /**
   * Get Lending by ID
   *
   * Fetches a single lending by ID.
   * Used for detail screens.
   *
   * @param lendingId - Lending UUID
   * @returns Lending record or null if not found
   * @throws ServiceError if query fails
   */
  async getLendingById(lendingId: string): Promise<Lending | null> {
    try {
      return await this.lendingRepository.getById(lendingId);
    } catch (error) {
      throw createServiceError(
        'DATABASE_ERROR',
        'Failed to fetch lending'
      );
    }
  }

  /**
   * Get Lendings by Item ID
   *
   * Fetches all lendings for a specific item (handles orphaned items).
   * Used for orphan handling and cleanup queries.
   *
   * @param itemId - Item UUID
   * @returns Array of Lending records for the item
   * @throws ServiceError if query fails
   */
  async getLendingsByItemId(itemId: string): Promise<Lending[]> {
    try {
      return await this.lendingRepository.getByItemId(itemId);
    } catch (error) {
      throw createServiceError(
        'DATABASE_ERROR',
        'Failed to fetch item lendings'
      );
    }
  }
}
