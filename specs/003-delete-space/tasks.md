# Tasks: Delete Space

**Feature**: Delete Space  
**Feature Branch**: `003-delete-space`  
**Spec**: [spec.md](./spec.md)  
**Plan**: [plan.md](./plan.md)  
**Created**: 2026-05-05

---

## Overview

**Total Tasks**: 4 (Minimal MVP)

**Scope**: Permanent deletion from database, confirmation dialog, navigation back to list

**Out of Scope**: Testing, edge cases, UI polish, soft delete, undo

---

## Implementation Tasks

### Phase 1: Backend (Repository & Service)

- [x] T001 Add `deleteSpace(id)` method to SpaceRepository in `app/src/repositories/SpaceRepository.ts` with parameterized SQL DELETE query
- [x] T002 Add `deleteSpace(id)` method to SpaceService in `app/src/services/SpaceService.ts` that calls repository and handles errors

### Phase 2: Frontend (UI & Navigation)

- [x] T003 Add delete button to space detail screen in `app/src/screens/space/[id].tsx` and implement confirmation dialog using `Alert.alert()`
- [x] T004 Implement deletion logic in `app/src/screens/space/[id].tsx` to call service, show error on failure, navigate back on success, and refresh list with `useFocusEffect`

---

## Task Completion Guide

### T001: Repository.deleteSpace
**File**: `app/src/repositories/SpaceRepository.ts`

**Acceptance Criteria**:
- ✅ Method signature: `static async deleteSpace(id: string): Promise<void>`
- ✅ Uses parameterized SQL: `DELETE FROM spaces WHERE id = ?`
- ✅ Throws ServiceError if database operation fails
- ✅ No return value

**Test**: Call with valid space ID and verify space is deleted from database

---

### T002: Service.deleteSpace
**File**: `app/src/services/SpaceService.ts`

**Acceptance Criteria**:
- ✅ Method signature: `static async deleteSpace(id: string): Promise<void>`
- ✅ Calls `SpaceRepository.deleteSpace(id)`
- ✅ Re-throws errors from repository
- ✅ Propagates errors to caller for UI handling

**Test**: Call with valid ID; verify repository method is called

---

### T003: Add Delete Button & Confirmation Dialog
**File**: `app/src/screens/space/[id].tsx`

**Acceptance Criteria**:
- ✅ Delete button is visible and clickable on detail screen
- ✅ Button press triggers `Alert.alert()` confirmation dialog
- ✅ Alert title: "Delete Space"
- ✅ Alert message: `Delete '{spaceName}'? This cannot be undone.`
- ✅ Alert has two buttons: "Delete" and "Cancel"
- ✅ "Cancel" closes dialog without action

**Test**: Tap delete button and verify alert appears

---

### T004: Deletion Logic & Navigation
**File**: `app/src/screens/space/[id].tsx`

**Acceptance Criteria**:
- ✅ "Delete" button press calls `SpaceService.deleteSpace(id)`
- ✅ On success: navigate back to space list using `router.back()`
- ✅ On error: show alert `Alert.alert('Error', 'Failed to delete space. Please try again.')`
- ✅ On error: keep user on detail screen (do not navigate)
- ✅ SpaceScreen uses `useFocusEffect` to refresh list when returning from detail view
- ✅ Deleted space no longer appears in list

**Test**: Delete a space and verify it's gone from database and list

---

## Dependencies

- ✅ Feature 001-create-space (spaces exist)
- ✅ Feature 002-view-space-details (detail screen exists)
- ✅ React Navigation installed
- ✅ expo-sqlite client configured

---

## Success Criteria (MVP)

- ✅ User can delete a space from detail view
- ✅ Confirmation dialog appears before deletion
- ✅ Space is permanently removed from SQLite database
- ✅ Deleted space no longer appears in list
- ✅ User is navigated back to list after deletion
- ✅ Error alert shown if deletion fails
- ✅ All database queries use parameterized SQL
- ✅ No TypeScript errors

---

## Notes

- Minimal scope: No testing tasks, no optimization, no edge cases
- Reuses existing patterns from 001 and 002
- Empty state message implementation deferred to future enhancement
- Error handling: Show alert and keep user on screen (safest approach)
- No loading indicator (SQLite deletes are instant)
