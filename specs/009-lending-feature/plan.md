# Implementation Plan: Lending Tracker

**Feature Branch**: `009-lending-feature`  
**Plan Created**: May 6, 2026  
**Specification**: [spec.md](./spec.md)  
**Status**: Ready for Task Generation

---

## 1. Recommended Feature Architecture

### Architecture Approach: Clean Layered with Vertical Slices

The lending feature follows Synop's established pattern: **UI → Service → Repository → SQLite**

**Key Design Decisions**:

1. **Separate Lending Domain**: Create dedicated lending services and repository to isolate lending logic from item/space management
2. **Item Reference Pattern**: Lendings reference items by `item_id` (no denormalization), enabling item deletion without requiring lending deletion
3. **Status-Based Queries**: Repository methods query by status (ACTIVE/RETURNED) to support the two primary user views
4. **Simple Error Handling**: Service layer validates business rules (e.g., one active lending per item) and throws meaningful errors to UI
5. **No State Management Library**: Use React hooks for local component state; services are stateless and called on demand

### Separation of Concerns

- **LendingService**: Handles lending creation, return marking, validation rules
- **LendingRepository**: Executes all lending-related database queries
- **LendingPage**: Renders active lendings tab with item selection flow
- **LendingDetailScreen**: Shows lending details and mark-as-returned action
- **LendingHistoryScreen**: Displays all lendings (active and returned)

---

## 2. Folder Structure

### New Feature Directory

```
src/features/lending/
├── screens/
│   ├── LendingPage.tsx              # Primary active lendings list + "Lend Item" flow
│   ├── LendingDetailScreen.tsx      # Individual lending details + mark returned
│   └── LendingHistoryScreen.tsx     # Complete history (ACTIVE + RETURNED)
├── services/
│   └── LendingService.ts            # Business logic: create, return, validate
├── repositories/
│   └── LendingRepository.ts         # Database queries: getActive, getAll, create, return
└── models/
    └── Lending.ts                   # TypeScript interfaces & types
```

### Database Location

```
src/db/
└── (add migration for lendings table to migrations.ts)
```

### Integration Points

- **LendingPage** imported in: `app/(tabs)/lending.tsx` (already a thin wrapper)
- **Item selection** integrates with existing: `ItemRepository.getAllItems()` or filtered by space
- **Navigation** uses existing Expo Router: detail screen at `/lending/[id]` or modal

---

## 3. Data Flow

### Primary Flows

#### Flow 1: Create Lending
```
User taps "Lend Item"
  ↓
Item Selection Screen (show user's items from all spaces)
  ↓
Form: Enter Borrower Name + Optional Note
  ↓
LendingService.createLending(itemId, borrowerName, note)
  ├→ Validate: borrowerName not empty
  ├→ Validate: itemId exists
  ├→ Query: Check no ACTIVE lending exists for this item
  ├→ LendingRepository.create() → INSERT into lendings table
  ↓
Success Toast + Refresh List
```

#### Flow 2: View Active Lendings
```
User navigates to Lending tab
  ↓
LendingPage mounted
  ↓
useFocusEffect → LendingService.getActiveLendings()
  ├→ LendingRepository.getByStatus('ACTIVE') → SELECT from lendings WHERE status='ACTIVE'
  ├→ Fetch item details for each lending (join or separate queries)
  ↓
Display in list with: Item name, Borrower, Lent Date, Note
  ↓
User taps item → Navigate to detail screen
```

#### Flow 3: Mark as Returned
```
User in Lending Detail Screen
  ↓
User taps "Mark as Returned"
  ↓
LendingService.markAsReturned(lendingId)
  ├→ LendingRepository.update(lendingId, { status: 'RETURNED', returned_at: now() })
  ↓
Success feedback + Navigate back to list
  ↓
Returned lending no longer in ACTIVE list
```

#### Flow 4: View History
```
User in Lending tab, accesses History view
  ↓
LendingService.getAllLendings()
  ├→ LendingRepository.getAll() → SELECT * FROM lendings (all status values)
  ├→ Fetch item details for each lending
  ↓
Display both ACTIVE and RETURNED, sorted by lent_at DESC
  ↓
Show status clearly: "Active" vs "Returned (date)"
```

---

## 4. SQLite Planning

### Table Schema (High-Level Design)

**Table: `lendings`**
- Primary Key: `id` (TEXT UUID)
- Foreign Key: `item_id` (TEXT UUID, references items.id)
- Columns: `borrower_name`, `note`, `lent_at`, `returned_at`, `status`, `created_at`, `updated_at`
- Indexes: 
  - `(item_id, status)` for "one active per item" validation
  - `(status, lent_at DESC)` for listing by status and date

### Migration Strategy

- Create migration file: `src/db/migrations/003-create-lendings-table.ts` (or appropriate version)
- Migration should:
  - Create `lendings` table with proper types
  - Create indexes for query optimization
  - Run once on app startup
  - Be idempotent (handle re-runs safely)

### Query Patterns

1. **Check for active lending on item**: `SELECT * FROM lendings WHERE item_id=? AND status='ACTIVE'`
2. **Get all active lendings**: `SELECT * FROM lendings WHERE status='ACTIVE' ORDER BY lent_at DESC`
3. **Get all lendings (history)**: `SELECT * FROM lendings ORDER BY lent_at DESC`
4. **Get lending detail**: `SELECT * FROM lendings WHERE id=?`
5. **Mark as returned**: `UPDATE lendings SET status='RETURNED', returned_at=?, updated_at=? WHERE id=?`

### Data Integrity Considerations

- **Item Deletion**: Lendings table has `item_id` foreign key. Option:
  - **Cascade**: Delete lendings when item deleted (loses history)
  - **No Cascade**: Lendings remain, item_id becomes orphaned (preserves history)
  - **Recommended for MVP**: No cascade. Query by item details or store borrower context at time of lending.

---

## 5. Repository Responsibilities

### LendingRepository Methods

**Query Methods** (Read-only, never modify data):
- `getByStatus(status: 'ACTIVE' | 'RETURNED'): Lending[]` - All lendings with given status
- `getAll(): Lending[]` - All lendings sorted by date
- `getById(id: string): Lending | null` - Single lending detail
- `getByItemId(itemId: string): Lending | null` - Check if item has active lending
- `hasActiveLending(itemId: string): boolean` - Quick existence check

**Mutation Methods** (Create/Update):
- `create(lending: LendingCreateInput): Lending` - Insert new lending with ACTIVE status
- `markAsReturned(id: string, returnedAt: Date): Lending` - Update status and timestamp
- `update(id: string, updates: Partial<Lending>): Lending` - General update (if needed)

**Database Operations**:
- All methods use parameterized queries (prevent SQL injection)
- All methods handle database errors and throw meaningful messages
- Timestamps are managed in repository (not by service or UI)
- Results mapped to TypeScript `Lending` type

**No Business Logic in Repository**:
- Repository doesn't validate "one active per item" (that's Service responsibility)
- Repository doesn't check if item exists (Service does)
- Repository doesn't format data (that's UI responsibility)

---

## 6. Service Responsibilities

### LendingService Methods

**Business Logic & Validation**:
- `createLending(itemId: string, borrowerName: string, note?: string): Lending`
  - Validate: borrowerName not empty/whitespace
  - Validate: itemId exists (query ItemRepository)
  - Validate: No ACTIVE lending exists for this item (query LendingRepository)
  - Call: LendingRepository.create()
  - Throw: ServiceError with user-friendly message on validation failure

- `markAsReturned(lendingId: string): Lending`
  - Validate: lending exists
  - Validate: lending is ACTIVE (can't return twice)
  - Call: LendingRepository.markAsReturned()
  - Return: Updated lending

- `getActiveLendings(): Lending[]`
  - Call: LendingRepository.getByStatus('ACTIVE')
  - Return: List with items sorted by date descending

- `getAllLendings(): Lending[]`
  - Call: LendingRepository.getAll()
  - Return: List with items sorted by date descending

- `canLendItem(itemId: string): boolean`
  - Helper: Check if item can be lent (not already active)
  - Used by UI for enabling/disabling "Lend" button

**Service Patterns**:
- Constructor initializes with `ItemRepository` and `LendingRepository` (dependency injection)
- All errors thrown are `ServiceError` with `code` and `message` properties
- Timestamps always created in repository using `new Date()` (repository owns time)
- No React hooks in service (services are pure functions)

---

## 7. UI Screen Planning

### Screen 1: LendingPage (Active Lendings List + Create Flow)

**Layout**:
1. Header: "Lending" title
2. "Lend Item" button (primary action)
3. Empty state (if no active lendings): "No active lendings"
4. List of active lendings (if exist):
   - Each item shows: [Item Icon] Item Name, Borrower Name, Lent Date
   - Optional: Small note preview
   - Tap to navigate to detail

**State Management**:
- `lendings: Lending[]` - Loaded on focus
- `loading: boolean` - While fetching
- `error: string | null` - If query fails

**User Interactions**:
- Tap "Lend Item" → Show item selection screen / modal
- Tap lending card → Navigate to detail screen
- Pull-to-refresh (optional but nice)
- Tap "See History" → Navigate to history screen

**Item Selection Flow** (Modal or Screen):
1. List of all items across all spaces
2. Show: Item name, Space name, Container name (context)
3. Search/filter items by name (optional for MVP)
4. Tap item → Form appears

**Lending Form**:
1. Selected item shown (not editable)
2. Input: Borrower Name (required, placeholder)
3. Input: Note (optional textarea, smaller)
4. Buttons: "Lend" (primary) and "Cancel"
5. Validation: Show inline error if borrower empty
6. Submitting state: Disable button, show spinner

**Success Feedback**:
- Toast message: "Item lent to [Borrower]"
- Form resets
- New lending appears in list

**Error Handling**:
- Item already has active lending: Show alert "This item is already lent out. Return it first before lending to someone else."
- Invalid borrower: Show inline validation "Borrower name required"
- Network/DB error (unlikely offline): Show alert with retry option

### Screen 2: LendingDetailScreen (Individual Lending + Mark Returned)

**Layout**:
1. Header: Back button + "Lending Details"
2. Item information:
   - Item name (large, prominent)
   - Space and Container where item lives
3. Lending information:
   - Borrower name (prominent)
   - Lent date
   - Note (if exists)
   - Status badge: "ACTIVE" (green) or "RETURNED"
4. If ACTIVE:
   - "Mark as Returned" button (primary, red/accent color)
5. If RETURNED:
   - Returned date displayed
   - Button disabled or hidden

**State Management**:
- `lending: Lending | null` - Fetched on mount
- `loading: boolean`
- `error: string | null`
- `marking: boolean` - While submitting mark-as-returned

**User Interactions**:
- Tap "Mark as Returned" → Confirm dialog (optional but recommended)
- Dialog confirms: "Mark this item as returned?"
- Tap "Yes" → Update in DB, show success, navigate back
- Tap "Cancel" → Close dialog

**Navigation**:
- Can be reached from: Lending list (tap item) or History
- Back navigation: Return to previous screen

### Screen 3: LendingHistoryScreen (All Lendings)

**Layout**:
1. Header: "Lending History"
2. Two tabs or filter buttons:
   - "Active" - ACTIVE lendings only
   - "Returned" - RETURNED lendings only
   - (Alternative: Single list with status badges)
3. List of lendings:
   - Item name
   - Borrower name
   - Lent date
   - Return date (if RETURNED)
   - Status badge

**State Management**:
- `lendings: Lending[]` - All lendings
- `filter: 'active' | 'returned' | 'all'` - Current view
- `loading: boolean`

**User Interactions**:
- Tap tab/filter to show only that status
- Tap lending → Navigate to detail screen
- Sorted: Most recent first

---

## 8. Navigation Flow

### Routing Structure

**Existing Tab-Based Navigation**:
```
app/(tabs)/lending.tsx → LendingPage (already set up as thin wrapper)
```

**New Screen Hierarchy**:
```
/ (home)
├── (tabs)
│   └── lending (LendingPage - main tab)
├── lending/
│   ├── [id] (LendingDetailScreen - individual lending)
│   └── history (LendingHistoryScreen - all lendings)
└── lending-create/ (optional: separate create flow or modal)
```

**Navigation Recommendations**:

1. **From LendingPage**:
   - "Lend Item" → Item Selection Modal (not a full screen for simplicity)
   - Item Selected → Lending Form (same modal or inline)
   - Tap lending → `/lending/[id]` (push)
   - "See History" → `/lending/history` (push)

2. **From LendingDetailScreen**:
   - Back button → Pop to LendingPage
   - "Mark as Returned" → Update, Pop with refresh

3. **From LendingHistoryScreen**:
   - Tap lending → `/lending/[id]` (push)
   - Back → Pop to LendingPage

**Modal vs. Screen Decisions**:
- Item Selection: **Modal** (temporary, returns to Lending tab after)
- Lending Form: **Inline in modal** (quick create workflow)
- Lending Detail: **Screen** (full page, can navigate back)
- History: **Screen** (full view, more content)

---

## 9. State & Data Synchronization Approach

### Component-Level State

**LendingPage Component**:
- Local state: `lendings`, `loading`, `error`
- Hook: `useFocusEffect` to reload on tab focus
- Hook: `useCallback` to memoize handlers

**LendingDetailScreen Component**:
- Local state: `lending`, `loading`, `marking`, `error`
- Hook: `useEffect` to fetch on mount (or from route params)
- Navigation params: Pass lending ID to screen

**LendingHistoryScreen Component**:
- Local state: `lendings`, `filter`, `loading`
- Hook: `useFocusEffect` for data freshness

### Data Refresh Triggers

1. **Tab Focus**: Reload active lendings when Lending tab comes into focus
   - `useFocusEffect` in LendingPage
   - `useCallback` with no dependencies

2. **After Create**: Automatically refresh list after creating lending
   - Close modal/form
   - Reload list in LendingPage

3. **After Mark Returned**: Navigate back with refresh
   - Mark as returned
   - Pop screen
   - List refreshes on focus (handled by useFocusEffect)

4. **Manual Refresh**: Pull-to-refresh on list (optional)
   - `refreshControl` on FlatList
   - Calls same fetch function

### No Global State Manager Needed

- **Why not Redux/Zustand?** MVP scope is small. One tab with 2-3 screens.
- **Why local state is sufficient?** Services are stateless; each component loads fresh data on mount/focus.
- **When to add state manager?** If feature grows to 5+ screens or complex cross-component data sharing.

---

## 10. Business Rule Enforcement Strategy

### BR-001: One Active Lending Per Item

**Enforcement Points**:

1. **Repository Level** (Database Constraint):
   - Index: `(item_id, status)` to efficiently query for active lendings
   - Not a unique constraint (allows multiple RETURNED for same item)

2. **Service Level** (Business Logic):
   - `LendingService.createLending()` queries repository to check for active
   - If active exists: throw `ServiceError('Item already has active lending')`
   - **Location**: Service layer before calling repository.create()

3. **UI Level** (User Feedback):
   - Disable "Lend" button if item already has active lending
   - Show error message if user somehow bypasses (defensive coding)

### BR-002: Records Immutable Except Return

**Enforcement Points**:

1. **UI Level**:
   - Edit button only shows if status is ACTIVE
   - For RETURNED lendings: Show details only, no edit/delete options

2. **Service Level**:
   - `markAsReturned()` only accepts status, lent_at, borrower_name as read-only
   - No method to edit borrower name or delete lending
   - Only `markAsReturned()` method allows status change

3. **Repository Level**:
   - Only `markAsReturned()` performs UPDATE
   - No generic `update()` method exposed (or restricted)

### BR-003: Borrower Name Required

**Enforcement Points**:

1. **UI Level**:
   - Form has required validation
   - Input marked as required
   - Button disabled until filled
   - Inline error message: "Borrower name required"

2. **Service Level**:
   - `createLending()` validates: `!borrowerName || borrowerName.trim() === ''`
   - Throws error if empty
   - Trimmed before storing

3. **Repository Level**:
   - Column definition: `NOT NULL`
   - Database rejects NULL values (fail-safe)

### BR-004: Atomic Status + Timestamp Update

**Enforcement Points**:

1. **Repository Level**:
   - Single SQL UPDATE statement updates both fields
   - No separate queries for status and returned_at
   - Timestamp created in repository (single source of truth)

2. **Service Level**:
   - `markAsReturned()` receives lending ID only
   - Repository generates timestamp internally
   - Service receives back updated lending with both fields set

### BR-005: Preserve Lending History on Item Delete

**Enforcement Points**:

1. **Database Level**:
   - Lendings table has NO CASCADE DELETE on item_id FK
   - Item deletion doesn't cascade to lendings
   - Orphaned lending records remain with item_id pointing to deleted item

2. **UI Level**:
   - If item is deleted, show item name from lending record, not live item lookup
   - Display: "Item (deleted) - Borrower Name - Date"

3. **Repository Level**:
   - When fetching lendings, handle case where item_id may reference deleted item
   - Fetch item separately; if null, use stored item context (or name from lending)

---

## 11. MVP UX Approach

### Simplification Principles

**What to Keep Simple**:

1. **Item Selection**:
   - Simple flat list of all items
   - No nested space/container hierarchy in selection view
   - Search optional (can add later)

2. **Form Validation**:
   - Only borrower name required
   - No client-side date pickers or special formatting
   - Note is simple textarea (no markdown, no rich text)

3. **List Display**:
   - Card or row format, not fancy UI
   - Show only essential info: item, borrower, date
   - No swipe actions (use tap → detail → action pattern)

4. **Transitions**:
   - No animations between screens
   - No progress bars or loading skeletons
   - Simple loading spinner during fetch

5. **Error Handling**:
   - Alert dialogs for errors (not inline toasts everywhere)
   - User-friendly messages, not technical errors
   - Simple retry pattern

**What to Avoid in MVP**:

- Gestures (swipe to mark returned)
- Drag-and-drop for item selection
- Calendar date picker for lending date (use now() only)
- Animations or transitions
- Borrower autocomplete
- Search/filter on history
- Bulk operations
- Export/sharing lending records
- Analytics or stats
- Reminders or notifications

### UX Pattern: Focus on Core Workflows

**Lend Item Workflow**:
1. Tap "Lend Item"
2. Select item (single screen, flat list)
3. Enter borrower name + note
4. Submit
5. Success message + back to list

**Mark Returned Workflow**:
1. From active lending, tap item
2. See details
3. Tap "Mark as Returned"
4. Confirm dialog
5. Success + back to list

**View History Workflow**:
1. Tap "See History" or tab
2. See all lendings with status
3. Tap to see details
4. Back to history

---

## 12. Suggested Implementation Phases

### Phase 1: Core Data Layer (Days 1-2)

**Deliverables**:
- Lending TypeScript model/interface
- Database migration (create lendings table)
- LendingRepository with basic CRUD methods

**Criteria for Completion**:
- All repository methods implemented and callable
- Database properly initialized
- No UI yet (backend only)

### Phase 2: Service Layer (Day 2)

**Deliverables**:
- LendingService with business logic
- Validation methods
- Error handling

**Criteria for Completion**:
- All business rules enforced at service layer
- Can create, mark returned, fetch lendings
- Comprehensive error messages

### Phase 3: UI - Active Lendings List (Day 3)

**Deliverables**:
- LendingPage component showing active lendings
- Item selection modal/screen
- Lending form
- Success feedback

**Criteria for Completion**:
- User can create a lending from UI
- Active lendings display
- Create workflow end-to-end functional

### Phase 4: UI - Detail & Return (Day 3)

**Deliverables**:
- LendingDetailScreen component
- Mark as returned functionality
- Navigation between screens

**Criteria for Completion**:
- User can view lending details
- User can mark item returned
- Detail workflow functional

### Phase 5: UI - History View (Day 4)

**Deliverables**:
- LendingHistoryScreen component
- Filter/tab for ACTIVE vs RETURNED
- Navigation from history to detail

**Criteria for Completion**:
- User can view all lendings
- Can filter by status
- Complete history workflow

### Phase 6: Polish & Testing (Day 4)

**Deliverables**:
- Error messages tested
- Edge case handling
- Navigation flows verified
- Data persistence verified across app restart

**Criteria for Completion**:
- Feature complete and tested
- Ready for demo/review

---

## 13. Risk Areas & Simplification Recommendations

### Risks & Mitigations

#### Risk 1: Item Deletion Breaks Lending References

**Problem**: If a user deletes an item that has active lendings, what happens?

**Mitigation Strategy**:
- **Decision**: No CASCADE DELETE. Lendings remain orphaned.
- **UI Handling**: When displaying lending, fetch item by ID; if item deleted, use fallback display ("Item no longer exists - Borrower: X")
- **Alternative**: Store item name in lending record at creation time (denormalization) to preserve history without item lookup

**Recommended**: Option 1 (orphaned) is simpler for MVP. Rare use case.

#### Risk 2: "One Active Per Item" Check Race Condition

**Problem**: User creates two lendings for same item simultaneously in two tabs?

**Mitigation Strategy**:
- **Database Level**: Add unique index on `(item_id, status)` where status='ACTIVE' to enforce at DB layer
- **Service Level**: Check before insert; if still fails at DB, catch constraint violation and retry with proper error
- **UI Level**: Disable button during submission; prevent rapid clicks

**Recommended**: Simple check in service + unique index as fail-safe.

#### Risk 3: Timestamp Consistency

**Problem**: If created_at, updated_at, lent_at managed differently, timestamps might be inconsistent?

**Mitigation Strategy**:
- **Rule**: Repository owns all timestamp generation
- **Implementation**: Repository generates `lent_at` and `created_at` on insert; `updated_at` and `returned_at` on return
- **No UI Timestamps**: UI never creates or modifies timestamps

**Recommended**: Repository as single source of truth for all dates.

#### Risk 4: Complex Item Selection UI

**Problem**: If item selection is too nested (spaces → containers → items), UX is poor?

**Mitigation Strategy**:
- **Decision**: Flatten for MVP. Show all items in one list with context (space/container name).
- **Enhancement**: Add search filter later if list gets long
- **Alternative**: Sort by recently used or most valuable items

**Recommended**: Flat list for MVP.

#### Risk 5: History List Performance

**Problem**: If user has 100+ lendings, querying all might be slow?

**Mitigation Strategy**:
- **Database**: Index on status and lent_at for fast queries
- **UI**: Implement pagination or lazy loading if list grows (P2)
- **MVP**: Fetch all, sort in memory (simple, fine for 100 records)

**Recommended**: Simple fetch-all for MVP. Add pagination if needed.

### Simplification Recommendations

| Area | Recommendation | Why |
|------|---|---|
| **Item Selection** | Flat list, not hierarchical | Simpler UX, 90% use case |
| **Borrower ID** | Name only, no contact picker | MVP assumes informal relationships |
| **Form Validation** | Inline error, not separate validator | Keep service layer simple |
| **Timestamps** | Device local time, no sync | Offline-first, no servers |
| **Error Handling** | Alert dialogs, not toast queue | Simple and clear |
| **Navigation** | Tab-based primary, modal secondary | Matches existing app pattern |
| **History** | Simple list with status badge | No complex filtering |
| **Returned Item** | Can't edit lending | Immutable by design, no edit logic needed |
| **Bulk Operations** | Not in MVP | Single item workflows simpler |
| **Reminders** | Not in MVP | Background jobs add complexity |

---

## Implementation Checklist (Reference)

**Backend (Repository/Service)**:
- [ ] Lending TypeScript interface
- [ ] Database migration
- [ ] LendingRepository methods
- [ ] LendingService with validation

**Frontend (UI)**:
- [ ] LendingPage (active list + create flow)
- [ ] LendingDetailScreen (detail + mark returned)
- [ ] LendingHistoryScreen (all lendings with filter)
- [ ] Item selection flow (modal or screen)

**Integration**:
- [ ] Navigation between screens
- [ ] Data refresh on focus
- [ ] Error handling in UI
- [ ] Success feedback (toast/alert)

**Testing & Polish**:
- [ ] Manual testing of workflows
- [ ] Data persistence across restart
- [ ] Edge case handling
- [ ] Error messages clarity

---

## Next Steps

1. **Task Generation**: Run `/speckit.tasks` to generate dependency-ordered task list
2. **Branch**: Already on `009-lending-feature` branch
3. **Implementation**: Begin Phase 1 (data layer) after task approval
4. **Progress Tracking**: Use task list to track completion

---

*Plan approved for task generation and implementation.*
