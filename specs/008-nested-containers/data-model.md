# Data Model: Nested Containers

**Feature**: [008-nested-containers](spec.md)  
**Phase**: Phase 1 Design  
**Date**: May 6, 2026  

## Entities & Relationships

### Container

**Purpose**: Logical grouping of items within a space

**Attributes**:
- `id`: UUID (Primary Key)
- `spaceId`: UUID (Foreign Key → Space)
- `name`: String (1-50 characters)
- `createdAt`: ISO 8601 Timestamp

**Relationships**:
- ✅ One container → One space
- ✅ One space → Many containers
- ✅ One container → Many items (via Item.containerId)

**Constraints**:
- `name` is required (NOT NULL)
- `spaceId` is required (must exist)
- `id` is immutable (UUID, generated on creation)
- `createdAt` is immutable (generated on creation)
- Container names can duplicate within a space (distinguished by ID)

**Lifecycle**:
- Create: User taps "+" in Containers section
- Read: Display on space detail screen
- Update: Not supported in v1
- Delete: Not supported in v1
- Archive: Not supported in v1

### Item (Updated)

**Purpose**: Individual item in space or container (existing entity extended)

**New Attributes**:
- `containerId`: UUID (Foreign Key → Container, NULLABLE)
  - NULL = space-level item (no container)
  - UUID = item belongs to container

**Existing Attributes** (unchanged):
- `id`: UUID (Primary Key)
- `spaceId`: UUID (Foreign Key → Space)
- `name`: String
- `createdAt`: ISO 8601 Timestamp

**Relationships** (updated):
- ✅ One item → One space (existing)
- ✅ One item → At most one container (NEW, NULLABLE)
- ✅ One container → Many items (NEW)

**Constraints**:
- `containerId` is optional (NULL for space-level items)
- `spaceId` must be populated (item always belongs to a space)
- Item cannot belong to multiple containers (single FK)
- Item cannot belong to a container from a different space (referential constraint enforced in queries)

**Backward Compatibility**:
- Existing items have `containerId = NULL` (remain space-level)
- No migration of existing data (null is valid)
- No change to existing item creation (containerId is optional parameter)

---

## State Transitions

### Container Lifecycle (MVP)

```
CREATE → EXISTS → (Forever)
```

- **CREATE**: User enters name, taps "Create", container inserted into DB
- **EXISTS**: Container displays on space detail, items can be added to it
- No transitions to other states in MVP (no edit, delete, archive)

### Item Lifecycle (Extended)

```
SPACE-LEVEL → (stays in space-level) OR SPACE-LEVEL → CONTAINERIZED
```

- **Create in space**: `containerId = NULL` (space-level item)
- **Create in container**: `containerId = container-id` (containerized item)
- Movement between container/space-level: Not supported in v1
- No state change beyond initial creation in MVP

---

## Database Schema

### Migration: Add Containers Table

```sql
CREATE TABLE containers (
  id TEXT PRIMARY KEY,
  spaceId TEXT NOT NULL,
  name TEXT NOT NULL,
  createdAt TEXT NOT NULL,
  FOREIGN KEY (spaceId) REFERENCES spaces(id)
);

CREATE INDEX idx_containers_spaceId ON containers(spaceId);
```

### Modification: Update Items Table

```sql
ALTER TABLE items ADD COLUMN containerId TEXT NULLABLE;
ALTER TABLE items ADD FOREIGN KEY (containerId) REFERENCES containers(id);
CREATE INDEX idx_items_containerId ON items(containerId);
```

**No data migration needed**: Existing items will have `containerId = NULL`

---

## Query Patterns

### Get containers for space

```sql
SELECT * FROM containers
WHERE spaceId = ?
ORDER BY createdAt ASC;
```

### Get items for container

```sql
SELECT * FROM items
WHERE containerId = ?
ORDER BY createdAt ASC;
```

### Get space-level items (no container)

```sql
SELECT * FROM items
WHERE spaceId = ? AND containerId IS NULL
ORDER BY createdAt ASC;
```

### Get all items for space (grouped by container)

```sql
-- Containers with items
SELECT c.*, i.*
FROM containers c
LEFT JOIN items i ON c.id = i.containerId
WHERE c.spaceId = ?
ORDER BY c.createdAt ASC, i.createdAt ASC;

-- Space-level items
SELECT * FROM items
WHERE spaceId = ? AND containerId IS NULL
ORDER BY createdAt ASC;
```

---

## Performance Considerations

**Indexes**: 
- `containers(spaceId)` for space-level queries
- `items(containerId)` for container-level queries
- `items(spaceId, containerId)` for grouped queries (optional, composite)

**Query Efficiency**:
- Single query per container list fetch
- Single query per item list fetch
- No N+1 queries (each container doesn't trigger separate item queries)
- Efficient sorting (indexed columns)

**Scaling**:
- Supports 50+ containers per space (index efficient)
- Supports 500+ items per space (indexed lookups)
- No recursive queries (one-level nesting)
