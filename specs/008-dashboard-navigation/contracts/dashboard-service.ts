/**
 * Dashboard Service Contract
 * 
 * Defines the public interface for dashboard data aggregation.
 * Implemented by: src/services/DashboardService.ts
 * 
 * Feature: 008 - Dashboard Navigation Structure
 * 
 * This contract specifies how the home dashboard screen interacts with
 * the service layer to fetch and aggregate data from repositories.
 */

export interface DashboardItem {
  id: string;
  name: string;
  spaceName: string;
  createdAt: Date;
}

export interface DashboardStats {
  totalItems: number;
  totalSpaces: number;
  totalContainers: number;
}

export interface Dashboard {
  recentItems: DashboardItem[];
  stats: DashboardStats;
  isEmpty: boolean;
}

export interface IDashboardService {
  /**
   * Get the N most recently created items across all spaces.
   * 
   * @param limit Number of items to return (default: 5)
   * @returns Array of DashboardItem objects sorted by creation date (newest first)
   * @throws Error if database query fails
   * 
   * SQL: SELECT ... FROM items JOIN spaces ORDER BY created_at DESC LIMIT ?
   */
  getRecentItems(limit: number): Promise<DashboardItem[]>;

  /**
   * Get aggregated statistics for the dashboard.
   * 
   * @returns DashboardStats with counts of items, spaces, containers
   * @throws Error if database queries fail
   * 
   * Queries:
   * - COUNT(*) FROM items
   * - COUNT(*) FROM spaces
   * - COUNT(*) FROM containers
   */
  getDashboardStats(): Promise<DashboardStats>;

  /**
   * Get complete dashboard data (recent items + stats + isEmpty flag).
   * 
   * @returns Dashboard object containing recentItems, stats, and isEmpty flag
   * @throws Error if any internal query fails (errors are caught and defaults returned)
   * 
   * Aggregates getRecentItems(5) and getDashboardStats().
   * isEmpty = true when totalSpaces === 0.
   */
  getFullDashboard(): Promise<Dashboard>;
}

/**
 * Expected Implementation Pattern
 * 
 * class DashboardService implements IDashboardService {
 *   async getRecentItems(limit: number = 5): Promise<DashboardItem[]> {
 *     return await ItemRepository.getRecentItems(limit);
 *   }
 * 
 *   async getDashboardStats(): Promise<DashboardStats> {
 *     return {
 *       totalItems: await ItemRepository.countItems(),
 *       totalSpaces: await SpaceRepository.countSpaces(),
 *       totalContainers: await ContainerRepository.countContainers(),
 *     };
 *   }
 * 
 *   async getFullDashboard(): Promise<Dashboard> {
 *     const recentItems = await this.getRecentItems(5);
 *     const stats = await this.getDashboardStats();
 *     return {
 *       recentItems,
 *       stats,
 *       isEmpty: stats.totalSpaces === 0,
 *     };
 *   }
 * }
 */

/**
 * Repository Interface Contract (Methods Required)
 * 
 * ItemRepository:
 *   - getRecentItems(limit: number): Promise<DashboardItem[]>
 *   - countItems(): Promise<number>
 * 
 * SpaceRepository:
 *   - countSpaces(): Promise<number>
 * 
 * ContainerRepository:
 *   - countContainers(): Promise<number>
 */
