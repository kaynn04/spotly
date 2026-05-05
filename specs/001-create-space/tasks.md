# Tasks: Create Space

**Input**: Design documents from `/specs/001-create-space/`  
**Branch**: `001-create-space`  
**Date**: 2026-05-05

## Format: `- [ ] [ID] [P?] [Story] Description`

- **[P]**: Parallelizable (different files, no dependencies)
- **[Story]**: User story (US1, US2, US3, US4)
- **File paths**: Exact locations in `app/` directory structure

---

## Phase 0: Setup (Project Initialization)

**Purpose**: Initialize project structure and dependencies

- [ ] T001 Create directory structure in `app/src/` (models/, services/, repositories/, db/)
- [ ] T002 Install dependencies: `expo-sqlite`, `uuid`, `react-native` (already in project)
- [ ] T003 [P] Create `app/tsconfig.json` with strict mode enabled for TypeScript
- [ ] T004 [P] Configure ESLint and Prettier for code quality in `app/`

---

## Phase 1: Foundation (Database & Types)

**Purpose**: Core infrastructure that all user stories depend on

**⚠️ CRITICAL**: Must complete before user story implementation

- [ ] T005 Create `app/src/db/client.ts` - Database connection using `openDatabaseSync()` from expo-sqlite
- [ ] T006 Create `app/src/db/migrations.ts` - Initialize spaces table schema on app startup with `CREATE TABLE IF NOT EXISTS spaces (...)`
- [ ] T007 [P] Create `app/src/models/Space.ts` - TypeScript interfaces: `Space`, `SpaceWithCount`, `CreateSpaceInput`
- [ ] T008 [P] Create `app/src/db/errors.ts` - Error types: `ServiceError`, `ValidationError`, `DatabaseError`
- [ ] T009 Export contract types from `app/src/models/contracts.ts` matching `specs/001-create-space/contracts/space-service.ts`

**Checkpoint**: Database schema initialized, TypeScript types defined, ready for service/repository implementation

---

## Phase 2: US1 - Create a New Space (Priority: P1)

**Goal**: Users can create a space with validation, persistence, and error handling  
**Independent Test**: Create a space via service, verify it persists to SQLite, retrieve and validate

### Tests for US1 (TDD - write before implementation)

- [ ] T010 [P] [US1] Unit test - `app/tests/unit/SpaceService.create.test.ts`: Valid space creation returns object with id, name, createdAt, updatedAt
- [ ] T011 [P] [US1] Unit test - `app/tests/unit/SpaceService.create.test.ts`: Empty name validation throws error "Space name cannot be empty"
- [ ] T012 [P] [US1] Unit test - `app/tests/unit/SpaceService.create.test.ts`: Whitespace-only name (e.g., "   ") is trimmed and rejected
- [ ] T013 [P] [US1] Unit test - `app/tests/unit/SpaceService.create.test.ts`: Name > 100 chars validation throws error
- [ ] T014 [P] [US1] Integration test - `app/tests/integration/SpaceRepository.create.test.ts`: Create space and retrieve from database using sql.js (in-memory)
- [ ] T015 [P] [US1] Integration test - `app/tests/integration/SpaceRepository.create.test.ts`: Verify space persists across database connections

### Implementation for US1

- [ ] T016 [US1] Create `app/src/repositories/SpaceRepository.ts` with method `create(name: string): Promise<Space>`
  - [ ] Use parameterized SQL: `INSERT INTO spaces (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)`
  - [ ] Generate UUID for id using `uuid.v4()`
  - [ ] Return Space object with camelCase field names
  - [ ] Catch and throw database errors as ServiceError
- [ ] T017 [US1] Create `app/src/services/SpaceService.ts` with method `create(name: string): Promise<Space>`
  - [ ] Trim input: `name.trim()`
  - [ ] Validate not empty: throw `ValidationError("Space name cannot be empty")`
  - [ ] Validate length ≤ 100: throw `ValidationError("Space name must be ≤ 100 characters")`
  - [ ] Call repository.create(trimmedName)
  - [ ] Catch repository errors and throw generic ServiceError("Failed to create space. Try again.")
  - [ ] Return Space object
- [ ] T018 [US1] Implement `ISpaceService` interface in `app/src/services/SpaceService.ts` matching contract

**Checkpoint**: Space creation works end-to-end from service to SQLite. Tests pass. Ready for US2.

---

## Phase 3: US2 - View All Spaces (Priority: P1)

**Goal**: Users can see a list of all spaces they've created  
**Independent Test**: Create multiple spaces, retrieve all, verify list contains all spaces including empty state

### Tests for US2

- [ ] T019 [P] [US2] Unit test - `app/tests/unit/SpaceService.getAll.test.ts`: Empty list returns `[]` when no spaces exist
- [ ] T020 [P] [US2] Unit test - `app/tests/unit/SpaceService.getAll.test.ts`: Multiple spaces returned in correct order (by createdAt)
- [ ] T021 [P] [US2] Integration test - `app/tests/integration/SpaceRepository.getAll.test.ts`: Create 3 spaces, retrieve all, verify count and data

### Implementation for US2

- [ ] T022 [US2] Add method `getAll(): Promise<Space[]>` to `app/src/repositories/SpaceRepository.ts`
  - [ ] Execute `SELECT id, name, created_at, updated_at FROM spaces ORDER BY created_at ASC`
  - [ ] Map database results to Space objects (convert snake_case to camelCase)
  - [ ] Return array of Space objects (empty array if no results)
- [ ] T023 [US2] Add method `getAll(): Promise<Space[]>` to `app/src/services/SpaceService.ts`
  - [ ] Call repository.getAll()
  - [ ] Catch errors and throw ServiceError
  - [ ] Return Space array

### UI for US2

- [ ] T024 [P] [US2] Create `app/app/(tabs)/index.tsx` (Home screen - Spaces List)
  - [ ] Display list of spaces using FlatList or ScrollView
  - [ ] Call `spaceService.getAll()` on mount
  - [ ] Show space name and item count for each (item count from US3)
  - [ ] Show empty state with message "No spaces yet. Create one to get started." when list is empty
  - [ ] Add button "Create Space" that navigates to create space screen
  - [ ] Add delete button (swipe or long-press) for each space (implemented in US4)
- [ ] T025 [P] [US2] Create space list component in `app/components/SpaceListItem.tsx`
  - [ ] Display space name
  - [ ] Show item count badge
  - [ ] Implement onPress navigation to space detail (US3)
  - [ ] Implement onDelete callback for delete button

**Checkpoint**: Users can see all spaces on home screen. UI displays empty state correctly. Ready for US3.

---

## Phase 4: US3 - View Space Details (Priority: P1)

**Goal**: Users can tap a space to view details including name and item count  
**Independent Test**: Create space, tap it, verify detail screen shows name and item count (0 for empty space)

### Tests for US3

- [ ] T026 [P] [US3] Unit test - `app/tests/unit/SpaceService.getSpaceWithItemCount.test.ts`: Get space by ID returns correct space with itemCount: 0
- [ ] T027 [P] [US3] Unit test - `app/tests/unit/SpaceService.getSpaceWithItemCount.test.ts`: Non-existent space ID returns null
- [ ] T028 [P] [US3] Integration test - `app/tests/integration/SpaceRepository.getSpaceWithItemCount.test.ts`: Query space with item count using LEFT JOIN

### Implementation for US3

- [ ] T029 [US3] Add method `getById(id: string): Promise<Space | null>` to `app/src/repositories/SpaceRepository.ts`
  - [ ] Execute parameterized `SELECT id, name, created_at, updated_at FROM spaces WHERE id = ?`
  - [ ] Return Space object or null if not found
- [ ] T030 [US3] Add method `getSpaceWithItemCount(id: string): Promise<SpaceWithCount | null>` to `app/src/repositories/SpaceRepository.ts`
  - [ ] Execute parameterized `SELECT spaces.id, spaces.name, spaces.created_at, spaces.updated_at, COUNT(items.id) as itemCount FROM spaces LEFT JOIN items ON spaces.id = items.space_id WHERE spaces.id = ? GROUP BY spaces.id`
  - [ ] Return SpaceWithCount object or null if space not found
  - [ ] Note: items table integration handled in separate item management feature spec
- [ ] T031 [US3] Add method `getById(id: string): Promise<Space | null>` to `app/src/services/SpaceService.ts`
  - [ ] Call repository.getById(id)
  - [ ] Catch errors and throw ServiceError
- [ ] T032 [US3] Add method `getSpaceWithItemCount(id: string): Promise<SpaceWithCount | null>` to `app/src/services/SpaceService.ts`
  - [ ] Call repository.getSpaceWithItemCount(id)
  - [ ] Catch errors and throw ServiceError

### UI for US3

- [ ] T033 [US3] Create `app/app/(tabs)/spaces/[id].tsx` (Space Detail Screen)
  - [ ] Get space ID from route params
  - [ ] Call `spaceService.getSpaceWithItemCount(id)` on mount
  - [ ] Display space name as header
  - [ ] Display item count (e.g., "5 items" or "No items")
  - [ ] Show empty state "No items in this space. Add one to get started." if itemCount is 0
  - [ ] Add button "Add Item" (will integrate with item management feature)
  - [ ] Add back navigation to home screen
- [ ] T034 [P] [US3] Create space detail header component in `app/components/SpaceDetailHeader.tsx`
  - [ ] Display space name
  - [ ] Show item count
  - [ ] Add edit/delete menu (delete implemented in US4)

**Checkpoint**: Users can view space details. Item count displays correctly (0 for MVP). Ready for US4 (P2, optional).

---

## Phase 5: US4 - Delete a Space (Priority: P2)

**Goal**: Users can delete spaces they no longer use with confirmation  
**Independent Test**: Create space, delete it, verify it no longer appears in list

### Tests for US4

- [ ] T035 [P] [US4] Unit test - `app/tests/unit/SpaceService.delete.test.ts`: Delete existing space succeeds
- [ ] T036 [P] [US4] Unit test - `app/tests/unit/SpaceService.delete.test.ts`: Delete non-existent space throws error or succeeds (define behavior)
- [ ] T037 [P] [US4] Integration test - `app/tests/integration/SpaceRepository.delete.test.ts`: Create space, delete it, verify not in list

### Implementation for US4

- [ ] T038 [US4] Add method `delete(id: string): Promise<void>` to `app/src/repositories/SpaceRepository.ts`
  - [ ] Execute parameterized `DELETE FROM spaces WHERE id = ?`
  - [ ] Note: Item deletion behavior (cascade, orphan, etc.) defined in item management spec
- [ ] T039 [US4] Add method `delete(id: string): Promise<void>` to `app/src/services/SpaceService.ts`
  - [ ] Call repository.delete(id)
  - [ ] Catch errors and throw ServiceError("Failed to delete space. Try again.")

### UI for US4

- [ ] T040 [P] [US4] Add delete button to `app/components/SpaceListItem.tsx`
  - [ ] Long-press or swipe to show delete option
  - [ ] On delete tap, show confirmation dialog
- [ ] T041 [P] [US4] Create `app/components/DeleteSpaceDialog.tsx` (Confirmation Modal)
  - [ ] Display message: "Are you sure you want to delete [space name]?"
  - [ ] Show "Cancel" and "Delete" buttons
  - [ ] On Delete, call `spaceService.delete(id)`
  - [ ] On success, dismiss dialog and refresh space list
  - [ ] On error, show error message "Failed to delete space. Try again."
- [ ] T042 [US4] Add delete functionality to `app/app/(tabs)/spaces/[id].tsx`
  - [ ] Add delete button in header or menu
  - [ ] Show confirmation dialog
  - [ ] On confirmation, delete space and navigate back to home
  - [ ] Show error toast if delete fails

**Checkpoint**: Users can delete spaces with confirmation. US4 (P2) complete. MVP scope done.

---

## Phase 6: Testing & Quality

**Purpose**: Comprehensive test coverage and integration testing

### Unit Tests

- [ ] T043 [P] Complete unit tests for `SpaceService` in `app/tests/unit/SpaceService.test.ts`
  - [ ] Covers all methods: create, getAll, getById, getSpaceWithItemCount, delete
  - [ ] Edge cases: empty names, whitespace, max length, null values
  - [ ] Error scenarios: validation failures, database errors
- [ ] T044 [P] Complete unit tests for validation logic in `app/src/services/validation.ts`
  - [ ] Trim function: "  Home  " → "Home"
  - [ ] Empty check: "" and "   " both fail
  - [ ] Length check: 0-100 valid, 101+ invalid

### Integration Tests

- [ ] T045 [US1] Integration test - `app/tests/integration/SpaceCreation.test.ts` (Full workflow)
  - [ ] Create space via service
  - [ ] Verify persisted in SQLite
  - [ ] Retrieve space
  - [ ] Verify all fields match (id, name, createdAt, updatedAt)
  - [ ] Use sql.js for in-memory database
- [ ] T046 [US2] Integration test - `app/tests/integration/SpaceList.test.ts` (List workflow)
  - [ ] Create multiple spaces (3)
  - [ ] List all spaces
  - [ ] Verify all returned with correct order
- [ ] T047 [US3] Integration test - `app/tests/integration/SpaceDetail.test.ts` (Detail workflow)
  - [ ] Create space
  - [ ] Get space with item count
  - [ ] Verify itemCount: 0 for empty space
- [ ] T048 [US4] Integration test - `app/tests/integration/SpaceDelete.test.ts` (Delete workflow)
  - [ ] Create space
  - [ ] Delete space
  - [ ] Verify not in list

### E2E Tests (Manual or Detox)

- [ ] T049 [P] E2E test - `app/tests/e2e/CreateSpace.e2e.ts` (User flow)
  - [ ] App opens to home screen
  - [ ] Tap "Create Space" button
  - [ ] Enter space name "Home"
  - [ ] Tap "Save"
  - [ ] Verify space appears in list
- [ ] T050 [P] E2E test - `app/tests/e2e/PersistenceCheck.e2e.ts` (Data persistence)
  - [ ] Create space "Home"
  - [ ] Close and restart app
  - [ ] Verify space still exists
  - [ ] Verify data is correct
- [ ] T051 [P] E2E test - `app/tests/e2e/DeleteSpace.e2e.ts` (Delete workflow)
  - [ ] Create space
  - [ ] Long-press to delete
  - [ ] Confirm deletion
  - [ ] Verify removed from list
- [ ] T052 [P] E2E test - `app/tests/e2e/Validation.e2e.ts` (Validation feedback)
  - [ ] Try to create space with empty name → Error shown
  - [ ] Try name > 100 chars → Error shown
  - [ ] Try "   " (whitespace) → Error shown

### Performance & Optimization

- [ ] T053 [P] Performance test - `app/tests/performance/SpaceCreation.test.ts`
  - [ ] Verify space creation completes in < 500ms
  - [ ] Measure UUID generation, trimming, validation time
  - [ ] Measure SQLite write time
- [ ] T054 [P] Performance test - `app/tests/performance/SpaceList.test.ts`
  - [ ] Verify listing 20 spaces completes in < 100ms
  - [ ] Measure list rendering at 60 fps
- [ ] T055 [P] Database optimization
  - [ ] Verify index on `created_at` is used
  - [ ] Verify queries are parameterized (no injection risk)

### Documentation

- [ ] T056 [P] Create `app/src/services/README.md` documenting SpaceService interface and usage
- [ ] T057 [P] Create `app/src/repositories/README.md` documenting repository pattern and parameterized SQL
- [ ] T058 [P] Create `app/tests/README.md` explaining test structure (unit, integration, e2e)

**Checkpoint**: All tests pass, documentation complete, ready for code review and merge.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Final quality, error handling, and edge cases

- [ ] T059 Error handling audit
  - [ ] Verify all errors are caught and handled in service layer
  - [ ] Verify UI displays error messages properly
  - [ ] Verify no unhandled promise rejections
- [ ] T060 [P] Loading states
  - [ ] Add loading indicator during space creation (< 500ms)
  - [ ] Add loading indicator during list fetch
  - [ ] Disable buttons during async operations
- [ ] T061 [P] Input sanitization review
  - [ ] Verify trimming works for all unicode characters
  - [ ] Verify emoji and special characters handled correctly (parameterized SQL prevents injection)
- [ ] T062 Database cleanup (optional for future)
  - [ ] Add database reset function for testing
  - [ ] Document schema versioning for migrations in V2
- [ ] T063 Code review checklist
  - [ ] All SQL queries use parameterized placeholders (? not string concat)
  - [ ] All service methods have error handling
  - [ ] All UI components show loading/error states
  - [ ] All tests pass (unit, integration, e2e)
  - [ ] TypeScript strict mode enabled, no `any` types

**Checkpoint**: Feature complete, all quality checks pass, ready for release.

---

## Dependency Graph

```
Phase 0: Setup
    ↓
Phase 1: Foundation (Database, Types, Errors)
    ├─ T005 (DB client)
    ├─ T006 (migrations)
    ├─ T007 (types)
    ├─ T008 (errors)
    ├─ T009 (contracts)
    
Phase 2: US1 (Create Space) - Blocks all user stories
    ├─ T010-T015 (tests)
    ├─ T016 (repository.create)
    ├─ T017-T018 (service.create)
    ↓ Depends on Phase 1
    
Phase 3: US2 (View Spaces) - Can run after US1
    ├─ T019-T021 (tests)
    ├─ T022-T023 (repository/service)
    ├─ T024-T025 (UI)
    ↓ Depends on US1
    
Phase 4: US3 (View Details) - Can run after US2
    ├─ T026-T028 (tests)
    ├─ T029-T032 (repository/service)
    ├─ T033-T034 (UI)
    ↓ Depends on US2
    
Phase 5: US4 (Delete Space) - Can run in parallel with US3
    ├─ T035-T037 (tests)
    ├─ T038-T039 (repository/service)
    ├─ T040-T042 (UI)
    ↓ Depends on US3
    
Phase 6: Testing & Quality - Run after all features
    ├─ T043-T055 (comprehensive tests)
    ↓ Depends on all phases
    
Phase 7: Polish & Review - Final quality check
    ├─ T056-T063 (docs, cleanup, review)
    ↓ Depends on Phase 6
```

---

## Parallel Execution Opportunities

**Can run in parallel**:
- T003, T004 (ESLint/Prettier setup)
- T010-T015 (Tests for US1 - write before implementation)
- T019-T021 (Tests for US2)
- T026-T028 (Tests for US3)
- T035-T037 (Tests for US4)
- T043-T055 (Unit/integration/performance tests - run on separate branches)
- T056-T063 (Documentation and polish)

**Cannot run in parallel** (dependencies):
- T016 depends on T005, T006, T007
- T017 depends on T016
- US2 depends on US1
- US3 depends on US2
- US4 depends on US3

---

## MVP Scope vs Optional Features

**MVP (Must Have - Required for Release)**:
- ✅ US1: Create Space (T016-T018)
- ✅ US2: View All Spaces (T022-T025)
- ✅ US3: View Space Details (T029-T034)
- ✅ Foundation (T005-T009)
- ✅ Tests (T010-T015, T019-T021, T026-T028)
- ✅ E2E (T049-T051)

**Optional (Can Defer to V1.1 if Time)**:
- ⏳ US4: Delete Space (T038-T042) - P2
- ⏳ Performance Optimization (T053-T055)
- ⏳ Advanced Documentation (T056-T058)

---

## Suggested Execution Order

1. **T001-T004**: Setup (1 hour)
2. **T005-T009**: Foundation (2 hours)
3. **T010-T015**: US1 Tests (1 hour) - Write before code
4. **T016-T018**: US1 Implementation (2 hours)
5. **T019-T021**: US2 Tests (1 hour)
6. **T022-T025**: US2 Implementation + UI (2 hours)
7. **T026-T028**: US3 Tests (1 hour)
8. **T029-T034**: US3 Implementation + UI (2 hours)
9. **T035-T037**: US4 Tests (1 hour) - Optional if time
10. **T038-T042**: US4 Implementation + UI (2 hours) - Optional if time
11. **T043-T055**: Comprehensive Testing (3 hours)
12. **T049-T052**: E2E Tests (2 hours)
13. **T056-T063**: Polish & Review (1 hour)

**Estimated Total**: 21 hours for MVP (T001-T052), 22 hours with US4 (T001-T063)

---

## Success Criteria (Definition of Done)

✅ All tasks in Phase 1-4 completed  
✅ All MVP tests pass (unit, integration, e2e)  
✅ Space creation works end-to-end  
✅ Spaces persist after app restart  
✅ Data validation prevents invalid spaces  
✅ Error messages are user-friendly  
✅ No TypeScript errors or `any` types  
✅ All SQL queries are parameterized  
✅ Code review approved  
✅ Ready to merge to main  

**For Release**: Include T005-T052 (MVP scope), optionally T053-T063 (polish)
