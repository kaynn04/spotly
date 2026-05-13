/**
 * Dashboard Service
 *
 * Aggregates data from repositories to provide dashboard content.
 * Handles statistics and recent items for the home screen.
 *
 * Implementation: T003 - Create Dashboard Service
 * Feature: 008 - Dashboard Navigation Structure
 */

import { ItemRepository } from '../repositories/ItemRepository';
import { SpaceRepository } from '../repositories/SpaceRepository';
import { ContainerRepository } from '../repositories/ContainerRepository';

/**
 * Dashboard Item - Display model for recent items
 */
export interface DashboardItem {
  id: string;
  name: string;
  spaceName: string;
  containerName: string | null;
  spaceId: string;
  containerId: string | null;
  createdAt: string;
}

export interface DashboardMovedItem {
  id: string;
  name: string;
  spaceName: string;
  containerName: string | null;
  updatedAt: string;
  kind: 'item' | 'container';
}

/**
 * Dashboard Warranty Item - Items with expiring warranties
 */
export interface DashboardWarrantyItem {
  id: string;
  name: string;
  spaceName: string;
  containerName: string | null;
  spaceId: string;
  containerId: string | null;
  warrantyExpiry: string; // ISO date "YYYY-MM-DD"
  daysRemaining: number;
  urgency: 'critical' | 'warning'; // critical: 0-4 days, warning: 5-14 days
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
  recentlyMoved: DashboardMovedItem[];
  expiringWarranties: DashboardWarrantyItem[];
  stats: DashboardStats;
  isEmpty: boolean;
}

/**
 * DashboardService provides aggregated data for the home dashboard.
 * This service coordinates between repositories to fetch and combine data.
 */
export class DashboardService {
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
      const items = await ItemRepository.getRecentItems(limit);
      return items;
    } catch (error) {
      console.error('[DashboardService.getRecentItems] Error:', error);
      return [];
    }
  }

  static async getRecentlyMovedItems(limit: number = 5): Promise<DashboardMovedItem[]> {
    try {
      const [movedItems, movedContainers] = await Promise.all([
        ItemRepository.getRecentlyMovedItems(limit),
        ContainerRepository.getRecentlyMovedContainers(limit),
      ]);
      const combined: DashboardMovedItem[] = [
        ...movedItems.map(i => ({ ...i, kind: 'item' as const })),
        ...movedContainers.map(c => ({ ...c, kind: 'container' as const })),
      ];
      combined.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
      return combined.slice(0, limit);
    } catch (error) {
      console.error('[DashboardService.getRecentlyMovedItems] Error:', error);
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
        ItemRepository.countItems(),
        SpaceRepository.countSpaces(),
        ContainerRepository.countContainers(),
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
   * Get items with warranties expiring within 5-14 days
   *
   * @param limit - Number of items to return (default: 5)
   * @returns Array of items with expiring warranties, sorted by urgency then expiry date
   *
   * Logic:
   * - Includes items expiring in 0-14 days
   * - Urgency: 'critical' (0-4 days), 'warning' (5-14 days)
   * - Sorted by urgency first, then by days remaining (closest first)
   */
  static async getExpiringWarranties(limit: number = 5): Promise<DashboardWarrantyItem[]> {
    try {
      const items = await ItemRepository.getItemsWithWarrantyExpiry();
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const expiringItems: DashboardWarrantyItem[] = [];

      for (const item of items) {
        if (!item.warrantyExpiry) continue;

        const expiry = new Date(item.warrantyExpiry);
        expiry.setHours(0, 0, 0, 0);

        const diffMs = expiry.getTime() - today.getTime();
        const daysRemaining = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

        // Only include warranties expiring within 0-14 days
        if (daysRemaining >= 0 && daysRemaining <= 14) {
          const urgency = daysRemaining <= 4 ? 'critical' : 'warning';
          expiringItems.push({
            id: item.id,
            name: item.name,
            spaceName: item.spaceName,
            containerName: item.containerName ?? null,
            spaceId: item.spaceId,
            containerId: item.containerId ?? null,
            warrantyExpiry: item.warrantyExpiry,
            daysRemaining,
            urgency,
          });
        }
      }

      // Sort by urgency (critical first), then by daysRemaining (closest first)
      expiringItems.sort((a, b) => {
        const urgencyOrder = { critical: 0, warning: 1 };
        const urgencyDiff = urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
        if (urgencyDiff !== 0) return urgencyDiff;
        return a.daysRemaining - b.daysRemaining;
      });

      return expiringItems.slice(0, limit);
    } catch (error) {
      console.error('[DashboardService.getExpiringWarranties] Error:', error);
      return [];
    }
  }

  /**
   * Get complete dashboard data (recent items + stats + isEmpty flag)
   *
   * @returns Dashboard object containing all required data
   *
   * Aggregates getRecentItems(5), getRecentlyMovedItems(5), getExpiringWarranties(5), and getDashboardStats()
   * isEmpty = true when totalSpaces === 0
   * Gracefully handles errors with sensible defaults
   */
  static async getFullDashboard(): Promise<Dashboard> {
    try {
      const [recentItems, recentlyMoved, expiringWarranties, stats] = await Promise.all([
        this.getRecentItems(5),
        this.getRecentlyMovedItems(5),
        this.getExpiringWarranties(5),
        this.getDashboardStats(),
      ]);

      return {
        recentItems,
        recentlyMoved,
        expiringWarranties,
        stats,
        isEmpty: stats.totalSpaces === 0,
      };
    } catch (error) {
      console.error('[DashboardService.getFullDashboard] Error:', error);
      return {
        recentItems: [],
        recentlyMoved: [],
        expiringWarranties: [],
        stats: { totalItems: 0, totalSpaces: 0, totalContainers: 0 },
        isEmpty: true,
      };
    }
  }
}
