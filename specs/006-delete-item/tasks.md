# Tasks: Delete Item

**Feature**: Delete Item  
**Feature Branch**: `006-delete-item`  
**Spec**: [spec.md](./spec.md)  
**Plan**: [plan.md](./plan.md)  
**Created**: 2026-05-06

---

## Overview

**Total Tasks**: 3 (Minimal MVP)

**Scope**: Repository method, service method, UI button with confirmation, delete and refresh

**Out of Scope**: Testing, optimization, edge case handling, animations

---

## Implementation Tasks

### Phase 1: Backend (Repository & Service)

- [x] T001 [P] [US1] Add deleteItem method to ItemRepository in `app/src/repositories/ItemRepository.ts` with parameterized DELETE query
- [x] T002 [P] [US1] Add deleteItem method to ItemService in `app/src/services/ItemService.ts` with error handling

### Phase 2: Frontend (UI Integration)

- [x] T003 [US1] Add delete button to item row with confirmation alert and delete logic in `app/app/space/[id].tsx`

---

## Task Completion Guide

### T001: Add ItemRepository.deleteItem

**File**: `app/src/repositories/ItemRepository.ts`

**Acceptance Criteria**:
- [ ] Method signature: `async deleteItem(itemId: string): Promise<void>`
- [ ] Parameterized DELETE query: `DELETE FROM items WHERE id = ?`
- [ ] Throws ServiceError('DB_ERROR') on failure
- [ ] No return value (Promise<void>)
- [ ] Uses existing database connection (this.db)

**Testing**:
- Call method with valid item ID
- Verify item is removed from items table
- Verify method throws on invalid ID

---

### T002: Add ItemService.deleteItem

**File**: `app/src/services/ItemService.ts`

**Acceptance Criteria**:
- [ ] Method signature: `async deleteItem(itemId: string): Promise<void>`
- [ ] Calls ItemRepository.deleteItem(itemId)
- [ ] Catches ServiceError and re-throws
- [ ] Converts unexpected errors to ServiceError('DB_ERROR')
- [ ] Follows existing ItemService pattern

**Testing**:
- Call method with valid item ID
- Verify repository method is called
- Verify errors are properly handled

---

### T003: Add Delete Button to SpaceDetailScreen

**File**: `app/app/space/[id].tsx`

**Acceptance Criteria**:
- [ ] Delete button appears inline next to Move button for each item
- [ ] Delete button is red/destructive color (#ff3333)
- [ ] Pressing delete button shows Alert.alert() with "Delete Item" title
- [ ] Alert has "Delete" (destructive) and "Cancel" options
- [ ] Pressing "Delete" calls ItemService.deleteItem(itemId)
- [ ] On success: Calls loadItems() to refresh list
- [ ] Item immediately disappears from list
- [ ] Pressing "Cancel" closes alert without deleting
- [ ] On error: Shows Alert.alert() with error message
- [ ] Delete button styled consistently with Move button

**Implementation Details**:
- Handler function: `handleDeletePress(itemId: string)` - Shows confirmation alert
- Handler function: `deleteItem(itemId: string)` - Calls service and refreshes
- Style: `deleteButton` with backgroundColor #ff3333
- Style: `deleteButtonText` with color #fff

**Testing**:
- Open space with items
- Press delete button on any item
- Verify confirmation alert appears
- Press "Cancel" - verify item still exists
- Press delete again, then "Delete" - verify item disappears
- Create new item, restart app - verify deleted item is gone
- Delete item when service throws error - verify error alert shown

---

## Dependencies

**User Story Completion Order**:
- Phase 1: T001 and T002 can run in parallel (different files, no dependencies)
- Phase 2: T003 depends on T001 and T002 complete

**Parallel Execution Example**:
```
Start T001 and T002 simultaneously (both are [P])
  ↓ (wait for both to complete)
Start T003 (depends on working repository and service methods)
  ↓
Feature complete - ready for manual testing
```

**Implementation Strategy**: 
- **MVP First**: All 3 tasks together form a working delete feature
- **Independent**: Can be tested immediately after implementation
- **Vertical Slice**: Works end-to-end from button click to database
- **No Dependencies**: No other features need to complete first

---

## Checklist Format Reference

Each task follows this format:
```
- [ ] [TaskID] [P?] [Story] Description with file path
```

Where:
- `[ ]` = Checkbox (unchecked when generated, checked when complete)
- `[TaskID]` = Sequential task number (T001, T002, T003...)
- `[P]` = Optional - included only if task can run in parallel
- `[Story]` = Required for user story tasks - [US1], [US2], etc.
- `Description` = Clear action with exact file path

**Example**: `- [ ] T003 [US1] Add delete button to item row with confirmation alert and delete logic in app/app/space/[id].tsx`
