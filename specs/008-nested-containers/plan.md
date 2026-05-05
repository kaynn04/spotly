# Implementation Plan: Nested Containers

**Branch**: `008-nested-containers` | **Date**: May 6, 2026 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification for organizing items into container groups within spaces

## Summary

Enable users to create containers (logical groupings) within spaces and organize items by container. MVP: Create containers, add items to containers, display grouped items on space detail screen. Data model adds `Container` table with optional `containerId` field on items. UI displays containers as section headers with items grouped underneath, space-level items in "Uncategorized" section.

## Technical Context

**Language/Version**: TypeScript 5.x with React Native (Expo)
**Primary Dependencies**: React Native, Expo, expo-sqlite, expo-router
**Storage**: expo-sqlite (local SQLite database)
**Testing**: Jest/Vitest (not in MVP scope)
**Target Platform**: iOS/Android via React Native
**Project Type**: Mobile app (Expo)
**Performance Goals**: <1 second per action, 2 second creation visibility, supports 50+ containers and 500+ items per space
**Constraints**: Local-first, offline-capable, single-user, parameterized SQL queries only
**Scale/Scope**: Single space, one-level nesting (no recursive containers)

## Constitution Check

**Status**: ✅ PASS

- ✅ Spec-Driven: Feature spec completed and clarified
- ✅ Simplicity First: MVP scope only (create, display; no editing/deleting v1)
- ✅ Vertical Slice: Data → Service → UI all in this plan
- ✅ Local-First: SQLite storage, offline-capable
- ✅ Clean Layers: Repository → Service → UI pattern maintained
- ✅ TypeScript Strict: All types explicit, no `any`
- ✅ Parameterized SQL: All queries use `?` placeholders
- ✅ No ORMs: Direct SQL queries only

**Violations**: None | **Justifications**: N/A

## Project Structure

### Documentation (this feature)

```text
specs/008-nested-containers/
├── plan.md              # This file
├── spec.md              # Feature specification
├── research.md          # (not needed - no clarifications pending)
├── data-model.md        # Phase 1 data model
├── quickstart.md        # Phase 1 implementation walkthrough
├── contracts/           # Phase 1 contracts
│   └── container-service.ts
└── checklists/
    └── requirements.md  # Quality checklist
```

### Source Code (Expo app)

```text
app/
├── src/
│   ├── models/
│   │   └── Container.ts          # NEW
│   ├── repositories/
│   │   └── ContainerRepository.ts # NEW
│   ├── services/
│   │   └── ContainerService.ts    # NEW
│   ├── screens/
│   │   └── SpaceDetailScreen.tsx  # MODIFIED: Add container display
│   └── db/
│       └── migrations.ts          # MODIFIED: Add containers table
├── app/
│   └── space/
│       └── [id].tsx               # MODIFIED: Container UI + modals
└── constants/
    └── theme.ts                   # (unchanged)
```

**Structure Decision**: Mobile app with layered architecture. Feature integrates into existing space detail flow by adding container display and container creation UI. Database schema extended with containers table.

## Complexity Tracking

No constitution violations. Feature is straightforward MVP:
- Simple CRUD operations for containers (create only)
- No recursive logic (one-level nesting)
- No complex UI (text display, simple modals)
- SQLite queries are straightforward SELECT/INSERT

---

## Phase 1: Design & Contracts

### Data Model

**Container Entity** (NEW):
```
Table: containers
- id: TEXT PRIMARY KEY (UUID)
- spaceId: TEXT FOREIGN KEY -> spaces(id)
- name: TEXT NOT NULL (max 50 chars)
- createdAt: TEXT (ISO 8601 timestamp)
```

**Item Entity** (UPDATED):
```
Table: items
- id: TEXT PRIMARY KEY (UUID)
- spaceId: TEXT FOREIGN KEY -> spaces(id)
- name: TEXT NOT NULL
- createdAt: TEXT (ISO 8601 timestamp)
- containerId: TEXT FOREIGN KEY -> containers(id) [NEW, NULLABLE]
  (null = space-level item, populated = item in container)
```

### Service Layer Contracts

**ContainerService** (NEW):
```typescript
static async createContainer(spaceId: string, name: string): Promise<Container>
  - Validates: name not empty, max 50 chars, spaceId exists
  - Returns: Created container with ID, space link, name, createdAt
  - Throws: ServiceError('VALIDATION_ERROR' | 'DB_ERROR')

static async getContainersBySpaceId(spaceId: string): Promise<Container[]>
  - Returns: All containers for space, ordered by createdAt
  - Returns: Empty array if no containers
  - Throws: ServiceError('DB_ERROR')
```

**ItemService** (UPDATED):
```typescript
static async createItem(
  spaceId: string,
  name: string,
  containerId?: string
): Promise<Item>
  - Validates: name not empty, containerId exists if provided
  - Returns: Created item with optional containerId
  - Throws: ServiceError('VALIDATION_ERROR' | 'DB_ERROR')

static async getItemsByContainerId(containerId: string): Promise<Item[]>
  - Returns: All items in container, ordered by createdAt
  - Returns: Empty array if no items
  - Throws: ServiceError('DB_ERROR')
```

### Repository Layer

**ContainerRepository** (NEW):
```typescript
static async createContainer(spaceId: string, name: string): Promise<string>
  - Inserts container with generated UUID
  - Returns: container ID
  - Uses: parameterized INSERT query

static async getContainersBySpaceId(spaceId: string): Promise<ContainerRow[]>
  - Selects all containers for space
  - Uses: parameterized SELECT query
```

**ItemRepository** (UPDATED):
```typescript
static async getItemsByContainerId(containerId: string): Promise<ItemRow[]>
  - Selects items for container
  - Uses: parameterized SELECT query

(createItem updated to accept optional containerId parameter)
```

### UI Layer (SpaceDetailScreen Updates)

**New State**:
- `showAddContainerModal: boolean` - Track container creation modal

**New Functions**:
- `handleAddContainer()`: Opens add container modal
- `createContainer(name)`: Calls service, closes modal, reloads containers
- Render "Containers" section header with "+" button
- Render container names as collapsible/expandable sections
- Render items grouped under containers
- Render "Uncategorized" section for space-level items

**Modal**: "Add Container" modal with name input + Create/Cancel buttons

---

## Implementation Sequence

**MVP Minimal (5-6 tasks)**:

1. **T001**: Create Container model & database migration
2. **T002**: ContainerRepository & database methods
3. **T003**: ContainerService with validation
4. **T004**: Add per-container button & "Add Item" modal context
5. **T005**: Add "Containers" section header with "+" button & modals
6. **T006**: Display items grouped by container + "Uncategorized" section

**Key Decisions**:
- No container editing/deleting in MVP (out of scope)
- Container names max 50 characters (reasonable default, not editable)
- Items can belong to space-level or one container (no multi-container)
- Display: Containers → Items grouped under container → Uncategorized section

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| [e.g., 4th project] | [current need] | [why 3 projects insufficient] |
| [e.g., Repository pattern] | [specific problem] | [why direct DB access insufficient] |
