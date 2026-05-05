# Tasks: Nested Containers

**Branch**: `008-nested-containers`  
**Feature**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md) | **Data Model**: [data-model.md](data-model.md)  
**Status**: Ready for implementation  
**Task Count**: 6 minimal MVP tasks

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Data layer infrastructure required for all user stories

⚠️ **CRITICAL**: All foundational tasks must complete before Phase 3 MVP implementation

### Database & Data Access Layer

- [ ] T001 Create Container model and database migration in `app/src/models/Container.ts` and `app/src/db/migrations.ts`
  - Create `Container` interface: `id, spaceId, name, createdAt`
  - Create `containers` table with proper schema
  - Add `containerId` column to existing `items` table (nullable)
  - Create indexes on `spaceId` and `containerId` for query performance
  - Reference: [data-model.md](data-model.md), [quickstart.md#task-1](quickstart.md)

- [ ] T002 Implement ContainerRepository with database access methods in `app/src/repositories/ContainerRepository.ts`
  - `createContainer(spaceId, name)`: Insert new container, return ID
  - `getContainersBySpaceId(spaceId)`: Fetch all containers for space
  - `getItemsByContainerId(containerId)`: Fetch items in container
  - `getSpaceLevelItems(spaceId)`: Fetch items with no container
  - Use parameterized queries for all SQL operations
  - Reference: [quickstart.md#task-2](quickstart.md)

- [ ] T003 [P] Implement ContainerService with validation in `app/src/services/ContainerService.ts`
  - `createContainer(spaceId, name)`: Validate name (not empty, ≤50 chars), call repository, return Container
  - `getContainersBySpaceId(spaceId)`: Call repository, handle errors
  - Throw `ServiceError` with code `VALIDATION_ERROR` or `DB_ERROR`
  - Reference: [quickstart.md#task-3](quickstart.md), [contracts/container-service.ts](contracts/container-service.ts)

- [ ] T004 [P] Update ItemService and ItemRepository for container support in `app/src/services/ItemService.ts` and `app/src/repositories/ItemRepository.ts`
  - Modify `ItemRepository.createItem()` to accept optional `containerId` parameter
  - Update `ItemService.createItem()` to accept and pass through optional `containerId`
  - Maintain backward compatibility: existing items have `containerId = null`
  - Reference: [quickstart.md#task-4](quickstart.md)

**Checkpoint**: Foundation complete - containers can be created and persisted, items can be associated with containers

---

## Phase 3: MVP Implementation

**Purpose**: UI implementation for all three P1 user stories

### User Story 1 - Create Container in Space (P1)

**Goal**: Users can create containers via modal dialog, containers display with section header, data persists

**Independent Test**: Create container "Kitchen" → verify it displays in Containers section → navigate away/back → verify it still displays

- [ ] T005 [US1] Add container creation modal and "Containers" section header to `app/app/space/[id].tsx`
  - Add state: `showAddContainerModal`, `containerName`
  - Add "Containers" section header with "+" button above containers list
  - Implement modal for container name input (modal appears on "+" tap)
  - Implement `handleCreateContainer()` function that calls `ContainerService.createContainer()`
  - On success: close modal, clear input, reload containers
  - On error: show alert with error message
  - Load containers on screen focus via `loadContainers()` function
  - Reference: [quickstart.md#task-5-6-ui-updates](quickstart.md)

### User Story 2 - Add Items to Container (P1)

### User Story 3 - View Items Grouped by Container (P1)

**Goal**: Containers display as sections, items grouped under their container, space-level items in "Uncategorized", FAB and per-container buttons for adding items

**Independent Test**: Create container "Kitchen" → add item "Plates" to container → add item "Fork" to space-level → verify "Kitchen" section shows "Plates", "Uncategorized" shows "Fork"

- [ ] T006 [US2] [US3] Implement grouped item display with container sections, per-container add buttons, and uncategorized section in `app/app/space/[id].tsx`
  - Load items and containers on screen load/focus
  - Render "Containers" section header with "+" button (from T005)
  - For each container: render container name + "Add Item" button + items in container
  - Render "Uncategorized" section header with items that have no container
  - Update add item modal to show which container item will be added to (pre-selected if tapped from container button)
  - Implement per-container add buttons that set `selectedAddItemContainer` state
  - On item creation: call `ItemService.createItem(spaceId, name, containerId)` with container context
  - Layout: FlatList with sections (Container → Items in container → Uncategorized section → Items in uncategorized)
  - Reference: [quickstart.md#task-5-6-ui-updates](quickstart.md)

---

## Implementation Notes

### Dependency Graph

```
T001 (Model + Migration)
  ↓
T002 (ContainerRepository)
  ↓
T003 (ContainerService) ← T004 (ItemService update) [P parallel]
  ↓
T005 (Container creation UI) [US1]
  ↓
T006 (Grouped display + buttons) [US2] [US3]
```

### Performance Targets

- ✅ Container creation visible in <2 seconds (T001-T005)
- ✅ Add item to container in <1 second (T001-T006)
- ✅ Data persists across app restart (T001 schema)
- ✅ Supports 50+ containers, 500+ items (T002 queries with indexes)

### Files Modified

| File | Change | Task |
|------|--------|------|
| `app/src/models/Container.ts` | NEW | T001 |
| `app/src/db/migrations.ts` | MODIFY | T001 |
| `app/src/repositories/ContainerRepository.ts` | NEW | T002 |
| `app/src/repositories/ItemRepository.ts` | MODIFY | T004 |
| `app/src/services/ContainerService.ts` | NEW | T003 |
| `app/src/services/ItemService.ts` | MODIFY | T004 |
| `app/app/space/[id].tsx` | MODIFY | T005, T006 |

### Success Criteria (Definition of Done)

✅ All 6 tasks completed  
✅ User can create containers in a space  
✅ User can create items in space-level or containers  
✅ Items display grouped by container with "Uncategorized" section  
✅ Data persists across app close/reopen  
✅ No unhandled errors in normal usage  
✅ All acceptance scenarios from spec pass  

### Out of Scope (v1)

- ❌ Container editing or deletion
- ❌ Drag-and-drop reordering
- ❌ Moving items between containers
- ❌ Container archiving
- ❌ Container search/filtering
