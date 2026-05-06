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

- [x] T001 Create OutsideSession domain types in `src/features/outside/models/OutsideSession.ts`
  - Include: OutsideSessionStatus enum (ACTIVE, COMPLETED), OutsideSession interface, DTOs
  
- [x] T002 Create OutsideSessionItem domain types in `src/features/outside/models/OutsideSessionItem.ts`
  - Include: OutsideSessionItem interface, DTOs, check state

### Database Layer

- [x] T003 Create SQLite migration in `src/db/migrations/004-create-outside-tables.ts`
  - Create `outside_sessions` table (id, title, status, created_at, completed_at)
  - Create `outside_session_items` table (id, session_id, item_id, is_checked, checked_at)
  - Add UNIQUE index on status='ACTIVE' for BR1 enforcement
  - Add UNIQUE(session_id, item_id) for BR3 enforcement

- [x] T004 [P] Create OutsideSessionRepository in `src/features/outside/repositories/OutsideSessionRepository.ts`
  - Implement: create(), getActive(), getById(), complete(), delete()
  - Add error handling and logging

- [x] T005 [P] Create OutsideSessionItemRepository in `src/features/outside/repositories/OutsideSessionItemRepository.ts`
  - Implement: addItems(), getSessionItems(), toggleCheck(), removeItem()
  - Add error handling and logging

### Business Logic Layer

- [x] T006 Create OutsideService in `src/features/outside/services/OutsideService.ts`
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

## Phase 4: History & Polish (Phase 2 - Enhancement)

**Purpose**: Add history management, delete functionality, UX improvements

**Independent Test**: Complete session → View in history → Delete completed session → Verify removed

### History & Delete

- [ ] T018 Implement SessionHistoryScreen in `app/src/features/outside/screens/SessionHistoryScreen.tsx`
  - Load all COMPLETED sessions
  - Display in reverse chronological order (newest first)
  - Show: title, completed_at date, item count
  - Add "Delete" button/swipe option for each session
  - Add confirmation dialog before delete
  - Wrap with SafeAreaView

- [ ] T019 Add delete session functionality to OutsideService
  - Implement deleteSession(id) with validation
  - Update existing error codes or add CANNOT_DELETE_ACTIVE if needed

- [ ] T020 Add confirmation dialogs
  - Before completing session: "Mark this session as completed?"
  - Before deleting session: "Delete this session? This cannot be undone"
  - Use Alert.alert() or custom modal

### Modals & Forms Enhancements

- [ ] T021 Add search/filter to ItemPickerModal
  - Add text input field for item name search
  - Real-time filtering as user types
  - Show "No items found" if search returns empty

- [ ] T022 Add item removal from active session
  - Implement swipe-to-delete on session detail item list
  - Or context menu option "Remove from session"
  - Update OutsideSessionItemRepository.removeItem() if needed

### User Feedback

- [ ] T023 Add toast notifications
  - Session created: "Session created"
  - Session completed: "Session completed"
  - Item added: "Items added to session"
  - Session deleted: "Session deleted"

- [ ] T024 Improve error handling & messages
  - Show user-friendly error messages for validation errors
  - Add retry buttons for network/database errors
  - Log errors for debugging

### Navigation & UX

- [ ] T025 Update OutsidePage navigation
  - When completing a session, navigate to history and show toast
  - Add back navigation from history to main page

- [ ] T026 Session title immutability enforcement
  - Ensure title cannot be edited after creation (verify in service)
  - Do not show edit option in UI for existing sessions

### Integration Testing (Phase 2)

- [ ] T027 Manual test complete flow with history:
  1. Create session "Grocery run"
  2. Add items and check some
  3. Complete session
  4. Verify navigated to history
  5. Verify session shows in history with date
  6. Delete completed session
  7. Verify removed from history

- [ ] T028 Manual test UX improvements:
  1. Search for item in item picker (partial match)
  2. Try to remove item from active session (swipe/menu)
  3. Verify toast notifications appear
  4. Test error scenarios (e.g., create session with empty title)
  5. Verify all error messages are user-friendly

---

## Completion Checklist

### Phase 1 (if not completed)
- [ ] All 5 database/service tasks complete (T001-T006)
- [ ] All screens render without errors (T007-T009)
- [ ] All modals work (T010-T011)
- [ ] All routes configured (T012-T015)
- [ ] Full flow manually tested (T016-T017)
- [ ] No TypeScript errors
- [ ] App compiles and runs

### Phase 2
- [ ] History screen complete (T018)
- [ ] Delete functionality working (T019-T020)
- [ ] Search/filter in item picker (T021)
- [ ] Item removal from session (T022)
- [ ] Toast notifications showing (T023)
- [ ] Error messages user-friendly (T024)
- [ ] Navigation flows fixed (T025-T026)
- [ ] All manual tests passing (T027-T028)
- [ ] No TypeScript errors
- [ ] App compiles and runs
