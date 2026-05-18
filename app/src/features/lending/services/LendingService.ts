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
import { LendingPhotoRepository } from '../repositories/LendingPhotoRepository';
import { Lending, LendingCreateInput, LendingStatus } from '../models/Lending';
import { LendingPhoto, LendingPhotoPhase } from '../models/LendingPhoto';
import { ItemRepository } from '../../../repositories/ItemRepository';
import { PhotoService } from '../../../services/PhotoService';
import { ReminderService } from '../../../services/ReminderService';

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
  private lendingPhotoRepository: LendingPhotoRepository;
  private itemRepository: ItemRepository;

  constructor(
    lendingRepository: LendingRepository,
    itemRepository: ItemRepository
  ) {
    this.lendingRepository = lendingRepository;
    this.lendingPhotoRepository = new LendingPhotoRepository();
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
    console.log('[LendingService.createLending] Starting with:', {
      item_id: input.item_id,
      borrower_name: input.borrower_name,
    });

    // Validate borrower_name (BR-003)
    if (!input.borrower_name || !input.borrower_name.trim()) {
      console.log('[LendingService.createLending] Validation failed: invalid borrower name');
      throw createServiceError(
        'INVALID_BORROWER_NAME',
        'Borrower name is required'
      );
    }

    // Validate item exists (BR-002)
    let item: any;
    try {
      console.log('[LendingService.createLending] Checking if item exists:', input.item_id);
      item = await this.itemRepository.getById(input.item_id);
      console.log('[LendingService.createLending] Item lookup result:', { item });
    } catch (error) {
      console.error('ItemRepository.getById error:', error);
      throw createServiceError(
        'DATABASE_ERROR',
        'Failed to check item existence'
      );
    }

    if (!item) {
      console.log('[LendingService.createLending] Item not found:', input.item_id);
      throw createServiceError('ITEM_NOT_FOUND', 'Item not found');
    }

    // Validate no ACTIVE lending already exists (BR-001)
    let hasActive: boolean;
    try {
      console.log('[LendingService.createLending] Checking for active lendings...');
      hasActive = await this.lendingRepository.hasActiveLending(input.item_id);
      console.log('[LendingService.createLending] Active lending check:', { hasActive });
    } catch (error) {
      console.error('[LendingService.createLending] hasActiveLending error:', error);
      throw createServiceError(
        'DATABASE_ERROR',
        'Failed to check existing lendings'
      );
    }

    if (hasActive) {
      console.log('[LendingService.createLending] Item already has active lending');
      throw createServiceError(
        'DUPLICATE_ACTIVE_LENDING',
        'Item is already lent out'
      );
    }

    // All validations passed, create lending
    let lending: Lending;
    try {
      console.log('[LendingService.createLending] All validations passed, calling repository.create()');
      lending = await this.lendingRepository.create({
        item_id: input.item_id,
        borrower_name: input.borrower_name.trim(),
        note: input.note ? input.note.trim() : undefined,
        due_date: input.due_date ?? null,
      });
      console.log('[LendingService.createLending] Lending created successfully:', lending);
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

    if (input.due_date) {
      try {
        const reminderId = await ReminderService.scheduleDueDateReminders(
          lending.id,
          lending.borrower_name,
          item.name,
          input.due_date
        );
        if (reminderId) {
          await this.lendingRepository.setReminderId(lending.id, reminderId);
          lending.reminder_id = reminderId;
        }
      } catch (error) {
        console.warn('[LendingService.createLending] Failed to schedule due-date reminder:', error);
      }
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

    if (lending.reminder_id) {
      try {
        await ReminderService.cancelReminders(lending.reminder_id);
      } catch (error) {
        console.warn('[LendingService.markAsReturned] Failed to cancel due-date reminder:', error);
      }
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

  async updateLending(
    lendingId: string,
    updates: { borrower_name: string; note?: string | null; due_date?: Date | null }
  ): Promise<Lending> {
    if (!updates.borrower_name || !updates.borrower_name.trim()) {
      throw createServiceError('INVALID_BORROWER_NAME', 'Borrower name is required');
    }

    let existing: Lending | null;
    try {
      existing = await this.lendingRepository.getById(lendingId);
    } catch {
      throw createServiceError('DATABASE_ERROR', 'Failed to find lending');
    }

    if (!existing) {
      throw createServiceError('LENDING_NOT_FOUND', 'Lending not found');
    }

    if (existing.status !== LendingStatus.ACTIVE) {
      throw createServiceError('INVALID_STATUS_TRANSITION', 'Returned lendings cannot be edited');
    }

    let updated: Lending;
    try {
      updated = await this.lendingRepository.update(lendingId, {
        borrower_name: updates.borrower_name.trim(),
        note: updates.note?.trim() || null,
        due_date: updates.due_date ?? null,
      });
    } catch {
      throw createServiceError('DATABASE_ERROR', 'Failed to update lending');
    }

    return updated;
  }

  async deleteLending(lendingId: string): Promise<void> {
    let lending: Lending | null;
    try {
      lending = await this.lendingRepository.getById(lendingId);
    } catch {
      throw createServiceError('DATABASE_ERROR', 'Failed to find lending');
    }

    if (!lending) {
      throw createServiceError('LENDING_NOT_FOUND', 'Lending not found');
    }

    if (lending.reminder_id) {
      try {
        await ReminderService.cancelReminders(lending.reminder_id);
      } catch (error) {
        console.warn('[LendingService.deleteLending] Failed to cancel due-date reminder:', error);
      }
    }

    try {
      await this.lendingRepository.delete(lendingId);
    } catch {
      throw createServiceError('DATABASE_ERROR', 'Failed to delete lending');
    }
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

  async getActiveLendingsWithItemNames(): Promise<(Lending & { item_name: string })[]> {
    try {
      return await this.lendingRepository.getActiveLendingsWithItemNames();
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

  /**
   * Get the current ACTIVE lending for a single item, or null if not lent.
   */
  async getActiveLendingForItem(itemId: string): Promise<Lending | null> {
    try {
      return await this.lendingRepository.getActiveLendingForItem(itemId);
    } catch (error) {
      throw createServiceError('DATABASE_ERROR', 'Failed to check lending status');
    }
  }

  // ─── Photo Methods ───────────────────────────────────────────────────────────

  async getPhotos(lendingId: string, phase?: LendingPhotoPhase): Promise<LendingPhoto[]> {
    try {
      return await this.lendingPhotoRepository.getByLendingId(lendingId, phase);
    } catch (error) {
      throw createServiceError('DATABASE_ERROR', 'Failed to fetch lending photos');
    }
  }

  async addPhoto(lendingId: string, phase: LendingPhotoPhase, tempUri: string): Promise<LendingPhoto> {
    try {
      const key = `lending_${lendingId}_${phase}`;
      const savedUri = await PhotoService.savePhoto(tempUri, key);
      return await this.lendingPhotoRepository.create({ lending_id: lendingId, phase, photo_uri: savedUri });
    } catch (error: any) {
      if (error?.message === 'MAX_PHOTOS_EXCEEDED') {
        throw createServiceError('MAX_PHOTOS_EXCEEDED', `Maximum 4 photos allowed per phase`);
      }
      throw createServiceError('DATABASE_ERROR', 'Failed to add lending photo');
    }
  }

  async deletePhoto(photoId: string, photoUri: string): Promise<void> {
    try {
      await this.lendingPhotoRepository.delete(photoId);
      await PhotoService.deletePhoto(photoUri);
    } catch (error) {
      throw createServiceError('DATABASE_ERROR', 'Failed to delete lending photo');
    }
  }
}
