# Data Model: Dashboard Navigation

**Feature**: Feature 008 - Dashboard Navigation Structure  
**Phase**: 1 (Design)  
**Status**: Complete

## Overview

Feature 008 does not introduce new database entities. The dashboard is a **computed view** that aggregates data from existing tables (Space, Item, Container). All data displayed on the home dashboard is derived from existing repositories using parameterized SQL queries.

## Entities

### Existing Entities (No Changes)

#### 1. Space
- **Purpose**: Container for items within a space/location
- **Source**: Feature 001 (Create Space)
- **Fields**: id, name, description, created_at, updated_at
- **Usage in Dashboard**: Count for statistics; space name for context display

#### 2. Item
- **Purpose**: Individual belonging with metadata
- **Source**: Feature 001 (Create Space) + Feature 007 (nested containers)
- **Fields**: id, name, description, container_id, space_id, created_at, updated_at, is_lent, is_outside
- **Usage in Dashboard**: 
  - Recent items (5 most recent by created_at DESC)
  - Item count statistics
  - Context display (item name + space_id join to space name)

#### 3. Container
- **Purpose**: Logical grouping of items within a space
- **Source**: Feature 007 (Container Detail View with Nested Containers)
- **Fields**: id, name, space_id, created_at, updated_at
- **Usage in Dashboard**: Container count statistics

---

## Dashboard Computed Data Model

### DashboardData (Virtual)

**Not persisted in database.** Computed from repositories on home dashboard load.

```typescript
interface DashboardData {
  recentItems: DashboardItem[]
  stats: DashboardStats
  isEmpty: boolean
}

interface DashboardItem {
  id: string
  name: string
  spaceName: string        // Joined from items.space_id → spaces.name
  createdAt: Date
}

interface DashboardStats {
  totalItems: number       // COUNT(*)  from items
  totalSpaces: number      // COUNT(*) from spaces
  totalContainers: number  // COUNT(*) from containers
}
```

---

## Queries

### 1. Get Recent Items (5 Most Recent)

**Purpose**: Populate "Recently Added Items" section on home dashboard  
**Query**: 
```sql
SELECT 
  i.id, 
  i.name, 
  s.name as spaceName, 
  i.created_at
FROM items i
JOIN spaces s ON i.space_id = s.id
ORDER BY i.created_at DESC
LIMIT 5
```

**Usage**: `ItemService.getRecentItems(5)`  
**Source**: ItemRepository (new query method)

### 2. Get Item Count

**Purpose**: Display total items in statistics card  
**Query**: 
```sql
SELECT COUNT(*) as total FROM items
```

**Usage**: `ItemRepository.countItems()`  
**Current Status**: Method may need to be created

### 3. Get Space Count

**Purpose**: Display total spaces in statistics card  
**Query**: 
```sql
SELECT COUNT(*) as total FROM spaces
```

**Usage**: `SpaceRepository.countSpaces()`  
**Current Status**: Method may need to be created

### 4. Get Container Count

**Purpose**: Display total containers in statistics card  
**Query**: 
```sql
SELECT COUNT(*) as total FROM containers
```

**Usage**: `ContainerRepository.countContainers()`  
**Current Status**: Method may need to be created

---

## Service Layer Integration

### DashboardService (New)

**Purpose**: Aggregate dashboard data from repositories

```typescript
class DashboardService {
  async getRecentItems(limit: number = 5): Promise<Item[]> {
    // Delegates to ItemRepository.getRecentItems()
  }

  async getDashboardStats(): Promise<DashboardStats> {
    // Calls ItemRepository.countItems()
    // Calls SpaceRepository.countSpaces()
    // Calls ContainerRepository.countContainers()
    // Returns aggregated stats
  }

  async getFullDashboard(): Promise<DashboardData> {
    // Calls getRecentItems() and getDashboardStats()
    // Returns combined DashboardData
  }
}
```

---

## State Management

**Dashboard State**: Managed by React component state (useState) on home dashboard screen. No global state manager needed (MVP scope).

**Refresh Strategy**:
- Dashboard data fetched on screen mount (useEffect)
- Manual refresh on pull-to-refresh or tab focus
- Deferred optimization: Consider caching if performance issues arise

---

## Performance Considerations

1. **Recent Items Query**: Efficient (indexes on items.created_at assumed from existing schema)
2. **Count Queries**: O(1) with proper indexes (assumed from existing schema)
3. **Joins**: Simple space join should be fast (single foreign key)
4. **Caching**: No caching implemented in MVP; dashboard re-fetches on each tab focus

---

## Future Extensions (Not in MVP)

- Marking items as "lent" (feature 009) - will use `is_lent` field
- Marking items for "outside" (feature 009) - will use `is_outside` field
- Filtering recent items by space or container
- Showing items by category in separate dashboard sections
- Advanced analytics (items per space, most common containers, etc.)

---

## Database Schema Impact

**No schema changes required.**

All queries operate on existing tables:
- `items` (feature 001)
- `spaces` (feature 001)
- `containers` (feature 007)

No migrations needed for feature 008.

---

## Testing Considerations

**Unit Tests** (repository layer):
- `countItems()` returns correct total
- `getRecentItems(5)` returns 5 most recent items in correct order
- Queries handle empty database (return 0 or empty array)

**Integration Tests** (service layer):
- `getFullDashboard()` aggregates all data correctly
- Dashboard data is accurate with sample database

**UI Tests** (component level):
- Recent items display correctly with space context
- Statistics update when items are added/deleted
- Empty state displays when database is empty
