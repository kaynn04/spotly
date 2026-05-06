/**
 * Dashboard Service
 *
 * Aggregates data from repositories to provide dashboard content.
 * Handles statistics and recent items for the home screen.
 *
 * Implementation: T003 - Create Dashboard Service
 * Feature: 008 - Dashboard Navigation Structure
 */

import type { ItemRepository } from '../repositories/ItemRepository';
import type { SpaceRepository } from '../repositories/SpaceRepository';
import type { ContainerRepository } from '../repositories/ContainerRepository';

/**
 * Dashboard Item - Display model for recent items
 */
export interface DashboardItem {
  id: string;
  name: string;
  spaceName: string;
  createdAt: string;
}

/**
 * Dashboard Statistics
 */
export interface DashboardStats {
  totalItems: number;
  totalSpaces: number;
  totalContainers: number;
}

/**
 * Complete Dashboard Data
 */
export interface Dashboard {
  recentItems: DashboardItem[];
  stats: DashboardStats;
  isEmpty: boolean;
}

/**
 * DashboardService provides aggregated data for the home dashboard.
 * This service coordinates between repositories to fetch and combine data.
 */
export class DashboardService {
  private static itemRepository: typeof ItemRepository;
  private static spaceRepository: typeof SpaceRepository;
  private static containerRepository: typeof ContainerRepository;

  /**
   * Initialize repositories (dependency injection)
   * Called once during app startup
   */
  static initialize(
    itemRepo: typeof ItemRepository,
    spaceRepo: typeof SpaceRepository,
    containerRepo: typeof ContainerRepository
  ): void {
    this.itemRepository = itemRepo;
    this.spaceRepository = spaceRepo;
    this.containerRepository = containerRepo;
  }

  /**
   * Get the N most recent items across all spaces
   *
   * @param limit - Number of items to return (default: 5)
   * @returns Array of recent items with space names
   *
   * Fetches items sorted by creation date (newest first)
   * Maps to display format with spaceName included
   */
  static async getRecentItems(limit: number = 5): Promise<DashboardItem[]> {
    try {
      const items = await this.itemRepository.getRecentItems(limit);

      // Already formatted correctly from repository
      return items;
    } catch (error) {
      console.error('[DashboardService.getRecentItems] Error:', error);
      return [];
    }
  }

  /**
   * Get aggregated statistics for the dashboard
   *
   * @returns Dashboard statistics with counts
   *
   * Fetches counts from each repository
   * Returns statistics with fallback values on error
   */
  static async getDashboardStats(): Promise<DashboardStats> {
    try {
      const [totalItems, totalSpaces, totalContainers] = await Promise.all([
        this.itemRepository.countItems(),
        this.spaceRepository.countSpaces(),
        this.containerRepository.countContainers(),
      ]);

      return {
        totalItems,
        totalSpaces,
        totalContainers,
      };
    } catch (error) {
      console.error('[DashboardService.getDashboardStats] Error:', error);

      // Return fallback values on error
      return {
        totalItems: 0,
        totalSpaces: 0,
        totalContainers: 0,
      };
    }
  }

  /**
   * Get complete dashboard data (recent items + stats + isEmpty flag)
   *
   * @returns Dashboard object containing all required data
   *
   * Aggregates getRecentItems(5) and getDashboardStats()
   * isEmpty = true when totalSpaces === 0
   * Gracefully handles errors with sensible defaults
   */
  static async getFullDashboard(): Promise<Dashboard> {
    try {
      const [recentItems, stats] = await Promise.all([
        this.getRecentItems(5),
        this.getDashboardStats(),
      ]);

      return {
        recentItems,
        stats,
        isEmpty: stats.totalSpaces === 0,
      };
    } catch (error) {
      console.error('[DashboardService.getFullDashboard] Error:', error);

      // Return empty dashboard on error
      return {
        recentItems: [],
        stats: {
          totalItems: 0,
          totalSpaces: 0,
          totalContainers: 0,
        },
        isEmpty: true,
      };
    }
  }
}
