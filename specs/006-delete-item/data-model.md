# Data Model: Delete Item

**Feature**: Delete Item  
**Created**: 2026-05-06

## Overview

This feature does not introduce new entities. It operates on the existing **Item** entity with a permanent delete operation.

## Entity: Item

**Purpose**: Represents a tracked item within a space.

**Schema** (existing, no changes):
```sql
CREATE TABLE items (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  space_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (space_id) REFERENCES spaces(id) ON DELETE CASCADE
);
```

**TypeScript Interface** (existing):
```typescript
interface Item {
  id: string;           // UUID, generated on creation
  name: string;         // Item name, non-empty string
  spaceId: string;      // Foreign key to spaces.id
  createdAt: string;    // ISO 8601 timestamp
}

interface ItemRow {     // Direct from database (snake_case)
  id: string;
  name: string;
  space_id: string;
  created_at: string;
}
```

## Operation: Delete

**Input**: 
- `itemId: string` - ID of item to delete

**Process**:
1. **Repository Layer**: Execute parameterized DELETE query
   ```sql
   DELETE FROM items WHERE id = ?
   ```
2. **Service Layer**: Call repository and handle errors
3. **UI Layer**: Show confirmation alert, then call service
4. **Result**: Item removed from database and UI

**Error Cases**:
- **Database Error**: Item not found or database error → ServiceError('DB_ERROR')
- **UI Validation**: None (no validation logic)

## Constraints

- **Permanent Delete**: No soft delete, no recovery possible
- **Single Item**: Each delete operation targets one item ID
- **Local-Only**: No sync to cloud, deletion is immediate and permanent
- **Cascade**: If space is deleted, all its items are auto-deleted via FK cascade

## State Transitions

**Item Lifecycle**:
```
CREATE → EXISTS (in space) → DELETE → REMOVED
```

**Delete Triggers**:
- User presses delete button on item in space detail screen
- User confirms deletion in alert dialog
- ItemService.deleteItem() executes
- Item is deleted from SQLite
- UI refreshes to remove item from list

**No Undo**: Once deleted, item cannot be recovered. This is permanent.
