# Quickstart: Create Space Feature

**Created**: 2026-05-05  
**Phase**: Phase 1 (Design & Contracts)  
**For**: Developers implementing the create_space feature

## Overview

This guide provides a quick reference for implementing the create_space feature. For complete details, see [spec.md](spec.md) and [data-model.md](data-model.md).

---

## What to Build

**Feature**: Allow users to create a named location (space) on their device to organize belongings.

**Scope**: 
- Create space with validation (name not empty, trimmed, ≤ 100 chars)
- Store in expo-sqlite locally
- List all spaces
- View space details
- Delete space (confirmation required)

**Out of Scope for V1**:
- Editing space name after creation
- Sharing spaces
- Cloud sync
- Multiple users

---

## Architecture Overview

```
UI Layer (React Components)
    ↓
Service Layer (SpaceService)
    - Validate input
    - Generate ID
    - Handle errors
    ↓
Repository Layer (SpaceRepository)
    - Parameterized SQL queries
    - Map DB results to entities
    ↓
Database Layer (expo-sqlite)
    - Stores space data locally
```

**Key Principle**: Each layer has ONE responsibility. No cross-layer dependencies.

---

## Implementation Checklist

### Phase 1: Database Setup

- [ ] Create `src/db/client.ts` - Database connection using `openDatabaseSync()`
- [ ] Create `src/db/migrations.ts` - Initialize spaces table on app startup
  - [ ] `CREATE TABLE IF NOT EXISTS spaces (...)`
  - [ ] `CREATE INDEX idx_spaces_created_at`
  - [ ] Check constraint: `length(trim(name)) > 0 AND length(name) <= 100`

**Key Files**:
```typescript
// src/db/client.ts
export const db = openDatabaseSync('synop.db');

// src/db/migrations.ts
export function initializeDatabase() {
  db.execAsync(`
    CREATE TABLE IF NOT EXISTS spaces (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      CHECK (length(trim(name)) > 0 AND length(name) <= 100)
    );
    CREATE INDEX IF NOT EXISTS idx_spaces_created_at ON spaces(created_at);
  `);
}
```

### Phase 2: Data Model

- [ ] Create `src/models/Space.ts` - TypeScript interfaces
  - [ ] `Space` interface (id, name, createdAt, updatedAt)
  - [ ] `SpaceWithCount` interface (extends Space + itemCount)
  - [ ] Type definitions for all service methods

**Key File**:
```typescript
// src/models/Space.ts
export interface Space {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface SpaceWithCount extends Space {
  itemCount: number;
}
```

### Phase 3: Repository Layer

- [ ] Create `src/repositories/SpaceRepository.ts` - Database access
  - [ ] `create(name: string): Promise<Space>` - Insert with UUID
  - [ ] `getAll(): Promise<Space[]>` - Fetch all spaces
  - [ ] `getById(id: string): Promise<Space | null>` - Fetch single space
  - [ ] `delete(id: string): Promise<void>` - Delete space
  - [ ] `getSpaceWithItemCount(id: string): Promise<SpaceWithCount | null>`

**Critical**: Use parameterized queries ONLY (? placeholders, never string concat)

```typescript
// CORRECT - Parameterized
db.runAsync(
  'INSERT INTO spaces (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)',
  [id, name, now, now]
);

// WRONG - Never do this
db.runAsync(`INSERT INTO spaces VALUES ('${id}', '${name}', ...)`);
```

### Phase 4: Service Layer

- [ ] Create `src/services/SpaceService.ts` - Business logic
  - [ ] `create(name: string): Promise<Space>`
    - [ ] Trim name: `name.trim()`
    - [ ] Validate: not empty, ≤ 100 chars
    - [ ] Generate UUID using `uuid` package
    - [ ] Call `repository.create()`
    - [ ] Return Space object
    - [ ] Throw ServiceError on validation or DB failures
  - [ ] `getAll(): Promise<Space[]>`
  - [ ] `getById(id: string): Promise<Space | null>`
  - [ ] `delete(id: string): Promise<void>`

```typescript
// src/services/SpaceService.ts
export class SpaceService implements ISpaceService {
  async create(name: string): Promise<Space> {
    const trimmed = name.trim();
    
    // Validate
    if (trimmed.length === 0) {
      throw new ServiceError("VALIDATION_ERROR", "Space name cannot be empty");
    }
    if (trimmed.length > 100) {
      throw new ServiceError("VALIDATION_ERROR", "Space name must be ≤ 100 characters");
    }
    
    try {
      return await this.repository.create(trimmed);
    } catch (error) {
      throw new ServiceError("DB_ERROR", "Failed to create space. Try again.");
    }
  }
}
```

### Phase 5: UI Layer

- [ ] Create Home Screen (spaces list)
  - [ ] Display all spaces with `spaceService.getAll()`
  - [ ] Show item count for each space
  - [ ] Show empty state if no spaces
  - [ ] Button to create new space
  - [ ] Delete button with confirmation dialog

- [ ] Create Space Detail Screen
  - [ ] Display space name, item count
  - [ ] Show items in this space (integrate with item feature)
  - [ ] Button to add items

- [ ] Create Space Dialog/Modal
  - [ ] Text input for space name
  - [ ] Save button (calls `spaceService.create()`)
  - [ ] Cancel button
  - [ ] Show error message on validation failure
  - [ ] Show loading state (< 500ms)
  - [ ] Clear input on success

### Phase 6: Testing

- [ ] Unit tests for `SpaceService`
  - [ ] ✅ Valid space creation
  - [ ] ❌ Empty name validation
  - [ ] ❌ Whitespace-only name validation
  - [ ] ❌ Name > 100 chars validation

- [ ] Integration tests for `SpaceRepository`
  - [ ] Create and retrieve space
  - [ ] Create multiple spaces and list all
  - [ ] Delete space
  - [ ] Get space with item count (mock items table)
  - [ ] Use sql.js (in-memory) instead of expo-sqlite

- [ ] E2E tests (manual or Detox)
  - [ ] Create space via UI
  - [ ] Restart app and verify space persists
  - [ ] Delete space and verify removal
  - [ ] Test empty state

---

## Key Implementation Rules

✅ **DO**:
- Use parameterized SQL queries with `?` placeholders
- Trim names before validation
- Generate UUIDs for space IDs
- Store timestamps in ISO 8601 format
- Validate in service layer, not UI
- Throw ServiceError on validation failures
- Return generic error message on DB failure
- Test with sql.js (in-memory database)

❌ **DON'T**:
- Concatenate strings into SQL (injection risk)
- Forget to trim names (accept "  Home  " as input)
- Use auto-increment IDs (use UUID)
- Store timestamps as milliseconds (use ISO 8601)
- Validate in UI (logic belongs in service)
- Retry automatically on DB errors
- Expose SQL queries to UI layer

---

## Performance Targets

- Space creation: < 500ms (loading state permitted)
- List all spaces: < 100ms (< 20 spaces)
- Space detail lookup: < 50ms (indexed)

---

## Error Handling

**Generic Error Message** (per constitution):
- "Failed to create space. Try again."

**No specific error messages** for DB failures (user can't fix):
- ❌ DON'T: "SQLite database file locked"
- ✅ DO: "Failed to create space. Try again."

**Validation Errors** show specific message:
- "Space name cannot be empty"
- "Space name must be ≤ 100 characters"

---

## Dependencies

- `expo-sqlite` - Local database
- `uuid` - Generate space IDs
- `react-native` - UI framework
- `typescript` - Type safety

## Testing Dependencies

- `vitest` or `jest` - Test runner
- `sql.js` - In-memory SQLite for tests
- `@testing-library/react-native` - React Native component testing

---

## File Structure After Implementation

```
src/
├── models/
│   └── Space.ts              # Interfaces
├── services/
│   └── SpaceService.ts       # Business logic
├── repositories/
│   └── SpaceRepository.ts    # Data access
└── db/
    ├── client.ts             # Database connection
    └── migrations.ts         # Schema initialization

app/app/(tabs)/
├── index.tsx                 # Home screen (spaces list)
└── spaces/
    ├── [id].tsx              # Space detail
    └── create.tsx            # Create space dialog

tests/
├── unit/
│   └── SpaceService.test.ts
├── integration/
│   └── SpaceRepository.test.ts
└── e2e/
    └── createSpace.test.ts
```

---

## Next Steps

1. Start with **Phase 1** (Database Setup) - Get schema in place
2. Then **Phase 2** (Data Model) - Define TypeScript interfaces
3. Then **Phase 3** (Repository) - Implement data access with parameterized SQL
4. Then **Phase 4** (Service) - Add business logic and validation
5. Then **Phase 5** (UI) - Build React components
6. Finally **Phase 6** (Testing) - Write unit, integration, and e2e tests

Run `/speckit.tasks` to generate actionable tasks with dependencies.
