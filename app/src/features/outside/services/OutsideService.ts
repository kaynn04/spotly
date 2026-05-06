/**
 * OutsideService
 * 
 * Business logic layer for outside sessions
 * Handles validation, error handling, and orchestration
 * 
 * Implementation: T006
 */

import { useMemo } from 'react';
import { OutsideSessionRepository } from '../repositories/OutsideSessionRepository';
import { OutsideSessionItemRepository } from '../repositories/OutsideSessionItemRepository';
import { OutsideSession, OutsideSessionError, OutsideSessionErrorCode, OutsideSessionStatus } from '../models/OutsideSession';
import { OutsideSessionItemWithContext, OutsideSessionItemError, OutsideSessionItemErrorCode } from '../models/OutsideSessionItem';

export enum OutsideServiceErrorCode {
  ACTIVE_SESSION_EXISTS = 'ACTIVE_SESSION_EXISTS',
  SESSION_NOT_FOUND = 'SESSION_NOT_FOUND',
  SESSION_NOT_ACTIVE = 'SESSION_NOT_ACTIVE',
  INVALID_TITLE = 'INVALID_TITLE',
  ITEM_NOT_FOUND = 'ITEM_NOT_FOUND',
  DUPLICATE_ITEM = 'DUPLICATE_ITEM',
  DATABASE_ERROR = 'DATABASE_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

export class OutsideServiceError extends Error {
  constructor(
    public code: OutsideServiceErrorCode,
    message: string,
    public details?: Record<string, any>
  ) {
    super(message);
    this.name = 'OutsideServiceError';
  }
}

export class OutsideService {
  private sessionRepository: OutsideSessionRepository;
  private itemRepository: OutsideSessionItemRepository;

  constructor() {
    this.sessionRepository = new OutsideSessionRepository();
    this.itemRepository = new OutsideSessionItemRepository();
  }

  /**
   * Create a new outside session
   */
  async createSession(title: string): Promise<OutsideSession> {
    // Validate title
    if (!title || title.trim().length === 0) {
      throw new OutsideServiceError(
        OutsideServiceErrorCode.INVALID_TITLE,
        'Session title cannot be empty'
      );
    }

    if (title.length > 100) {
      throw new OutsideServiceError(
        OutsideServiceErrorCode.INVALID_TITLE,
        'Session title cannot exceed 100 characters'
      );
    }

    try {
      // Check for existing active session
      const existing = await this.sessionRepository.getActive();
      if (existing) {
        throw new OutsideServiceError(
          OutsideServiceErrorCode.ACTIVE_SESSION_EXISTS,
          'An active session already exists. Complete or delete it before creating a new one.'
        );
      }

      // Create session
      const session = await this.sessionRepository.create(title.trim());
      console.log(`✓ Service: Created session ${session.id}`);
      return session;
    } catch (error) {
      if (error instanceof OutsideServiceError) throw error;
      console.error('✗ Service: Error creating session:', error);
      throw new OutsideServiceError(
        OutsideServiceErrorCode.DATABASE_ERROR,
        'Failed to create session',
        { originalError: error }
      );
    }
  }

  /**
   * Get the active session with item counts
   */
  async getActiveSession(): Promise<(OutsideSession & { itemCount: number; checkedCount: number }) | null> {
    try {
      const session = await this.sessionRepository.getActive();
      if (!session) return null;

      const stats = await this.itemRepository.getSessionStats(session.id);
      return {
        ...session,
        itemCount: stats.total,
        checkedCount: stats.checked,
      };
    } catch (error) {
      console.error('✗ Service: Error getting active session:', error);
      throw new OutsideServiceError(
        OutsideServiceErrorCode.DATABASE_ERROR,
        'Failed to retrieve active session',
        { originalError: error }
      );
    }
  }

  /**
   * Get session by ID with item counts
   */
  async getSession(id: string): Promise<(OutsideSession & { itemCount: number; checkedCount: number }) | null> {
    try {
      const session = await this.sessionRepository.getById(id);
      if (!session) return null;

      const stats = await this.itemRepository.getSessionStats(id);
      return {
        ...session,
        itemCount: stats.total,
        checkedCount: stats.checked,
      };
    } catch (error) {
      console.error('✗ Service: Error getting session:', error);
      throw new OutsideServiceError(
        OutsideServiceErrorCode.DATABASE_ERROR,
        'Failed to retrieve session',
        { originalError: error }
      );
    }
  }

  /**
   * Add items to an active session
   * Prevents duplicates by filtering existing items
   */
  async addItemsToSession(sessionId: string, itemIds: string[]): Promise<void> {
    try {
      // Verify session exists and is active
      const session = await this.sessionRepository.getById(sessionId);
      if (!session) {
        throw new OutsideServiceError(
          OutsideServiceErrorCode.SESSION_NOT_FOUND,
          `Session ${sessionId} not found`
        );
      }

      if (session.status !== OutsideSessionStatus.ACTIVE) {
        throw new OutsideServiceError(
          OutsideServiceErrorCode.SESSION_NOT_ACTIVE,
          'Can only add items to active sessions'
        );
      }

      // Get existing items in session
      const existingItems = await this.itemRepository.getSessionItems(sessionId);
      const existingItemIds = new Set(existingItems.map(item => item.item_id));

      // Filter out duplicates
      const newItemIds = itemIds.filter(id => !existingItemIds.has(id));

      if (newItemIds.length === 0) {
        console.log(`⚠ No new items to add (all ${itemIds.length} already exist)`);
        return;
      }

      // Add items
      await this.itemRepository.addItems(sessionId, newItemIds);
      console.log(`✓ Service: Added ${newItemIds.length} items to session`);
    } catch (error) {
      if (error instanceof OutsideServiceError) throw error;
      console.error('✗ Service: Error adding items:', error);
      throw new OutsideServiceError(
        OutsideServiceErrorCode.DATABASE_ERROR,
        'Failed to add items to session',
        { originalError: error }
      );
    }
  }

  /**
   * Get items in a session
   */
  async getSessionItems(sessionId: string): Promise<OutsideSessionItemWithContext[]> {
    try {
      const items = await this.itemRepository.getSessionItems(sessionId);
      return items;
    } catch (error) {
      console.error('✗ Service: Error getting session items:', error);
      throw new OutsideServiceError(
        OutsideServiceErrorCode.DATABASE_ERROR,
        'Failed to retrieve session items',
        { originalError: error }
      );
    }
  }

  /**
   * Toggle check status of an item
   */
  async checkItem(sessionId: string, itemId: string): Promise<void> {
    try {
      await this.itemRepository.toggleCheck(sessionId, itemId);
      console.log(`✓ Service: Toggled item ${itemId}`);
    } catch (error) {
      if (error instanceof OutsideSessionItemError) {
        throw new OutsideServiceError(
          OutsideServiceErrorCode.ITEM_NOT_FOUND,
          error.message,
          { originalError: error }
        );
      }
      console.error('✗ Service: Error checking item:', error);
      throw new OutsideServiceError(
        OutsideServiceErrorCode.DATABASE_ERROR,
        'Failed to toggle item check status',
        { originalError: error }
      );
    }
  }

  /**
   * Remove an item from a session
   */
  async removeItemFromSession(sessionId: string, itemId: string): Promise<void> {
    try {
      await this.itemRepository.removeItem(sessionId, itemId);
      console.log(`✓ Service: Removed item ${itemId} from session`);
    } catch (error) {
      if (error instanceof OutsideSessionItemError) {
        throw new OutsideServiceError(
          OutsideServiceErrorCode.ITEM_NOT_FOUND,
          error.message,
          { originalError: error }
        );
      }
      console.error('✗ Service: Error removing item:', error);
      throw new OutsideServiceError(
        OutsideServiceErrorCode.DATABASE_ERROR,
        'Failed to remove item from session',
        { originalError: error }
      );
    }
  }

  /**
   * Complete an active session
   */
  async completeSession(sessionId: string): Promise<OutsideSession> {
    try {
      const session = await this.sessionRepository.getById(sessionId);
      if (!session) {
        throw new OutsideServiceError(
          OutsideServiceErrorCode.SESSION_NOT_FOUND,
          `Session ${sessionId} not found`
        );
      }

      if (session.status !== OutsideSessionStatus.ACTIVE) {
        throw new OutsideServiceError(
          OutsideServiceErrorCode.SESSION_NOT_ACTIVE,
          'Session is not active'
        );
      }

      const completed = await this.sessionRepository.complete(sessionId);
      console.log(`✓ Service: Completed session ${sessionId}`);
      return completed;
    } catch (error) {
      if (error instanceof OutsideServiceError) throw error;
      console.error('✗ Service: Error completing session:', error);
      throw new OutsideServiceError(
        OutsideServiceErrorCode.DATABASE_ERROR,
        'Failed to complete session',
        { originalError: error }
      );
    }
  }

  /**
   * Delete a session
   */
  async deleteSession(sessionId: string): Promise<void> {
    try {
      await this.sessionRepository.delete(sessionId);
      console.log(`✓ Service: Deleted session ${sessionId}`);
    } catch (error) {
      if (error instanceof OutsideSessionError) {
        throw new OutsideServiceError(
          OutsideServiceErrorCode.SESSION_NOT_FOUND,
          error.message,
          { originalError: error }
        );
      }
      console.error('✗ Service: Error deleting session:', error);
      throw new OutsideServiceError(
        OutsideServiceErrorCode.DATABASE_ERROR,
        'Failed to delete session',
        { originalError: error }
      );
    }
  }

  /**
   * Get all completed sessions
   */
  async getCompletedSessions(): Promise<OutsideSession[]> {
    try {
      const sessions = await this.sessionRepository.getCompleted();
      return sessions;
    } catch (error) {
      console.error('✗ Service: Error getting completed sessions:', error);
      throw new OutsideServiceError(
        OutsideServiceErrorCode.DATABASE_ERROR,
        'Failed to retrieve completed sessions',
        { originalError: error }
      );
    }
  }
}

/**
 * Custom hook to create and memoize OutsideService instance
 * Prevents re-creation on every render
 */
export function useOutsideService(): OutsideService {
  return useMemo(() => new OutsideService(), []);
}
