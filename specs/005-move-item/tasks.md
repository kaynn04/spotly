# Tasks: Move Item

**Feature**: Move Item  
**Feature Branch**: `005-move-item`  
**Spec**: [spec.md](./spec.md)  
**Plan**: [plan.md](./plan.md)  
**Created**: 2026-05-05

---

## Overview

**Total Tasks**: 4 (Minimal MVP)

**Scope**: Add repository/service methods for move, add UI controls (Move button + Modal), refresh lists

**Out of Scope**: Testing, optimization, edge case handling, animations

---

## Implementation Tasks

### Phase 1: Backend (Repository & Service)

- [x] T001 Add updateSpaceId method to ItemRepository in `app/src/repositories/ItemRepository.ts` with parameterized UPDATE query
- [x] T002 Add moveItem method to ItemService in `app/src/services/ItemService.ts` with validation and error handling

### Phase 2: Frontend (UI Integration)

- [x] T003 Add Move button next to each item in FlatList on SpaceDetailScreen in `app/app/space/[id].tsx` with state and handlers
- [x] T004 Add Modal with space selection FlatList to SpaceDetailScreen and connect to moveItem service

---

## Task Completion Guide

### T001: Add ItemRepository.updateSpaceId
**File**: `app/src/repositories/ItemRepository.ts`

**Acceptance Criteria**:
- ✅ `static async updateSpaceId(itemId: string, newSpaceId: string): Promise<void>` method exists
- ✅ Uses parameterized UPDATE query: `UPDATE items SET space_id = ? WHERE id = ?`
- ✅ Parameters: [newSpaceId, itemId]
- ✅ Throws ServiceError on database failure
- ✅ Returns void (no return value)

**Test**: Call method directly and verify item's space_id changes in database

---

### T002: Add ItemService.moveItem
**File**: `app/src/services/ItemService.ts`

**Acceptance Criteria**:
- ✅ `static async moveItem(itemId: string, currentSpaceId: string, newSpaceId: string): Promise<void>` method exists
- ✅ Validates: `newSpaceId !== currentSpaceId` (prevent no-op move)
- ✅ Throws ServiceError if moving to same space: "Cannot move item to same space"
- ✅ Calls `ItemRepository.updateSpaceId(itemId, newSpaceId)`
- ✅ Propagates repository errors as ServiceError
- ✅ Returns void

**Test**: Call service with valid newSpaceId; verify item moves. Call with same spaceId; verify error thrown

---

### T003: Add Move Button to SpaceDetailScreen
**File**: `app/app/space/[id].tsx`

**Acceptance Criteria**:
- ✅ State added: `showMoveModal`, `selectedMoveItemId`, `allSpaces`
- ✅ Move button displays inline with delete button for each item in FlatList
- ✅ Move button text: "Move"
- ✅ Move button styling: similar to delete button (but different color, e.g., blue)
- ✅ Move button disabled if `spaces.length < 2` (fewer than 2 spaces)
- ✅ Clicking Move button: sets `showMoveModal=true`, stores itemId in `selectedMoveItemId`

**Test**: Navigate to detail screen, verify Move button appears next to item, click it

---

### T004: Add Move Modal and Handle Space Selection
**File**: `app/app/space/[id].tsx`

**Acceptance Criteria**:
- ✅ Modal component conditionally renders when `showMoveModal === true`
- ✅ Modal title: "Move to space"
- ✅ Modal contains FlatList showing all spaces EXCEPT currentSpaceId
- ✅ Each space item in Modal is pressable (Pressable component)
- ✅ Clicking space in Modal calls: `handleSelectTargetSpace(spaceId)`
- ✅ handleSelectTargetSpace:
  - Calls `ItemService.moveItem(selectedMoveItemId, currentSpaceId, targetSpaceId)`
  - On success: closes Modal, refreshes both space lists via `loadItems()`
  - On error: shows Alert.alert with error message, Modal stays open
- ✅ Modal has Cancel button to close without moving
- ✅ useEffect or service call fetches all spaces on mount for Modal list

**Test**: Open Modal, select target space, verify item moves. Try selecting same space; verify error

---

## Task Dependencies

1. **T001** (updateSpaceId) → required before T002
2. **T002** (moveItem) → required before T003-T004
3. **T003** (Move button) → independent, can run parallel with T002
4. **T004** (Modal) → required after T002-T003

**Recommended execution order**: T001 → T002 → T003 → T004 (sequential for simplicity)

**Parallel execution**: T001 & T002 must be sequential. T003 can start while T002 completes, but T004 must wait for T002.

---

## Success Criteria (MVP)

- ✅ User can click Move button on item
- ✅ Modal shows available target spaces
- ✅ User selects space and item moves
- ✅ Item appears in new space list
- ✅ Item disappears from old space list
- ✅ Error alert shown if move fails
- ✅ No TypeScript errors
- ✅ No console errors
- ✅ Works end-to-end

---

## Notes

- Minimal scope: Only 4 tasks, no testing, no edge cases
- Reuses existing patterns: Move button like delete button, Modal/FlatList patterns already in codebase
- Database: Single UPDATE query, no schema changes needed
- Error handling: Simple try-catch, Alert.alert() to user
- No loading states (SQLite instant)
- Move button auto-disabled if < 2 spaces (checked via `spaces.length < 2`)
