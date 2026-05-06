---
description: "Phase 1 Implementation tasks for Outside Checklist feature"
---

# Tasks: Outside Checklist Feature (Phase 1 - MVP)

**Feature**: 010 - Outside Checklist  
**Phase**: 1 (Core MVP)  
**Target**: Working session management + item checklist

---

## Phase 1: Data Layer & Business Logic

**Purpose**: Setup database, models, repositories, and service layer for sessions and items

**Independent Test**: Create session → Add items → Check item → Complete session → Verify in database

### Data Models

- [ ] T001 Create OutsideSession domain types in `src/features/outside/models/OutsideSession.ts`
  - Include: OutsideSessionStatus enum (ACTIVE, COMPLETED), OutsideSession interface, DTOs
  
- [ ] T002 Create OutsideSessionItem domain types in `src/features/outside/models/OutsideSessionItem.ts`
  - Include: OutsideSessionItem interface, DTOs, check state

### Database Layer

- [ ] T003 Create SQLite migration in `src/db/migrations/004-create-outside-tables.ts`
  - Create `outside_sessions` table (id, title, status, created_at, completed_at)
  - Create `outside_session_items` table (id, session_id, item_id, is_checked, checked_at)
  - Add UNIQUE index on status='ACTIVE' for BR1 enforcement
  - Add UNIQUE(session_id, item_id) for BR3 enforcement

- [ ] T004 [P] Create OutsideSessionRepository in `src/features/outside/repositories/OutsideSessionRepository.ts`
  - Implement: create(), getActive(), getById(), complete(), delete()
  - Add error handling and logging

- [ ] T005 [P] Create OutsideSessionItemRepository in `src/features/outside/repositories/OutsideSessionItemRepository.ts`
  - Implement: addItems(), getSessionItems(), toggleCheck(), removeItem()
  - Add error handling and logging

### Business Logic Layer

- [ ] T006 Create OutsideService in `src/features/outside/services/OutsideService.ts`
  - Implement: createSession(), addItemsToSession(), checkItem(), completeSession(), deleteSession()
  - Add validation (title not empty, max 100 chars, no active session exists, item uniqueness)
  - Add error codes: ACTIVE_SESSION_EXISTS, SESSION_NOT_FOUND, ITEM_NOT_FOUND, etc.
  - Use useMemo(..., []) pattern to prevent re-creation

---

## Phase 2: User Interface Layer

**Purpose**: Create screens and modals for user interactions

**Independent Test**: Render all screens, verify navigation works

### Screens

- [ ] T007 Create OutsidePage in `app/src/features/outside/screens/OutsidePage.tsx`
  - Show empty state if no active session
  - Show active session card with item count + checked count
  - Add "Create Session" button
  - Add "View History" link
  - Wrap with SafeAreaView

- [ ] T008 Create SessionDetailScreen in `app/src/features/outside/screens/SessionDetailScreen.tsx`
  - Load session by ID
  - Display session title in header
  - Show item list with checkboxes (space/container context)
  - Show "X of Y checked" summary
  - Add "Add Items" button
  - Add "Complete Session" button
  - Wrap with SafeAreaView

- [ ] T009 Create SessionHistoryScreen in `app/src/features/outside/screens/SessionHistoryScreen.tsx` (Phase 2 - placeholder for now)
  - Basic structure only, full implementation in Phase 2

### Modals

- [ ] T010 Create SessionFormModal in `app/src/features/outside/screens/components/SessionFormModal.tsx`
  - Input field for session title (max 100 chars)
  - "Create" and "Cancel" buttons
  - Validate title before submission

- [ ] T011 Create ItemPickerModal in `app/src/features/outside/screens/components/ItemPickerModal.tsx`
  - Load all items from all spaces/containers
  - Show item with space/container name
  - Multi-select checkboxes
  - "Add Selected" and "Cancel" buttons
  - Filter out items already in session

---

## Phase 3: Navigation & Integration

**Purpose**: Wire up routes and test full flow

### Route Handlers

- [ ] T012 Create route handler in `app/outside.tsx`
  - Render OutsidePage with Stack.Screen (headerShown: false)

- [ ] T013 Create route handler in `app/outside/session/[id].tsx`
  - Extract session ID from params
  - Render SessionDetailScreen with Stack.Screen (headerShown: false)

- [ ] T014 Create route handler in `app/outside/history.tsx`
  - Render SessionHistoryScreen with Stack.Screen (headerShown: false)

### Navigation Setup

- [ ] T015 Add "Outside" tab to `app/(tabs)/_layout.tsx`
  - Add to tab navigator with icon
  - Point to `/outside` route

### Integration Testing

- [ ] T016 Manual test full flow:
  1. Open Outside tab
  2. Create session "Test Session"
  3. Add 3 items
  4. Check 2 items (verify count updates)
  5. Complete session
  6. Verify session appears in history
  7. Verify no active session on Outside tab

- [ ] T017 Manual test edge cases:
  1. Try creating second session while one is active (should fail)
  2. Try adding duplicate item (should be filtered)
  3. Try removing item from session (should remove)
  4. Restart app and verify active session persists

---

## Completion Checklist

- [ ] All 5 database/service tasks complete (T001-T006)
- [ ] All screens render without errors (T007-T009)
- [ ] All modals work (T010-T011)
- [ ] All routes configured (T012-T015)
- [ ] Full flow manually tested (T016-T017)
- [ ] No TypeScript errors
- [ ] App compiles and runs
- [ ] Ready for Phase 2
