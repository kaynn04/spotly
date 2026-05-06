/**
 * OutsideSessionRepository
 * 
 * Data access layer for outside sessions
 * Handles all database operations for session CRUD
 * 
 * Implementation: T004
 */

import { getDatabase } from '../../../db/client';
import { OutsideSession, OutsideSessionStatus, OutsideSessionError, OutsideSessionErrorCode } from '../models/OutsideSession';
import { generateUUID } from '../../../utils/uuid';

export class OutsideSessionRepository {
  /**
   * Create a new outside session
   */
  async create(title: string): Promise<OutsideSession> {
    const db = getDatabase();
    const id = generateUUID();
    const now = new Date().toISOString();

    try {
      await db.execAsync(
        'INSERT INTO outside_sessions (id, title, status, created_at, completed_at) VALUES (?, ?, ?, ?, ?)',
        [id, title, OutsideSessionStatus.ACTIVE, now, null]
      );

      const result = await db.getFirstAsync<OutsideSession>(
        'SELECT id, title, status, created_at, completed_at FROM outside_sessions WHERE id = ?',
        [id]
      );

      if (!result) {
        throw new OutsideSessionError(
          OutsideSessionErrorCode.DATABASE_ERROR,
          'Failed to retrieve created session'
        );
      }

      console.log(`✓ Created outside session: ${id}`);
      return result;
    } catch (error) {
      console.error('✗ Error creating outside session:', error);
      throw error;
    }
  }

  /**
   * Get the active session
   */
  async getActive(): Promise<OutsideSession | null> {
    const db = getDatabase();

    try {
      const result = await db.getFirstAsync<OutsideSession>(
        'SELECT id, title, status, created_at, completed_at FROM outside_sessions WHERE status = ? ORDER BY created_at DESC LIMIT 1',
        [OutsideSessionStatus.ACTIVE]
      );

      return result || null;
    } catch (error) {
      console.error('✗ Error fetching active session:', error);
      throw error;
    }
  }

  /**
   * Get session by ID
   */
  async getById(id: string): Promise<OutsideSession | null> {
    const db = getDatabase();

    try {
      const result = await db.getFirstAsync<OutsideSession>(
        'SELECT id, title, status, created_at, completed_at FROM outside_sessions WHERE id = ?',
        [id]
      );

      return result || null;
    } catch (error) {
      console.error('✗ Error fetching session by id:', error);
      throw error;
    }
  }

  /**
   * Get all completed sessions
   */
  async getCompleted(): Promise<OutsideSession[]> {
    const db = getDatabase();

    try {
      const results = await db.getAllAsync<OutsideSession>(
        'SELECT id, title, status, created_at, completed_at FROM outside_sessions WHERE status = ? ORDER BY completed_at DESC',
        [OutsideSessionStatus.COMPLETED]
      );

      return results || [];
    } catch (error) {
      console.error('✗ Error fetching completed sessions:', error);
      throw error;
    }
  }

  /**
   * Mark session as completed
   */
  async complete(id: string): Promise<OutsideSession> {
    const db = getDatabase();
    const now = new Date().toISOString();

    try {
      const existing = await this.getById(id);
      if (!existing) {
        throw new OutsideSessionError(
          OutsideSessionErrorCode.SESSION_NOT_FOUND,
          `Session ${id} not found`
        );
      }

      await db.execAsync(
        'UPDATE outside_sessions SET status = ?, completed_at = ? WHERE id = ?',
        [OutsideSessionStatus.COMPLETED, now, id]
      );

      const result = await this.getById(id);
      if (!result) {
        throw new OutsideSessionError(
          OutsideSessionErrorCode.DATABASE_ERROR,
          'Failed to retrieve updated session'
        );
      }

      console.log(`✓ Completed outside session: ${id}`);
      return result;
    } catch (error) {
      console.error('✗ Error completing session:', error);
      throw error;
    }
  }

  /**
   * Delete session
   */
  async delete(id: string): Promise<void> {
    const db = getDatabase();

    try {
      const existing = await this.getById(id);
      if (!existing) {
        throw new OutsideSessionError(
          OutsideSessionErrorCode.SESSION_NOT_FOUND,
          `Session ${id} not found`
        );
      }

      await db.execAsync('DELETE FROM outside_sessions WHERE id = ?', [id]);

      console.log(`✓ Deleted outside session: ${id}`);
    } catch (error) {
      console.error('✗ Error deleting session:', error);
      throw error;
    }
  }
}
