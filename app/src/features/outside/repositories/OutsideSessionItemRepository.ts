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
      const results = await db.getAllAsync<OutsideSessionItemWithContext>(
        `
        SELECT 
          osi.id,
          osi.session_id,
          osi.item_id,
          osi.is_checked,
          osi.checked_at,
          i.name as item_name,
          s.name as space_name,
          c.name as container_name
        FROM outside_session_items osi
        LEFT JOIN items i ON osi.item_id = i.id
        LEFT JOIN spaces s ON i.space_id = s.id
        LEFT JOIN containers c ON i.container_id = c.id
        WHERE osi.session_id = ?
        ORDER BY i.name ASC
        `,
        [sessionId]
      );

      return results || [];
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
}
