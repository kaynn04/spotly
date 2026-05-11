/**
 * OutsideSessionItemRepository
 * 
 * Data access layer for outside session items
 * Handles all database operations for item management within sessions
 * 
 * Implementation: T005
 */

import { getDatabase } from '../../../db/client';
import { OutsideSessionItem, OutsideSessionItemWithContext, OutsideSessionItemError, OutsideSessionItemErrorCode } from '../models/OutsideSessionItem';
import { generateUUID } from '../../../utils/uuid';

export class OutsideSessionItemRepository {
  /**
   * Add items to a session
   * Returns list of newly created items
   */
  async addItems(sessionId: string, itemIds: string[]): Promise<OutsideSessionItem[]> {
    const db = getDatabase();
    const results: OutsideSessionItem[] = [];

    try {
      for (const itemId of itemIds) {
        const id = generateUUID();

        await db.runAsync(
          'INSERT INTO outside_session_items (id, session_id, item_id, is_checked, checked_at) VALUES (?, ?, ?, ?, ?)',
          [id, sessionId, itemId, 0, null]
        );

        const result = await db.getFirstAsync<OutsideSessionItem>(
          'SELECT id, session_id, item_id, is_checked, checked_at FROM outside_session_items WHERE id = ?',
          [id]
        );

        if (result) {
          results.push(result);
        }
      }

      console.log(`✓ Added ${itemIds.length} items to session ${sessionId}`);
      return results;
    } catch (error) {
      console.error('✗ Error adding items to session:', error);
      throw error;
    }
  }

  /**
   * Get all items in a session with context (item name, space, container)
   */
  async getSessionItems(sessionId: string): Promise<OutsideSessionItemWithContext[]> {
    const db = getDatabase();

    try {
      const results = await db.getAllAsync<any>(
        `
        SELECT 
          osi.id,
          osi.session_id,
          osi.item_id,
          osi.is_checked,
          osi.checked_at,
          osi.moved_to_space_name,
          osi.moved_to_container_name,
          COALESCE(i.name, 'Unknown Item') as item_name,
          COALESCE(s.name, 'Unknown Space') as space_name,
          c.name as container_name,
          l.borrower_name as active_borrower_name
        FROM outside_session_items osi
        LEFT JOIN items i ON osi.item_id = i.id
        LEFT JOIN spaces s ON i.space_id = s.id
        LEFT JOIN containers c ON i.container_id = c.id
        LEFT JOIN lendings l ON l.item_id = osi.item_id AND l.status = 'ACTIVE'
        WHERE osi.session_id = ?
        ORDER BY i.name ASC
        `,
        [sessionId]
      );

      console.log('[OutsideSessionItemRepository] Raw results:', results);
      
      const parsed = (results || []).map((row: any) => ({
        id: String(row.id),
        session_id: String(row.session_id),
        item_id: String(row.item_id),
        is_checked: Number(row.is_checked),
        checked_at: row.checked_at,
        item_name: String(row.item_name || 'Unknown Item'),
        space_name: String(row.space_name || 'Unknown Space'),
        container_name: row.container_name ? String(row.container_name) : null,
        moved_to_space_name: row.moved_to_space_name ? String(row.moved_to_space_name) : null,
        moved_to_container_name: row.moved_to_container_name ? String(row.moved_to_container_name) : null,
        active_borrower_name: row.active_borrower_name ? String(row.active_borrower_name) : null,
      }));

      console.log('[OutsideSessionItemRepository] Parsed results:', parsed);
      return parsed;
    } catch (error) {
      console.error('✗ Error fetching session items:', error);
      throw error;
    }
  }

  /**
   * Toggle the check status of an item in a session
   */
  async toggleCheck(sessionId: string, itemId: string): Promise<OutsideSessionItem> {
    const db = getDatabase();

    try {
      // Get current state
      const current = await db.getFirstAsync<OutsideSessionItem>(
        'SELECT id, session_id, item_id, is_checked, checked_at FROM outside_session_items WHERE session_id = ? AND item_id = ?',
        [sessionId, itemId]
      );

      if (!current) {
        throw new OutsideSessionItemError(
          OutsideSessionItemErrorCode.SESSION_ITEM_NOT_FOUND,
          `Item ${itemId} not found in session ${sessionId}`
        );
      }

      // Toggle state
      const newCheckedState = current.is_checked ? 0 : 1;
      const newCheckedAt = newCheckedState ? new Date().toISOString() : null;

      await db.runAsync(
        'UPDATE outside_session_items SET is_checked = ?, checked_at = ? WHERE session_id = ? AND item_id = ?',
        [newCheckedState, newCheckedAt, sessionId, itemId]
      );

      // Return updated item
      const result = await db.getFirstAsync<OutsideSessionItem>(
        'SELECT id, session_id, item_id, is_checked, checked_at FROM outside_session_items WHERE session_id = ? AND item_id = ?',
        [sessionId, itemId]
      );

      if (!result) {
        throw new OutsideSessionItemError(
          OutsideSessionItemErrorCode.DATABASE_ERROR,
          'Failed to retrieve updated item'
        );
      }

      console.log(`✓ Toggled item ${itemId} in session ${sessionId}`);
      return result;
    } catch (error) {
      console.error('✗ Error toggling item check state:', error);
      throw error;
    }
  }

  /**
   * Remove an item from a session
   */
  async removeItem(sessionId: string, itemId: string): Promise<void> {
    const db = getDatabase();

    try {
      const existing = await db.getFirstAsync<OutsideSessionItem>(
        'SELECT id FROM outside_session_items WHERE session_id = ? AND item_id = ?',
        [sessionId, itemId]
      );

      if (!existing) {
        throw new OutsideSessionItemError(
          OutsideSessionItemErrorCode.SESSION_ITEM_NOT_FOUND,
          `Item ${itemId} not found in session ${sessionId}`
        );
      }

      await db.runAsync(
        'DELETE FROM outside_session_items WHERE session_id = ? AND item_id = ?',
        [sessionId, itemId]
      );

      console.log(`✓ Removed item ${itemId} from session ${sessionId}`);
    } catch (error) {
      console.error('✗ Error removing item from session:', error);
      throw error;
    }
  }

  /**
   * Get count of items and checked items in a session
   */
  async getSessionStats(sessionId: string): Promise<{ total: number; checked: number }> {
    const db = getDatabase();

    try {
      const stats = await db.getFirstAsync<{ total: number; checked: number }>(
        `
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN is_checked = 1 THEN 1 ELSE 0 END) as checked
        FROM outside_session_items
        WHERE session_id = ?
        `,
        [sessionId]
      );

      return stats || { total: 0, checked: 0 };
    } catch (error) {
      console.error('✗ Error fetching session stats:', error);
      throw error;
    }
  }

  /**
   * Get all item IDs that belong to the currently active session.
   * Returns an empty array if no active session exists.
   */
  async getActiveSessionItemIds(): Promise<string[]> {
    const db = getDatabase();
    try {
      const rows = await db.getAllAsync<{ item_id: string }>(
        `SELECT osi.item_id
         FROM outside_session_items osi
         INNER JOIN outside_sessions os ON osi.session_id = os.id
         WHERE os.status = 'ACTIVE'`
      );
      return (rows || []).map((r) => r.item_id);
    } catch (error) {
      console.error('✗ Error fetching active session item IDs:', error);
      return [];
    }
  }

  /**
   * Record that an item was moved to a different location during put-away
   */
  async recordMove(sessionId: string, itemId: string, spaceName: string, containerName: string | null): Promise<void> {
    const db = getDatabase();

    try {
      await db.runAsync(
        'UPDATE outside_session_items SET moved_to_space_name = ?, moved_to_container_name = ? WHERE session_id = ? AND item_id = ?',
        [spaceName, containerName, sessionId, itemId]
      );
      console.log(`✓ Recorded move for item ${itemId} in session ${sessionId}`);
    } catch (error) {
      console.error('✗ Error recording item move:', error);
      throw error;
    }
  }
}
