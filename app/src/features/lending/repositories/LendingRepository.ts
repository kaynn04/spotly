/**
 * Lending Repository
 *
 * Data access layer for Lending entities.
 * Handles all database operations for lendings.
 * Single source of truth for timestamps and persistence.
 *
 * Architecture: Repository is the ONLY layer that knows about SQLite
 * UI → Service → Repository → SQLite
 *
 * Feature: 009 - Lending Tracker
 */

import { getDatabase } from '../../../db/client';
import { Lending, LendingCreateInput, LendingStatus } from '../models/Lending';
import { generateUUID } from '../../../utils/uuid';

/**
 * LendingRepository
 *
 * Provides data access methods for lending operations.
 * All methods interact directly with SQLite.
 * All timestamps are generated here (repository is source of truth).
 *
 * Thread-safety: Not thread-safe (SQLite write queue may cause race conditions)
 * Handled by: Service layer validation + DB unique constraints
 *
 * Error handling: Throws native SQLite errors; Service layer translates to domain errors
 */
export class LendingRepository {
  private db: any;

  constructor() {
    this.db = getDatabase();
  }

  /**
   * Get lending by status (ACTIVE or RETURNED)
   *
   * Returns lendings filtered by status, sorted by lent_at descending (most recent first)
   *
   * Used by: LendingService.getActiveLendings(), LendingService.getAllLendings()
   *
   * Query: Uses index idx_lendings_status_date for efficient filtering + sorting
   *
   * @param status - LendingStatus.ACTIVE or LendingStatus.RETURNED
   * @returns Array of Lending records, sorted by date descending
   * @throws SQLite error if query fails
   */
  async getByStatus(status: LendingStatus): Promise<Lending[]> {
    const results = await this.db.getAllAsync(
      `SELECT * FROM lendings WHERE status = ? ORDER BY lent_at DESC`,
      [status]
    );
    return results.map(this.rowToLending.bind(this));
  }

  /**
   * Get all lendings (both ACTIVE and RETURNED)
   *
   * Returns all lending records sorted by lent_at descending (most recent first)
   *
   * Used by: LendingService.getAllLendings() for history view
   *
   * Query: Scans all lendings, sorted by date
   *
   * @returns Array of all Lending records
   * @throws SQLite error if query fails
   */
  async getAll(): Promise<Lending[]> {
    const results = await this.db.getAllAsync(
      `SELECT * FROM lendings ORDER BY lent_at DESC`
    );
    return results.map(this.rowToLending.bind(this));
  }

  /**
   * Get lending by ID
   *
   * Fetches a single lending record by its primary key.
   * Returns null if not found.
   *
   * Used by: LendingService.markAsReturned(), LendingDetailScreen
   *
   * @param id - Lending UUID
   * @returns Lending record or null if not found
   * @throws SQLite error if query fails
   */
  async getById(id: string): Promise<Lending | null> {
    const result = await this.db.getFirstAsync(
      `SELECT * FROM lendings WHERE id = ?`,
      [id]
    );
    return result ? this.rowToLending(result) : null;
  }

  /**
   * Get lending by item ID
   *
   * Finds all lendings associated with a specific item.
   * Handles orphaned items (item may have been deleted).
   *
   * Used by: Cleanup queries, orphaned item handling
   *
   * Query: Uses index idx_lendings_item_id
   *
   * @param itemId - Item UUID
   * @returns Array of Lending records for the item
   * @throws SQLite error if query fails
   */
  async getByItemId(itemId: string): Promise<Lending[]> {
    const results = await this.db.getAllAsync(
      `SELECT * FROM lendings WHERE item_id = ? ORDER BY lent_at DESC`,
      [itemId]
    );
    return results.map(this.rowToLending.bind(this));
  }

  /**
   * Get the current ACTIVE lending for a single item, or null.
   */
  async getActiveLendingForItem(itemId: string): Promise<Lending | null> {
    const result = await this.db.getFirstAsync(
      `SELECT * FROM lendings WHERE item_id = ? AND status = ? LIMIT 1`,
      [itemId, LendingStatus.ACTIVE]
    );
    return result ? this.rowToLending(result) : null;
  }

  /**
   * Check if item has an ACTIVE lending
   *
   * Quick boolean check for BR-001: "One item can only have one ACTIVE lending at a time"
   *
   * Used by: LendingService.createLending() validation, LendingService.canLendItem()
   *
   * Query: Uses unique index idx_lendings_active for O(1) lookup
   *
   * @param itemId - Item UUID
   * @returns true if item has ACTIVE lending; false otherwise
   * @throws SQLite error if query fails
   */
  async hasActiveLending(itemId: string): Promise<boolean> {
    console.log('[LendingRepository.hasActiveLending] Checking for item:', itemId);
    const result = await this.db.getFirstAsync(
      `SELECT 1 FROM lendings WHERE item_id = ? AND status = ?`,
      [itemId, LendingStatus.ACTIVE]
    );
    const hasActive = result !== null && result !== undefined;
    console.log('[LendingRepository.hasActiveLending] Result:', { hasActive, result });
    return hasActive;
  }

  /**
   * Create new lending record
   *
   * Inserts a new lending into the database.
   * Generates UUID and all timestamps here (repository is source of truth).
   * Initial status is always ACTIVE; returned_at is null.
   *
   * Used by: LendingService.createLending()
   *
   * Timestamps generated by repository:
   * - id: UUID (new)
   * - lent_at: Now (ISO 8601)
   * - created_at: Now (ISO 8601)
   * - updated_at: Now (ISO 8601)
   * - returned_at: null (will be set on return)
   *
   * @param input - LendingCreateInput (item_id, borrower_name, note?)
   * @returns Created Lending with all fields populated
   * @throws SQLite error (likely unique constraint violation if item already lent)
   */
  async create(input: LendingCreateInput): Promise<Lending> {
    const id = generateUUID();
    const now = new Date().toISOString();

    console.log('[LendingRepository.create] Starting with:', {
      id,
      item_id: input.item_id,
      borrower_name: input.borrower_name,
      timestamp: now,
    });

    try {
      console.log('[LendingRepository.create] Executing INSERT...');
      await this.db.runAsync(
        `INSERT INTO lendings (
          id, item_id, borrower_name, note, lent_at, returned_at, status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          input.item_id,
          input.borrower_name,
          input.note || null,
          now,
          null,
          LendingStatus.ACTIVE,
          now,
          now,
        ]
      );
      console.log('[LendingRepository.create] INSERT successful');
    } catch (error) {
      console.error('[LendingRepository.create] INSERT error:', error);
      throw error;
    }

    // Return created lending
    try {
      console.log('[LendingRepository.create] Fetching created record...');
      const created = await this.getById(id);
      if (!created) {
        throw new Error('Failed to retrieve created lending');
      }
      console.log('[LendingRepository.create] Created lending:', created);
      return created;
    } catch (error) {
      console.error('[LendingRepository.create] getById error:', error);
      throw error;
    }
  }

  /**
   * Mark lending as returned
   *
   * Updates existing lending from ACTIVE to RETURNED status.
   * Sets returned_at timestamp and updates updated_at.
   * Atomic operation (single UPDATE statement).
   *
   * Used by: LendingService.markAsReturned()
   *
   * Preconditions (checked by service layer):
   * - Lending exists (id is valid)
   * - Lending is ACTIVE (not already returned)
   *
   * @param id - Lending UUID
   * @returns Updated Lending with status='RETURNED' and returned_at set
   * @throws SQLite error if query fails or lending not found
   */
  async markAsReturned(id: string): Promise<Lending> {
    const now = new Date().toISOString();

    await this.db.runAsync(
      `UPDATE lendings SET status = ?, returned_at = ?, updated_at = ? WHERE id = ?`,
      [LendingStatus.RETURNED, now, now, id]
    );

    // Return updated lending
    const updated = await this.getById(id);
    if (!updated) {
      throw new Error('Failed to retrieve updated lending');
    }
    return updated;
  }

  /**
   * Convert database row to Lending domain object
   *
   * Handles type conversions and null values.
   * Private helper for mapping query results to domain objects.
   *
   * @param row - Database row from query result
   * @returns Lending domain object
   */
  private rowToLending(row: any): Lending {
    return {
      id: row.id,
      item_id: row.item_id,
      borrower_name: row.borrower_name,
      note: row.note || undefined,
      lent_at: new Date(row.lent_at),
      returned_at: row.returned_at ? new Date(row.returned_at) : null,
      status: row.status as LendingStatus,
      created_at: new Date(row.created_at),
      updated_at: new Date(row.updated_at),
    };
  }
}
