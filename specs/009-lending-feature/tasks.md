# Tasks: Lending Tracker

**Input**: [spec.md](./spec.md), [plan.md](./plan.md), [data-model.md](./data-model.md)  
**Feature Branch**: `009-lending-feature`  
**Status**: Ready for Implementation  
**Target Duration**: ~4 days (6 phases)

---

## Task Format

- **[ID]**: Sequential task number (T001, T002, etc.)
- **[P]**: Can run in parallel (different files, no blocking dependencies)
- **[US#]**: User story reference (US1, US2, US3, US4)
- **Description**: What to implement and where

---

## Phase 1: Setup & Data Layer (Foundation)

**Purpose**: Create database infrastructure and data models  
**Duration**: ~1 day  
**Blockade**: Must complete before service layer

### Tasks

- [X] T001 Create Lending TypeScript model/interface in `src/features/lending/models/Lending.ts`
  - **Objective**: Define type structure for lending domain
  - **Scope**: Type definitions only (no logic), match data-model.md specification
  - **Files**: `src/features/lending/models/Lending.ts` (new)
  - **Expected Output**: Lending interface with all 9 attributes (id, item_id, borrower_name, note, lent_at, returned_at, status, created_at, updated_at)
  - **Dependencies**: None
  - **Validation**: TypeScript compiles without errors; types match spec
  - ✅ **COMPLETED**: LendingStatus enum, Lending interface, DTOs (Create/Return), LendingWithItemContext, ServiceError

- [X] T002 Create database migration file in `src/db/migrations/`
  - **Objective**: Add lendings table schema to SQLite
  - **Scope**: Migration file creation (not execution; execution happens at app startup)
  - **Files**: `src/db/migrations/003-create-lendings-table.ts` (new)
  - **Expected Output**: Migration that creates lendings table with proper schema, indexes, constraints
  - **Dependencies**: T001 (need Lending type reference)
  - **Validation**: Migration file is valid TypeScript; idempotent (safe to run multiple times)
  - ✅ **COMPLETED**: Migration file with full schema, 4 indexes, check constraints, unique constraints

- [X] T003 Update migrations.ts to include new lending migration
  - **Objective**: Wire up migration to run at app startup
  - **Scope**: Update main migrations file to reference and execute the new lending migration
  - **Files**: `src/db/migrations.ts` (existing)
  - **Expected Output**: New migration registered and will execute on app startup
  - **Dependencies**: T002
  - **Validation**: Migration runs without errors on app startup
  - ✅ **COMPLETED**: Import added, createLendingsTable() called in initializeDatabase(), lendings added to resetDatabase()

- [X] T004 [P] Create LendingRepository interface and skeleton in `src/features/lending/repositories/`
  - **Objective**: Define repository contract and method signatures
  - **Scope**: Method signatures only (getByStatus, getAll, getById, getByItemId, hasActiveLending, create, markAsReturned)
  - **Files**: `src/features/lending/repositories/LendingRepository.ts` (new)
  - **Expected Output**: Repository class with all methods defined (skeleton implementations that throw "not implemented" errors)
  - **Dependencies**: T001 (Lending type)
  - **Validation**: All methods present and callable; TypeScript compiles
  - ✅ **COMPLETED**: 7 methods with full JSDoc, dependency injection via constructor

- [X] T005 [P] Create LendingRepository.getByStatus() implementation
  - **Objective**: Implement query to fetch lendings by status (ACTIVE/RETURNED)
  - **Scope**: Single query method for fetching lendings by status, sorted by lent_at DESC
  - **Files**: `src/features/lending/repositories/LendingRepository.ts` (modify T004)
  - **Expected Output**: Parameterized SQL query that returns Lending[] sorted descending by date
  - **Dependencies**: T002 (schema), T004 (skeleton)
  - **Validation**: Query returns correct results with proper sorting
  - ✅ **COMPLETED**: Implemented with index-optimized query

- [X] T006 [P] Create LendingRepository.getAll() implementation
  - **Objective**: Implement query to fetch all lendings (ACTIVE + RETURNED)
  - **Scope**: Query all lendings regardless of status, sorted by lent_at DESC
  - **Files**: `src/features/lending/repositories/LendingRepository.ts` (modify T004)
  - **Expected Output**: SQL query returns all Lending[] sorted descending by date
  - **Dependencies**: T002 (schema), T004 (skeleton)
  - **Validation**: Returns both ACTIVE and RETURNED lendings in correct order
  - ✅ **COMPLETED**: Implemented with proper sorting

- [X] T007 [P] Create LendingRepository.getById() implementation
  - **Objective**: Implement query to fetch single lending by ID
  - **Scope**: Fetch one lending record with null handling for not-found
  - **Files**: `src/features/lending/repositories/LendingRepository.ts` (modify T004)
  - **Expected Output**: Parameterized query returns Lending | null
  - **Dependencies**: T002 (schema), T004 (skeleton)
  - **Validation**: Returns correct record; returns null for non-existent ID
  - ✅ **COMPLETED**: Implemented with null-safe return

- [X] T008 [P] Create LendingRepository.hasActiveLending() implementation
  - **Objective**: Check if item has active lending (for enforcing business rule BR-001)
  - **Scope**: Quick existence check query with (item_id, status) filter
  - **Files**: `src/features/lending/repositories/LendingRepository.ts` (modify T004)
  - **Expected Output**: Returns boolean; uses index for performance
  - **Dependencies**: T002 (schema), T004 (skeleton)
  - **Validation**: Returns true only if ACTIVE lending exists for item; false otherwise
  - ✅ **COMPLETED**: Implemented with efficient index-based lookup

- [X] T009 [P] Create LendingRepository.create() implementation
  - **Objective**: Insert new lending record with ACTIVE status
  - **Scope**: Create lending with all required fields, auto-generate timestamps
  - **Files**: `src/features/lending/repositories/LendingRepository.ts` (modify T004)
  - **Expected Output**: Parameterized INSERT returns created Lending with all fields populated
  - **Dependencies**: T001 (Lending type), T002 (schema), T004 (skeleton)
  - **Validation**: Inserted record matches input data; timestamps set correctly
  - ✅ **COMPLETED**: Implemented with UUID generation and timestamp management

- [X] T010 [P] Create LendingRepository.markAsReturned() implementation
  - **Objective**: Update lending to RETURNED status with timestamp
  - **Scope**: Atomic UPDATE of status and returned_at (single statement)
  - **Files**: `src/features/lending/repositories/LendingRepository.ts` (modify T004)
  - **Expected Output**: Parameterized UPDATE returns updated Lending with status='RETURNED' and returned_at set
  - **Dependencies**: T001 (Lending type), T002 (schema), T004 (skeleton)
  - **Validation**: Status changed to RETURNED; returned_at is valid timestamp; updated_at refreshed
  - ✅ **COMPLETED**: Implemented with atomic update and timestamp refresh

**✅ Checkpoint 1**: Database schema created; all repository methods implemented and callable. Data layer ready for service layer.

---

## Phase 2: Service Layer (Business Logic & Validation)

**Purpose**: Implement business rules and validation  
**Duration**: ~1 day  
**Blockade**: Must complete before UI layer  
**Depends On**: Phase 1 complete

### Tasks

- [X] T011 Create LendingService skeleton in `src/features/lending/services/`
  - **Objective**: Create service class with dependency injection
  - **Scope**: Skeleton with constructor (inject ItemRepository, LendingRepository)
  - **Files**: `src/features/lending/services/LendingService.ts` (new)
  - **Expected Output**: Service class instantiated with dependencies; methods defined (throw "not implemented")
  - **Dependencies**: T001 (Lending type), T004 (LendingRepository), existing ItemRepository
  - **Validation**: TypeScript compiles; service instantiable
  - ✅ **COMPLETED**: Full service with DI, 8 methods, error handling

- [X] T012 Implement LendingService.createLending() method
  - **Objective**: Core business logic for lending creation with full validation
  - **Scope**: Validate borrower name, item exists, no active lending; enforce BR-001, BR-002, BR-003
  - **Files**: `src/features/lending/services/LendingService.ts` (modify T011)
  - **Expected Output**: Method accepts (itemId, borrowerName, note?), validates, calls repository, returns Lending
  - **Dependencies**: T011 (service), T009 (create), T008 (hasActiveLending)
  - **Validation**: Creates lending when valid; throws ServiceError with descriptive message when invalid
  - ✅ **COMPLETED**: 3-layer validation (borrower, item exists, no active); unique constraint handling

- [X] T013 Implement LendingService.markAsReturned() method
  - **Objective**: Business logic for marking lending as returned
  - **Scope**: Validate lending exists and is ACTIVE; enforce BR-004 (atomic update)
  - **Files**: `src/features/lending/services/LendingService.ts` (modify T011)
  - **Expected Output**: Method accepts lendingId, validates, calls repository, returns updated Lending
  - **Dependencies**: T011 (service), T007 (getById), T010 (markAsReturned)
  - **Validation**: Marks ACTIVE lending as RETURNED; throws error if already RETURNED or not found
  - ✅ **COMPLETED**: 2-step validation (exists, is active); proper error codes

- [X] T014 [P] Implement LendingService.getActiveLendings() method
  - **Objective**: Fetch ACTIVE lendings (primary view for US2)
  - **Scope**: Call repository to get ACTIVE lendings; fetch item details for each
  - **Files**: `src/features/lending/services/LendingService.ts` (modify T011)
  - **Expected Output**: Returns Lending[] with item details populated
  - **Dependencies**: T011 (service), T005 (getByStatus)
  - **Validation**: Returns only ACTIVE lendings in correct order; includes item context
  - ✅ **COMPLETED**: Simple delegation to repository with error wrapping

- [X] T015 [P] Implement LendingService.getAllLendings() method
  - **Objective**: Fetch all lendings for history view (US4)
  - **Scope**: Call repository for all lendings (ACTIVE + RETURNED); fetch item details
  - **Files**: `src/features/lending/services/LendingService.ts` (modify T011)
  - **Expected Output**: Returns Lending[] sorted by date; both statuses included
  - **Dependencies**: T011 (service), T006 (getAll)
  - **Validation**: Returns both ACTIVE and RETURNED; correct sorting
  - ✅ **COMPLETED**: Simple delegation to repository with error wrapping

- [X] T016 [P] Implement LendingService.canLendItem() helper method
  - **Objective**: Check if item can be lent (for UI button enable/disable, US1)
  - **Scope**: Returns boolean based on active lending check
  - **Files**: `src/features/lending/services/LendingService.ts` (modify T011)
  - **Expected Output**: Helper method returns true if item can be lent, false if already active
  - **Dependencies**: T011 (service), T008 (hasActiveLending)
  - **Validation**: Returns correct boolean; matches BR-001 constraint
  - ✅ **COMPLETED**: Boolean inversion helper with error wrapping

**✅ Checkpoint 2**: All service methods implemented with business logic and validation. Service layer ready for UI implementation.

---

## Phase 3: UI - Lending Creation (US1 - Lend an Item)

**Purpose**: Implement user flow to create lending  
**Duration**: ~1 day  
**Depends On**: Phase 1 & 2 complete  
**User Story**: US1 - Lend an Item (P1)

### Tasks

- [X] T017 Create LendingPage component (active list view)
  - **Objective**: Main lending tab showing active lendings
  - **Scope**: Component structure, state (lendings, loading, error), useFocusEffect for data loading
  - **Files**: `src/features/lending/screens/LendingPage.tsx` (update existing placeholder)
  - **Expected Output**: Component renders empty state initially; loads data on focus
  - **Dependencies**: T014 (getActiveLendings), existing Expo Router setup
  - **Validation**: Component mounts; useFocusEffect triggers on focus; loading state displays
  - ✅ **COMPLETED**: Full implementation with service integration, state management, error handling

- [X] T018 Add "Lend Item" button to LendingPage
  - **Objective**: User action to initiate lending creation (US1 entry point)
  - **Scope**: Button component with handler to show item selection
  - **Files**: `src/features/lending/screens/LendingPage.tsx` (modify T017)
  - **Expected Output**: Button visible on page; press handler implemented (not yet showing selection UI)
  - **Dependencies**: T017
  - **Validation**: Button rendered and pressable
  - ✅ **COMPLETED**: Styled action button with modal trigger

- [X] T019 Create item selection modal/component
  - **Objective**: Allow user to pick an item to lend (US1 step 1)
  - **Scope**: Modal/screen showing all items with item name, space, container context
  - **Files**: `src/features/lending/screens/components/ItemSelectionModal.tsx` (new)
  - **Expected Output**: Modal displays items; tap selects item; item passed to form
  - **Dependencies**: T017, existing ItemRepository/queries
  - **Validation**: Items displayed with correct context; selection works
  - ✅ **COMPLETED**: Modal component with FlatList, loading/error states, item context display

- [X] T020 Create lending form component (borrower + note)
  - **Objective**: User enters borrower name and optional note (US1 step 2-3)
  - **Scope**: Form with required borrower field, optional note field, validation
  - **Files**: `src/features/lending/screens/components/LendingFormModal.tsx` (new)
  - **Expected Output**: Form fields validated; submission disabled until valid
  - **Dependencies**: T019
  - **Validation**: Borrower field required; note optional; form prevents submit when invalid
  - ✅ **COMPLETED**: Form modal with validation, character counter, keyboard handling

- [X] T021 Implement form submission (create lending)
  - **Objective**: Call LendingService.createLending() from form (US1 step 4)
  - **Scope**: Handle submission, show loading/spinner, success/error feedback
  - **Files**: `src/features/lending/screens/LendingPage.tsx` (modify T020)
  - **Expected Output**: Form submission calls service; shows success toast or error alert
  - **Dependencies**: T012 (createLending), T020 (form)
  - **Validation**: Lending created in DB; list refreshes; user sees new lending
  - ✅ **COMPLETED**: Service integration with error codes, alerts, list refresh

- [X] T022 Add "See History" button to LendingPage
  - **Objective**: Link to history view (US4 entry point)
  - **Scope**: Button or link that navigates to history screen
  - **Files**: `src/features/lending/screens/LendingPage.tsx` (modify T017)
  - **Expected Output**: Button present; tap navigates to history
  - **Dependencies**: T017, navigation setup
  - **Validation**: Navigation works; history screen loads
  - ✅ **COMPLETED**: Header button with router.push navigation

- [X] T023 Implement active lendings list display
  - **Objective**: Show ACTIVE lendings in list format (US2 requirement)
  - **Scope**: FlatList rendering lending cards with item name, borrower, date, note
  - **Files**: `src/features/lending/screens/LendingPage.tsx` (modify T017)
  - **Expected Output**: List displays all active lendings; card shows required info
  - **Dependencies**: T014 (getActiveLendings), T017
  - **Validation**: Lendings display correctly; list updates when lendings change
  - ✅ **COMPLETED**: Styled lending card list with all required information

- [X] T024 Add empty state to LendingPage
  - **Objective**: Show message when no active lendings exist (US2 edge case)
  - **Scope**: Display "No active lendings" when list is empty
  - **Files**: `src/features/lending/screens/LendingPage.tsx` (modify T023)
  - **Expected Output**: Empty state shows when lendings array empty
  - **Dependencies**: T023
  - **Validation**: Empty state displays correctly; disappears when lendings added
  - ✅ **COMPLETED**: ListEmptyComponent with helpful empty state message

- [X] T025 Add tap handler to lending card (navigate to detail)
  - **Objective**: User taps lending to see details (entry point for US3)
  - **Scope**: Tap handler navigates to detail screen with lending ID
  - **Files**: `src/features/lending/screens/LendingPage.tsx` (modify T023)
  - **Expected Output**: Tap on card navigates to `/lending/[id]` with params
  - **Dependencies**: T023, Expo Router setup
  - **Validation**: Navigation works; detail screen receives correct lending ID
  - ✅ **COMPLETED**: Card Pressable with handleLendingTap navigation

**✅ Checkpoint 3**: Users can lend items (US1 complete); active lendings display (US2 in progress); create workflow end-to-end functional.

---

## Phase 4: UI - Lending Details & Return (US3 - Mark as Returned)

**Purpose**: Implement lending detail view and return marking  
**Duration**: ~1 day  
**Depends On**: Phase 1, 2, 3 complete  
**User Story**: US3 - Mark Item as Returned (P1)

### Tasks

- [X] T026 Create LendingDetailScreen component
  - **Objective**: Show lending details and mark-as-returned option (US3)
  - **Scope**: Fetch lending by ID; display all lending info (item, borrower, dates, note, status)
  - **Files**: `src/features/lending/screens/LendingDetailScreen.tsx` (new)
  - **Expected Output**: Screen shows lending details; fetches on mount using route params
  - **Dependencies**: T007 (getById), Expo Router route params
  - **Validation**: Component mounts; lending data fetches and displays
  - ✅ **COMPLETED**: Full component with loading, error, and data display

- [X] T027 Add item information display to detail screen
  - **Objective**: Show which item is lent (context for user)
  - **Scope**: Display item name, space, container where item belongs
  - **Files**: `src/features/lending/screens/LendingDetailScreen.tsx` (modify T026)
  - **Expected Output**: Item info displayed prominently
  - **Dependencies**: T026, existing ItemRepository lookup
  - **Validation**: Item context displays correctly; handles orphaned items (deleted items)
  - ✅ **COMPLETED**: Item section with graceful orphan handling

- [X] T028 Add lending information section to detail screen
  - **Objective**: Display borrower, lent date, note, status (US3 info needed)
  - **Scope**: Show all lending fields formatted nicely
  - **Files**: `src/features/lending/screens/LendingDetailScreen.tsx` (modify T026)
  - **Expected Output**: All lending fields visible; status badge shows ACTIVE/RETURNED
  - **Dependencies**: T026
  - **Validation**: All info displays; formatting looks good
  - ✅ **COMPLETED**: Full lending details section with formatted dates and status badge

- [X] T029 Add "Mark as Returned" button (conditional display)
  - **Objective**: Show button only when lending is ACTIVE (US3 entry point)
  - **Scope**: Button visible only if status === 'ACTIVE'; hidden if RETURNED
  - **Files**: `src/features/lending/screens/LendingDetailScreen.tsx` (modify T028)
  - **Expected Output**: Button visible for ACTIVE; not visible for RETURNED
  - **Dependencies**: T028
  - **Validation**: Button visibility matches status correctly
  - ✅ **COMPLETED**: Conditional button rendering based on isActive flag

- [X] T030 Add confirmation dialog for mark-as-returned
  - **Objective**: Confirm action before marking as returned (UX safety)
  - **Scope**: Show alert: "Mark this item as returned?"
  - **Files**: `src/features/lending/screens/LendingDetailScreen.tsx` (modify T029)
  - **Expected Output**: Dialog shows on button press; Yes/No handlers
  - **Dependencies**: T029
  - **Validation**: Dialog appears and buttons work
  - ✅ **COMPLETED**: Custom dialog overlay with Cancel/Confirm buttons

- [X] T031 Implement mark-as-returned submission
  - **Objective**: Call LendingService.markAsReturned() (US3 action)
  - **Scope**: Handle button press, show loading, call service, update state
  - **Files**: `src/features/lending/screens/LendingDetailScreen.tsx` (modify T030)
  - **Expected Output**: Calling service updates lending status to RETURNED
  - **Dependencies**: T013 (markAsReturned), T030 (dialog)
  - **Validation**: Lending marked as returned; DB updated; lending no longer in ACTIVE list
  - ✅ **COMPLETED**: Service call with submitting state, error handling, validation

- [X] T032 Add success feedback and navigation
  - **Objective**: Show success message after marking returned; navigate back (US3 completion)
  - **Scope**: Toast/alert showing success; pop screen after brief delay
  - **Files**: `src/features/lending/screens/LendingDetailScreen.tsx` (modify T031)
  - **Expected Output**: Success feedback shown; navigates back to LendingPage
  - **Dependencies**: T031
  - **Validation**: Success message appears; navigation works
  - ✅ **COMPLETED**: Alert with success message and router.back() navigation

- [X] T033 Add back navigation to detail screen
  - **Objective**: Allow user to return to lending list from detail
  - **Scope**: Back button in header that pops screen
  - **Files**: `src/features/lending/screens/LendingDetailScreen.tsx` (modify T026)
  - **Expected Output**: Back button navigates to previous screen
  - **Dependencies**: T026, Expo Router
  - **Validation**: Back navigation works
  - ✅ **COMPLETED**: Back button in header with router.back() handler

**✅ Checkpoint 4**: Users can mark items returned (US3 complete); detail workflow functional; returned lending disappears from active list.

---

## Phase 5: UI - Lending History (US4 - View History)

**Purpose**: Implement history view showing all lendings  
**Duration**: ~1 day  
**Depends On**: Phase 1, 2, 3, 4 complete  
**User Story**: US4 - View Lending History (P2)

### Tasks

- [ ] T034 Create LendingHistoryScreen component
  - **Objective**: Show all lendings (ACTIVE + RETURNED) with filtering (US4)
  - **Scope**: Component structure, fetch all lendings, display with status filter
  - **Files**: `src/features/lending/screens/LendingHistoryScreen.tsx` (new)
  - **Expected Output**: Component fetches all lendings; displays list with status visible
  - **Dependencies**: T015 (getAllLendings), Expo Router
  - **Validation**: Component mounts; data fetches; list displays

- [ ] T035 Add tabs/filter for status (ACTIVE/RETURNED/All)
  - **Objective**: Allow user to filter history by lending status (US4 user control)
  - **Scope**: Tab buttons or segmented control; filter lendings by selection
  - **Files**: `src/features/lending/screens/LendingHistoryScreen.tsx` (modify T034)
  - **Expected Output**: Filter toggles between ACTIVE/RETURNED/All; list updates
  - **Dependencies**: T034
  - **Validation**: Filtering works; correct lendings shown for each filter

- [ ] T036 Display history list with status indicators
  - **Objective**: Show all lendings with clear status display (US4 primary view)
  - **Scope**: FlatList showing lending cards with item, borrower, lent date, return date (if applicable), status badge
  - **Files**: `src/features/lending/screens/LendingHistoryScreen.tsx` (modify T034)
  - **Expected Output**: List displays all lendings; status badges clearly indicate ACTIVE vs RETURNED
  - **Dependencies**: T034, T035
  - **Validation**: All lendings displayed; status badges correct; formatting clear

- [ ] T037 Add sorting (most recent first)
  - **Objective**: Lendings sorted by date descending (US4 requirement)
  - **Scope**: Ensure list displays most recent lendings first
  - **Files**: `src/features/lending/screens/LendingHistoryScreen.tsx` (modify T036)
  - **Expected Output**: List sorted by lent_at descending
  - **Dependencies**: T036, T015 (service returns sorted)
  - **Validation**: Most recent lending appears first

- [ ] T038 Add tap handler to history list items
  - **Objective**: User can tap lending in history to see detail (US4 navigation)
  - **Scope**: Tap handler navigates to detail screen with lending ID
  - **Files**: `src/features/lending/screens/LendingHistoryScreen.tsx` (modify T036)
  - **Expected Output**: Tap on item navigates to detail screen
  - **Dependencies**: T036, Expo Router
  - **Validation**: Navigation to detail works

- [ ] T039 Add back navigation to history screen
  - **Objective**: Return to lending tab from history
  - **Scope**: Back button that pops history screen
  - **Files**: `src/features/lending/screens/LendingHistoryScreen.tsx` (modify T034)
  - **Expected Output**: Back button pops screen
  - **Dependencies**: T034, Expo Router
  - **Validation**: Back navigation works

- [ ] T040 Update LendingPage to import and wire up history navigation
  - **Objective**: Connect "See History" button to history screen (from T022)
  - **Scope**: Ensure navigation params passed correctly to history screen
  - **Files**: `src/features/lending/screens/LendingPage.tsx` (modify T022)
  - **Expected Output**: "See History" button navigates to `/lending/history`
  - **Dependencies**: T022, T034
  - **Validation**: Navigation works

**✅ Checkpoint 5**: Users can view lending history with filtering (US4 complete); all primary workflows functional.

---

## Phase 6: Polish & Integration Testing

**Purpose**: End-to-end testing and refinement  
**Duration**: ~1 day  
**Depends On**: All phases complete

### Tasks

- [ ] T041 Verify error handling: invalid borrower name
  - **Objective**: Test BR-003 enforcement (borrower name required)
  - **Scope**: Try submitting form with empty/whitespace borrower name; verify error message
  - **Files**: All (integration test - no code changes expected)
  - **Expected Output**: Error shown; lending not created; form preserved
  - **Dependencies**: T021 (form submission)
  - **Validation**: Error message clear and helpful

- [ ] T042 Verify error handling: item already lent
  - **Objective**: Test BR-001 enforcement (one active per item)
  - **Scope**: Try lending same item twice; verify second fails with correct error
  - **Files**: All (integration test)
  - **Expected Output**: Second lending attempt fails; error message clear
  - **Dependencies**: T012 (validation), T021 (submission)
  - **Validation**: Business rule enforced; user feedback correct

- [ ] T043 Verify data persistence across app restart
  - **Objective**: Test that lendings survive app close/reopen
  - **Scope**: Create lending; close app; reopen; verify lending still there
  - **Files**: All (integration test)
  - **Expected Output**: Lending persists in SQLite; appears after restart
  - **Dependencies**: T003 (migration), T009 (create)
  - **Validation**: Data persists correctly

- [ ] T044 Verify mark-as-returned workflow end-to-end
  - **Objective**: Test complete return marking workflow
  - **Scope**: Create lending → go to detail → mark returned → verify gone from active, in history
  - **Files**: All (integration test)
  - **Expected Output**: Lending status changes; appears in history; gone from active
  - **Dependencies**: T031 (mark returned), T015 (history fetch)
  - **Validation**: Workflow smooth; data consistent

- [ ] T045 Verify navigation flows
  - **Objective**: Test all screen transitions
  - **Scope**: Test: LendingPage → item selection → form → list; LendingPage → detail → back; LendingPage → history → detail → back
  - **Files**: All navigation (integration test)
  - **Expected Output**: All transitions work smoothly; params pass correctly
  - **Dependencies**: T025, T033, T038, T039
  - **Validation**: No navigation errors; screens load correctly

- [ ] T046 Verify empty states
  - **Objective**: Test edge case: no lendings exist
  - **Scope**: Start fresh; verify empty state in main tab; create lending; verify disappears
  - **Files**: T024 (empty state component)
  - **Expected Output**: Empty state shows initially; disappears when lendings added
  - **Dependencies**: T024
  - **Validation**: Empty state UX smooth

- [ ] T047 Test pulled-to-refresh (optional enhancement)
  - **Objective**: Verify manual refresh works
  - **Scope**: On LendingPage, pull down to refresh; verify list updates
  - **Files**: `src/features/lending/screens/LendingPage.tsx` (if implemented)
  - **Expected Output**: Pull-to-refresh works; list reloads
  - **Dependencies**: T023 (list component)
  - **Validation**: Manual refresh functional (optional for MVP)

- [ ] T048 Verify item details and orphaned item handling
  - **Objective**: Test edge case: display lending when item is deleted
  - **Scope**: Create lending → delete item → view lending/history; verify no crashes
  - **Files**: T027 (item display with orphan handling)
  - **Expected Output**: Lending still displays; item shown as deleted/missing
  - **Dependencies**: T027
  - **Validation**: No crashes; graceful handling

- [ ] T049 Verify all error messages are user-friendly
  - **Objective**: Test that all error messages are clear and helpful
  - **Scope**: Trigger each error condition; verify message is clear
  - **Files**: T012-T016 (service validation), T020-T021 (form validation)
  - **Expected Output**: All error messages are user-friendly (not technical)
  - **Dependencies**: All service/form tasks
  - **Validation**: Error messages tested and approved

- [ ] T050 Verify success feedback visibility
  - **Objective**: Test that user gets clear feedback on success
  - **Scope**: Create lending → verify success message shows; mark returned → verify success shows
  - **Files**: T021 (create), T032 (mark returned)
  - **Expected Output**: Success messages clear and visible
  - **Dependencies**: T021, T032
  - **Validation**: Success feedback UX smooth

**✅ Checkpoint 6**: Feature complete and tested. All user stories implemented. Ready for demo/review.

---

## Task Summary by User Story

### US1: Lend an Item (P1) - Priority 1
- T017: LendingPage component (list view setup)
- T018: "Lend Item" button
- T019: Item selection modal
- T020: Form (borrower + note)
- T021: Form submission + create lending
- T041-T042: Error handling tests
- **Status**: Complete after Phase 3

### US2: View Active Lendings (P1) - Priority 1
- T023: Active lendings list display
- T024: Empty state
- T025: Tap to detail navigation
- T046: Empty state edge case
- **Status**: Complete after Phase 3

### US3: Mark Item as Returned (P1) - Priority 1
- T026-T033: Detail screen + mark-as-returned workflow
- T044: End-to-end workflow test
- **Status**: Complete after Phase 4

### US4: View Lending History (P2) - Priority 2
- T034-T040: History screen + filtering + navigation
- **Status**: Complete after Phase 5

---

## Dependency Graph

```
Phase 1 (Foundation)
├── T001 (Lending type)
├── T002-T003 (Migration)
├── T004-T010 (Repository methods)
↓
Phase 2 (Service)
├── T011 (Service skeleton)
├── T012-T016 (Service methods)
↓
Phase 3 (UI - Create/View)
├── T017-T025 (LendingPage + form)
↓
Phase 4 (UI - Detail/Return)
├── T026-T033 (LendingDetailScreen)
↓
Phase 5 (UI - History)
├── T034-T040 (LendingHistoryScreen)
↓
Phase 6 (Testing)
├── T041-T050 (Integration tests)
```

---

## Task Dependencies Matrix

| Task | Depends On | Unblocks |
|------|-----------|----------|
| T001 | None | T002, T004, T011 |
| T002 | T001 | T003, T004 |
| T003 | T002 | App startup |
| T004 | T001 | T005-T010 |
| T005-T010 | T002, T004 | T011-T016 |
| T011 | T001, T004 | T012-T016 |
| T012-T016 | T011, T005-T010 | T017-T040 |
| T017-T025 | T012-T016 | T031, T034 |
| T026-T033 | T012-T016 | T044 |
| T034-T040 | T012-T016 | T045 |
| T041-T050 | All previous | Demo ready |

---

## Parallel Execution Opportunities

**During Phase 1** (can run in parallel after T002):
- T005, T006, T007, T008, T009, T010 (all repository methods)

**During Phase 2** (can run in parallel after T011):
- T014, T015, T016 (query/helper methods)

**During Phase 3**:
- Most tasks sequential (form flow dependencies), but T022 (See History button) could start early

**General**: UI screens (T017, T026, T034) could have some parallel work if multiple developers, but they have service dependencies.

---

## Success Criteria: Feature Complete

✅ **Functional**:
- User can create lending (US1)
- User can view active lendings (US2)
- User can mark as returned (US3)
- User can view history (US4)
- One active lending per item enforced
- Data persists across app restart

✅ **Architectural**:
- Layered: UI → Service → Repository → SQLite
- All business logic in Service
- All DB queries in Repository
- TypeScript fully typed

✅ **UX**:
- Clear error messages
- Success feedback
- Navigation works smoothly
- Empty states handled
- Orphaned items gracefully handled

---

## Next Steps

1. **Review this task list** - Approve sequencing and scope
2. **Begin Phase 1** - Start with T001 (Lending model)
3. **Track progress** - Mark tasks complete as you go
4. **Checkpoints** - Validate each phase before proceeding
5. **Adapt as needed** - If tasks need adjustment, update this list

---

*Tasks ready for implementation. Begin with Phase 1 (T001-T003)*
