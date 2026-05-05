# Data Model: Create Space Feature

**Created**: 2026-05-05  
**Phase**: Phase 1 (Design & Contracts)  
**Status**: Final

## Entity: Space

Represents a physical location where users can organize and track their belongings.

### Data Definition

```typescript
interface Space {
  id: string;                    // UUID, generated on creation, primary key
  name: string;                  // Required, trimmed, 1-100 chars, any character allowed
  createdAt: string;             // ISO 8601 timestamp, set on creation, immutable
  updatedAt: string;             // ISO 8601 timestamp, set on creation and update
}
```

### Field Details

| Field | Type | Constraints | Notes |
|-------|------|-----------|-------|
| `id` | UUID | Primary key, immutable | Use `uuid` package; never auto-increment |
| `name` | string | Trimmed, 1-100 chars | Stored trimmed; no special char restrictions |
| `createdAt` | ISO 8601 | Immutable | Set on creation; never updated |
| `updatedAt` | ISO 8601 | Set on creation & updates | Updated if space is modified later (e.g., name edit in V2) |

### Validation Rules

**Input Validation** (Service Layer):
- ✅ Name must not be null/undefined
- ✅ Name must be trimmed before validation: `name.trim()`
- ✅ Trimmed name must not be empty (length > 0)
- ✅ Trimmed name must not exceed 100 characters
- ✅ No special character restrictions

**Database Constraints** (Expo-SQLite):
- ✅ `NOT NULL` on id, name, createdAt, updatedAt
- ✅ `CHECK (length(trim(name)) > 0 AND length(name) <= 100)`
- ✅ Unique primary key on id

### Relationships

**Space → Item** (deferred to item management spec):
- A space can have zero or more items
- Item lookup by `space_id` (to be defined in item spec)
- Deletion behavior (cascade, orphan, etc.) defined in item spec

---

## Composite Types

### SpaceWithCount

Extension of Space entity used when retrieving space with item count for UI list display.

```typescript
interface SpaceWithCount extends Space {
  itemCount: number;  // Number of items in this space (0+)
}
```

**Query**: `SELECT spaces.*, COUNT(items.id) as itemCount FROM spaces LEFT JOIN items ON spaces.id = items.space_id WHERE spaces.id = ? GROUP BY spaces.id`

---

## SQL Schema

### Table Definition

```sql
CREATE TABLE IF NOT EXISTS spaces (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK (length(trim(name)) > 0 AND length(name) <= 100)
);
```

### Indexes

```sql
CREATE INDEX IF NOT EXISTS idx_spaces_created_at ON spaces(created_at);
```

**Rationale for `created_at` index**: 
- Enables fast sorting/filtering by creation date (future features like "recent spaces")
- Small overhead for MVP (< 20 spaces)
- Standard practice for audit/timeline queries

### Naming Convention

- **Column names**: snake_case (`created_at`, `updated_at`) in database
- **Entity fields**: camelCase (`createdAt`, `updatedAt`) in TypeScript/service layer
- **Mapping**: Repository layer converts between conventions

---

## Serialization & Deserialization

### Creating a Space

```typescript
// Input from UI
const input = { name: "  Home  " };

// Service layer processing
const trimmedName = input.name.trim();  // "Home"
const validateName = (n: string) => n.length > 0 && n.length <= 100;
if (!validateName(trimmedName)) throw new ValidationError("Invalid name");

const space: Space = {
  id: uuidv4(),
  name: trimmedName,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

// Repository persists to SQLite
// (name stored as "Home", not "  Home  ")
```

### Reading from Database

```typescript
// Raw database row
const dbRow = {
  id: "550e8400-e29b-41d4-a716-446655440000",
  name: "Home",
  created_at: "2026-05-05T10:30:00.000Z",
  updated_at: "2026-05-05T10:30:00.000Z",
};

// Repository maps to entity
const space: Space = {
  id: dbRow.id,
  name: dbRow.name,
  createdAt: dbRow.created_at,
  updatedAt: dbRow.updated_at,
};
```

---

## Data Scale & Performance

**MVP Assumptions** (from clarification):
- **Scale**: < 20 spaces per user
- **Response time**: < 500ms for space creation
- **Storage**: Negligible (20 spaces × ~150 bytes ≈ 3 KB)

**Performance Characteristics**:
- List all spaces: O(n), negligible for n < 20
- Create space: O(1), dominated by UUID generation and SQLite write (~10-50ms)
- Query by ID: O(1) with indexed lookup
- Delete space: O(1) for space deletion; items handled separately

---

## Migration Strategy (for V1)

### Initial Schema (V1)

```sql
-- Run once on app startup (or first launch)
CREATE TABLE IF NOT EXISTS spaces (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK (length(trim(name)) > 0 AND length(name) <= 100)
);

CREATE INDEX IF NOT EXISTS idx_spaces_created_at ON spaces(created_at);
```

### Versioning

- **Database version**: Start at 1
- **Schema file**: `src/db/migrations.ts`
- **Migration approach**: Simple conditional table creation (V1 MVP)
- **Future**: Add migration runner for schema changes in V2+

---

## Notes

- All timestamps use ISO 8601 format for cross-platform consistency
- Database names use snake_case; TypeScript uses camelCase (mapper in Repository)
- No soft deletes in MVP; hard delete spaces when user requests
- Item deletion behavior (when space is deleted) deferred to item management spec
- Database transactions not needed for MVP (single-user, local operations)
