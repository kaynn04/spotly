# Outside Checklist Implementation Plan

**Feature:** 010 - Outside Checklist  
**Version:** 1.0  
**Status:** MVP Implementation Plan  
**Last Updated:** May 6, 2026

---

## 1. Recommended Feature Architecture

### Architecture Diagram
```
┌─────────────────────────────────────────────────────┐
│                  UI Layer (React Native)             │
│  (Outside Screens, Session Detail, Item Picker)     │
└────────────────────────┬────────────────────────────┘
                         │ useCallback/useMemo
                         ↓
┌─────────────────────────────────────────────────────┐
│              Service Layer (Business Logic)          │
│   OutsideService (session mgmt, state validation)   │
└────────────────────────┬────────────────────────────┘
                         │ Dependency Injection
                         ↓
┌─────────────────────────────────────────────────────┐
│            Repository Layer (Data Access)            │
│  OutsideSessionRepository                           │
│  OutsideSessionItemRepository                       │
│  ItemRepository (readonly, for item context)        │
└────────────────────────┬────────────────────────────┘
                         │ Parameterized Queries
                         ↓
┌─────────────────────────────────────────────────────┐
│         SQLite (expo-sqlite via useSQLiteContext)   │
│  outside_sessions | outside_session_items | items  │
└─────────────────────────────────────────────────────┘
```

### Key Principles
- **Strict Separation**: UI never touches Repository or DB directly
- **Service as Gatekeeper**: All business logic (one active session, validation) in Service
- **Repository as Accessor**: Pure data access layer, no business rules
- **Type Safety**: Full TypeScript, discriminated unions for states
- **Memoization**: Services created once with useMemo([]) to prevent re-creation on render
- **No Cross-Feature Contamination**: Outside doesn't import Lending or Spaces services

---

## 2. Folder Structure

```
app/
├── src/
│   ├── features/
│   │   ├── outside/                          # NEW feature folder
│   │   │   ├── models/
│   │   │   │   └── OutsideSession.ts         # Domain types
│   │   │   ├── repositories/
│   │   │   │   ├── OutsideSessionRepository.ts
│   │   │   │   └── OutsideSessionItemRepository.ts
│   │   │   ├── services/
│   │   │   │   └── OutsideService.ts         # Business logic
│   │   │   ├── screens/
│   │   │   │   ├── OutsidePage.tsx           # Main tab screen (empty/active session)
│   │   │   │   ├── SessionDetailScreen.tsx   # Active session detail + items list
│   │   │   │   ├── SessionHistoryScreen.tsx  # Completed sessions
│   │   │   │   └── components/
│   │   │   │       ├── SessionForm.tsx       # Create session modal
│   │   │   │       ├── ItemPickerModal.tsx   # Add items modal
│   │   │   │       └── SessionCard.tsx       # Reusable session display
│   │   │   └── hooks/
│   │   │       └── useOutsideSession.ts      # Custom hook for session state
│   │   ├── lending/                          # Existing feature (unchanged)
│   │   ├── dashboard/                        # Existing feature (unchanged)
│   │   └── ...
│   ├── db/
│   │   ├── migrations/
│   │   │   ├── 001-*.ts
│   │   │   └── 004-create-outside-tables.ts  # NEW migration
│   │   ├── client.ts
│   │   └── migrations.ts
│   ├── repositories/
│   │   ├── ItemRepository.ts                 # Existing (extended with query methods)
│   │   ├── ContainerRepository.ts            # Existing (readonly for context)
│   │   └── SpaceRepository.ts                # Existing (readonly for context)
│   └── utils/
│       └── uuid.ts                           # Existing
├── app/
│   └── (tabs)/
│       ├── outside.tsx                       # Route handler → OutsidePage
│       ├── outside/
│       │   ├── session/
│       │   │   └── [id].tsx                  # Detail route → SessionDetailScreen
│       │   └── history.tsx                   # History route → SessionHistoryScreen
│       └── _layout.tsx                       # Existing tab layout
└── specs/
    └── 010-outside-feature/
        ├── spec.md                           # Finalized spec (complete)
        ├── plan.md                           # THIS DOCUMENT
        ├── tasks.md                          # Implementation tasks (generated)
        └── checklists/
            └── requirements.md               # QA checklist
```

---

## 3. Data Flow

### State Flow Diagram
```
OutsidePage (empty state)
    ↓ [Create Session]
SessionDetailScreen (ACTIVE session)
    ├─ [Add Items]
    │  └─ ItemPickerModal
    │     ├─ [Select items]
    │     └─ [Add to session] → Service → Repository → DB
    ├─ [Check/Uncheck item]
    │  └─ Service validates → Repository updates → UI refreshes
    ├─ [Remove item]
    │  └─ Service validates → Repository deletes → UI refreshes
    └─ [Complete Session]
       └─ Service validates (one active check) → Repository updates status → OutsidePage or SessionHistoryScreen

SessionHistoryScreen
    ├─ [View completed session]
    │  └─ SessionDetailScreen (readonly state)
    └─ [Delete session]
       └─ Service validates → Repository deletes cascade
```

### Data Fetch Pattern
```
Screen Focus (useFocusEffect)
    ↓
    Service.getActiveSession()
    ├─ if found: load session + items with counts
    └─ if not found: show empty state
    
ItemPickerModal Open
    ↓
    Service.getAllAvailableItems()
    ├─ Get all items from Spaces/Containers
    ├─ Filter out items already in session (no duplicates)
    └─ Show with space/container context
```

### Check Toggle Flow
```
User taps item in list
    ↓
onItemCheckToggle(itemId, currentCheckedState)
    ↓
Service.toggleSessionItemCheck(sessionId, itemId, !currentCheckedState)
    ├─ Validates session exists and is ACTIVE
    ├─ Validates item exists in session
    └─ Updates is_checked in DB + sets checked_at if true
    ↓
UI updates locally (optimistic)
    ├─ Toggle visual state immediately
    └─ Update checked count
```

---

## 4. SQLite Planning

### New Tables Required

#### Table: outside_sessions
```
Columns:
- id (TEXT PRIMARY KEY)              -- UUID
- title (TEXT NOT NULL)              -- 1-100 chars
- status (TEXT NOT NULL)             -- ENUM: 'ACTIVE' | 'COMPLETED'
- created_at (TEXT NOT NULL)         -- ISO 8601
- completed_at (TEXT)                -- ISO 8601, nullable
- updated_at (TEXT NOT NULL)         -- ISO 8601

Constraints:
- CHECK(status IN ('ACTIVE', 'COMPLETED'))
- CHECK(length(title) >= 1 AND length(title) <= 100)
- UNIQUE INDEX idx_outside_active_session ON outside_sessions(status) WHERE status = 'ACTIVE'

Purpose: Track outside sessions and their lifecycle
```

#### Table: outside_session_items
```
Columns:
- id (TEXT PRIMARY KEY)              -- UUID
- session_id (TEXT NOT NULL)         -- FK to outside_sessions
- item_id (TEXT NOT NULL)            -- FK to items
- is_checked (BOOLEAN NOT NULL)      -- 0 or 1
- checked_at (TEXT)                  -- ISO 8601, nullable
- created_at (TEXT NOT NULL)         -- ISO 8601

Constraints:
- FOREIGN KEY(session_id) REFERENCES outside_sessions(id) ON DELETE CASCADE
- FOREIGN KEY(item_id) REFERENCES items(id) ON DELETE CASCADE
- UNIQUE(session_id, item_id)        -- Prevent duplicate items in session
- CHECK(checked_at IS NULL OR is_checked = 1)

Purpose: Join table linking items to sessions with check state
```

### Indexes for Performance
```
CREATE INDEX idx_outside_session_items_session 
  ON outside_session_items(session_id);

CREATE INDEX idx_outside_session_items_item 
  ON outside_session_items(item_id);

CREATE INDEX idx_outside_sessions_status 
  ON outside_sessions(status);

CREATE INDEX idx_outside_sessions_created_at 
  ON outside_sessions(created_at DESC);
```

### Migration Strategy
- **File**: `src/db/migrations/004-create-outside-tables.ts`
- **Idempotent**: Use `CREATE TABLE IF NOT EXISTS` pattern
- **Order**: Create outside_sessions first, then outside_session_items (FK dependency)
- **Rollback**: Not needed for MVP (no version downgrades)
- **Backward compatible**: Existing tables unmodified

### Data Integrity Rules
- Session cannot have orphaned items (CASCADE DELETE handles deletion)
- Only one ACTIVE session (UNIQUE constraint + index WHERE status='ACTIVE')
- No duplicate items in session (UNIQUE(session_id, item_id))
- Check timestamps must follow check state (CHECK constraint)

---

## 5. Repository Responsibilities

### OutsideSessionRepository
**Purpose**: Handle all outside_sessions table operations

**Methods**:
```
Static Methods (for existing pattern compatibility):
- static async createSession(title: string): Promise<OutsideSession>
- static async getSessionById(id: string): Promise<OutsideSession | null>
- static async getActiveSession(): Promise<OutsideSession | null>
- static async getAllCompletedSessions(): Promise<OutsideSession[]>
- static async completeSession(id: string): Promise<OutsideSession>
- static async deleteSession(id: string): Promise<void>

Instance Methods (for Service layer):
- async createSession(title: string): Promise<OutsideSession>
- async getActiveSession(): Promise<OutsideSession | null>
- async getCompletedSessions(): Promise<OutsideSession[]>
- async completeSession(id: string): Promise<OutsideSession>
- async deleteSession(id: string): Promise<void>
```

**Responsibility Boundaries**:
- ✅ CRUD operations on sessions table
- ✅ Parameterized queries for all operations
- ✅ Error handling and logging
- ❌ NOT business logic (one active check done in Service)
- ❌ NOT validation (done in Service)
- ❌ NOT cascade delete (handled by FK constraints)

### OutsideSessionItemRepository
**Purpose**: Handle all outside_session_items table operations

**Methods**:
```
Instance Methods:
- async addItemToSession(sessionId: string, itemId: string): Promise<OutsideSessionItem>
- async removeItemFromSession(sessionId: string, itemId: string): Promise<void>
- async toggleItemCheck(sessionId: string, itemId: string, isChecked: boolean): Promise<OutsideSessionItem>
- async getSessionItems(sessionId: string): Promise<OutsideSessionItem[]>
- async getSessionItemsWithContext(sessionId: string): Promise<(OutsideSessionItem & {itemName, spaceName?, containerName?})[]>
- async getAllItemsNotInSession(sessionId: string): Promise<Item[]>
- async getCheckedCount(sessionId: string): Promise<number>
```

**Responsibility Boundaries**:
- ✅ CRUD on junction table
- ✅ Load items with space/container context (JOINs)
- ✅ Track check state and timestamps
- ❌ NOT validation (duplicate check done in Service)
- ❌ NOT pagination (handled in Service or UI)

### ItemRepository (Extended)
**Purpose**: Read-only access to items for context

**New Methods**:
```
- async getById(id: string): Promise<Item | null>
- async getAll(): Promise<Item[]>
```

**Usage**: 
- Fetch available items for ItemPickerModal
- Validate item exists before adding to session
- Load item context (space, container) in session detail

---

## 6. Service Responsibilities

### OutsideService
**Purpose**: Orchestrate business logic, validate rules, coordinate repositories

**Constructor**:
```typescript
constructor(
  sessionRepository: OutsideSessionRepository,
  sessionItemRepository: OutsideSessionItemRepository,
  itemRepository: ItemRepository
)
```

**Methods**:
```
Session Management:
- async createSession(title: string): Promise<{success: true, session: OutsideSession} | {success: false, error: ServiceError}>
- async getActiveSession(): Promise<OutsideSession | null>
- async getCompletedSessions(): Promise<OutsideSession[]>
- async completeSession(sessionId: string): Promise<{success: true, session: OutsideSession} | {success: false, error: ServiceError}>
- async deleteSession(sessionId: string): Promise<{success: true} | {success: false, error: ServiceError}>

Item Management:
- async addItemsToSession(sessionId: string, itemIds: string[]): Promise<{success: true, items: OutsideSessionItem[]} | {success: false, error: ServiceError}>
- async removeItemFromSession(sessionId: string, itemId: string): Promise<{success: true} | {success: false, error: ServiceError}>
- async toggleItemCheck(sessionId: string, itemId: string): Promise<{success: true, item: OutsideSessionItem} | {success: false, error: ServiceError}>

Data Queries:
- async getSessionWithItems(sessionId: string): Promise<{session: OutsideSession, items: OutsideSessionItem[], checkedCount: number} | null>
- async getAvailableItemsForSession(sessionId: string): Promise<Item[]>
- async getSessionSummary(): Promise<{active: OutsideSession | null, completedCount: number}>
```

**Business Rules Enforced**:
```
BR1 - One Active Session:
  createSession() → validates no other ACTIVE exists
  completeSession() → validates target is ACTIVE
  
BR2 - Items Don't Relocate:
  addItemsToSession() → just creates reference, no item location change
  
BR3 - No Duplicate Items:
  addItemsToSession() → filters out items already in session
  
BR4 - Session Lifecycle:
  createSession() → ACTIVE status
  completeSession() → COMPLETED status, set completed_at
  deleteSession() → only COMPLETED sessions
  
BR5 - Validation:
  Title not empty, max 100 chars
  Session/item must exist before operations
  Item foreign key valid
```

**Error Codes** (ServiceError):
```
INVALID_TITLE                    // Title empty or >100 chars
ACTIVE_SESSION_EXISTS            // Attempted create while one active
SESSION_NOT_FOUND                // Session ID doesn't exist
SESSION_NOT_ACTIVE               // Operation requires ACTIVE session
ITEM_NOT_FOUND                   // Item ID doesn't exist
ITEM_ALREADY_IN_SESSION          // Duplicate item add
DATABASE_ERROR                   // Catch-all DB error
VALIDATION_ERROR                 // Input validation failed
```

---

## 7. UI Screen Planning

### Screen 1: OutsidePage (Main Tab)
**Route**: `/outside`  
**Purpose**: Entry point for Outside feature

**States**:
1. **EMPTY** - No active session exists
   - Icon/illustration
   - Heading: "No active sessions"
   - CTA: "Create New Session"
   - Optional: Link to view history

2. **ACTIVE** - ACTIVE session exists
   - Show SessionCard summary (title, item count, "X of Y checked")
   - Primary CTA: Tap to open detail
   - "View History" button at top
   - Quick stats: "3 of 5 items checked"

3. **LOADING** - Initial fetch in progress
   - Spinner
   - No interaction

4. **ERROR** - Failed to load session
   - Error message
   - "Retry" button

**Components**:
- SessionCard (reusable, shows title + counts)
- Empty state container
- Header with history button

**Interactions**:
- Tap session card → navigate to SessionDetailScreen
- Tap "Create" → SessionForm modal
- Tap "History" → SessionHistoryScreen
- Pull-to-refresh (optional)

---

### Screen 2: SessionDetailScreen
**Route**: `/outside/session/[id]`  
**Purpose**: Active session management - add items, check off, complete

**States**:
1. **ACTIVE_LOADED** - Session loaded, can edit
   - Session title at top (in header)
   - Summary: "3 of 5 items checked"
   - Item list (FlatList)
   - "Add Items" FAB button
   - "Complete Session" button at bottom

2. **COMPLETED_READONLY** - Viewing completed session
   - Same layout but all inputs disabled
   - "Delete Session" button instead of "Complete"
   - Visual indication: "Completed on [date]"

3. **LOADING** - Session loading
   - Spinner

4. **ERROR** - Session fetch failed
   - Error message + retry

**Item List Row**:
```
[Checkbox] Item Name
           Space Name / Container Name
           (strikethrough if checked)
```

**Interactions**:
- Tap checkbox → toggle is_checked (optimistic update)
- Swipe left → delete item (with confirm)
- Tap "Add Items" → ItemPickerModal
- Tap "Complete Session" → confirmation dialog
- Header back button → return to OutsidePage

**Navigation Hierarchy**:
```
OutsidePage
    └─ SessionDetailScreen (ACTIVE session)
       └─ ItemPickerModal
    └─ SessionDetailScreen (COMPLETED session)
```

---

### Screen 3: SessionHistoryScreen
**Route**: `/outside/history`  
**Purpose**: View completed sessions

**States**:
1. **HAS_SESSIONS** - Completed sessions exist
   - List of SessionCard components
   - Sorted by completed_at DESC (most recent first)
   - Each card shows: title, completed date, item count

2. **EMPTY** - No completed sessions
   - "No completed sessions" message
   - "Create one to get started" CTA

3. **LOADING** - Fetching history
   - Spinner

**Interactions**:
- Tap session → SessionDetailScreen (readonly)
- Swipe left on card → delete (with confirm)
- Header back → OutsidePage

---

### Screen 4: SessionForm Modal
**Purpose**: Create new session

**Fields**:
- Text input: Session title
  - Placeholder: "Grocery run, Airport trip, etc."
  - Max 100 chars with counter
  - Validation: not empty

**Buttons**:
- Cancel (close modal)
- Create (enabled only if title not empty)

**Error Handling**:
- If ACTIVE session exists: Show error "You already have an active session"
- If DB error: Show error "Failed to create session. Try again."

**Success**:
- Modal closes
- Navigate to SessionDetailScreen with new session
- Show toast: "Session created"

---

### Screen 5: ItemPickerModal
**Purpose**: Select items to add to session

**Features**:
- Search input (optional for MVP, but recommended)
- List of all available items (those not already in session)
- Each item shows:
  - Item name
  - Space name + container name (if in container)
  - Checkbox for selection
- "Add Selected" button (disabled if none selected)
- "Cancel" button

**Filter Logic**:
- Show items from all spaces/containers
- Hide items already in this session
- Sort by name ASC

**Interactions**:
- Type to filter items (search)
- Tap checkbox to select (multi-select)
- Tap "Add Selected" → service adds items → close modal → reload session items
- Tap "Cancel" → close modal

**Error States**:
- No items available: "All items are already in this session"
- DB error: "Failed to load items. Try again."

---

## 8. Navigation Flow

### Route Structure
```
/outside                          # Main tab (OutsidePage)
/outside/session/[id]             # Session detail (SessionDetailScreen)
/outside/history                  # History view (SessionHistoryScreen)
```

### Navigation Stack
```
Tab Navigation (Bottom tabs)
    │
    ├─ Home
    ├─ Spaces
    ├─ Lending
    └─ Outside (NEW)
       └─ Native Stack
           ├─ outside/index        (OutsidePage) [initial]
           ├─ outside/session/[id] (SessionDetailScreen)
           └─ outside/history      (SessionHistoryScreen)
```

### Route Handlers
**File**: `app/outside.tsx`
```typescript
export default function OutsideRoute() {
  return <>
    <Stack.Screen options={{ headerShown: false }} />
    <OutsidePage />
  </>
}
```

**File**: `app/outside/session/[id].tsx`
```typescript
export default function SessionDetailRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <>
    <Stack.Screen options={{ headerShown: false }} />
    <SessionDetailScreen sessionId={id} />
  </>
}
```

**File**: `app/outside/history.tsx`
```typescript
export default function SessionHistoryRoute() {
  return <>
    <Stack.Screen options={{ headerShown: false }} />
    <SessionHistoryScreen />
  </>
}
```

### Modal Navigation (Modals, not routes)
- SessionForm: Modal overlay (not routed)
- ItemPickerModal: Modal overlay (not routed)
- Confirmation dialogs: Alert.alert() or custom modal

---

## 9. Session Lifecycle Flow

```
START
  │
  ├─ User creates session
  │  └─ Service validates (no active exists, title valid)
  │     └─ Create in DB with status=ACTIVE
  │        └─ Navigate to SessionDetailScreen
  │
  ├─ ACTIVE STATE (Loop)
  │  ├─ User adds items
  │  │  └─ Service validates (session exists, items exist, no duplicates)
  │  │     └─ Add entries to outside_session_items table
  │  │
  │  ├─ User checks items
  │  │  └─ Service validates (session/item exist)
  │  │     └─ Toggle is_checked, set checked_at timestamp
  │  │
  │  ├─ User removes items
  │  │  └─ Service validates (item in session)
  │  │     └─ Delete from outside_session_items
  │  │
  │  └─ (Loop until complete)
  │
  ├─ User completes session
  │  └─ Service validates (session is ACTIVE)
  │     └─ Update status=COMPLETED, set completed_at
  │        └─ **Navigate to SessionHistoryScreen**
  │           └─ Show completed session in history list
  │           └─ Show toast: "Session completed"
  │
  ├─ User views history
  │  └─ Can view any completed session
  │     └─ Can delete completed session
  │        └─ Soft delete (or hard delete cascade)
  │
  └─ END

Alternate Flows:
  App restart → useFocusEffect → fetch active session → resume

  Delete active session (if allowed) → reset to empty state

  Session auto-archive (future feature) → auto-complete old sessions
```

---

## 10. Business Rule Enforcement Strategy

### BR1: One Active Session
**Where Enforced**: Service layer (not DB alone, Service is the gatekeeper)

**Mechanism**:
```
createSession() {
  const existing = await sessionRepository.getActiveSession()
  if (existing) {
    throw ServiceError(ACTIVE_SESSION_EXISTS)
  }
  // proceed to create
}
```

**DB-Level Backup** (defensive):
```
UNIQUE INDEX idx_outside_active_session 
  ON outside_sessions(status) 
  WHERE status = 'ACTIVE'
```

**UI Enforcement**:
- Hide "Create Session" if ACTIVE exists
- Show error if user somehow attempts duplicate creation

---

### BR2: Items Don't Relocate
**Enforcement**: Design pattern (not DB constraint)

**Mechanism**:
- Items table unchanged
- Only create references in outside_session_items
- Never UPDATE items.space_id or items.container_id
- When displaying, JOIN to show context but don't modify

**Validation**:
- Service validates item exists before creating reference
- Never allows moving item as side effect of adding to session

---

### BR3: No Duplicate Items in Session
**Where Enforced**: Service + DB

**Service Level**:
```
addItemsToSession(sessionId, itemIds) {
  const existing = await sessionItemRepository.getSessionItems(sessionId)
  const existingIds = existing.map(i => i.item_id)
  const filtered = itemIds.filter(id => !existingIds.includes(id))
  // proceed with filtered list
}
```

**DB-Level Backup**:
```
UNIQUE(session_id, item_id)
```

**UI**: 
- ItemPickerModal filters out items already in session (grayed out)

---

### BR4: Session Lifecycle (State Machine)
**States**: ACTIVE → COMPLETED (one direction)

**Transitions**:
- CREATE: ∅ → ACTIVE (status='ACTIVE', created_at now, completed_at null)
- COMPLETE: ACTIVE → COMPLETED (status='COMPLETED', completed_at now)
- DELETE: COMPLETED → ∅ (cascade delete)

**Validation**:
```
completeSession(id) {
  const session = await getSession(id)
  if (session.status !== 'ACTIVE') {
    throw SessionError(SESSION_NOT_ACTIVE)
  }
  // proceed to update
}
```

---

### BR5: Validation Rules
**Input Validation** (in Service constructor methods):
```
createSession(title) {
  if (!title || title.trim().length === 0) {
    throw ValidationError(INVALID_TITLE)
  }
  if (title.length > 100) {
    throw ValidationError(INVALID_TITLE)
  }
  // proceed
}

addItemsToSession(sessionId, itemIds) {
  if (!sessionId || itemIds.length === 0) {
    throw ValidationError(...)
  }
  // validate each itemId exists
  for (itemId in itemIds) {
    const item = await itemRepository.getById(itemId)
    if (!item) throw ItemNotFoundError
  }
}
```

---

## 11. State Synchronization Approach

### Local State Management (NO Redux/Context)
Each screen manages its own state with useState + useCallback:

```typescript
// SessionDetailScreen.tsx
const [session, setSession] = useState<OutsideSession | null>(null);
const [items, setItems] = useState<OutsideSessionItem[]>([]);
const [loading, setLoading] = useState(true);
const [error, setError] = useState<string | null>(null);

useFocusEffect(
  useCallback(() => {
    loadSessionWithItems();
  }, [sessionId, outsideService])
);

// When item checked
const handleCheckToggle = async (itemId) => {
  // Optimistic update
  const updatedItems = items.map(i =>
    i.item_id === itemId ? { ...i, is_checked: !i.is_checked } : i
  );
  setItems(updatedItems);
  
  // Then update DB
  try {
    await outsideService.toggleItemCheck(sessionId, itemId);
  } catch (err) {
    // Revert on error
    setItems(items);
    showError(err.message);
  }
};
```

### Data Consistency Strategy
- **Optimistic Updates**: UI updates immediately, DB follows
- **Rollback on Error**: If DB fails, revert UI state
- **useFocusEffect**: Reload data when returning to screen (ensures sync after navigation)
- **Single Source of Truth**: DB is truth; UI reflects current DB state on load

### Session Reload Triggers
```
useFocusEffect(() => {
  // Reload whenever screen focused
  // Handles: app returned to foreground, navigation back, other screens modified
})
```

### Item Count Sync
- Update count whenever items array changes
- Formula: `checkedCount = items.filter(i => i.is_checked).length`
- Display: `"${checkedCount} of ${items.length} checked"`

---

## 12. MVP UX Recommendations

### Simplifications for MVP
1. **No search in ItemPickerModal** (Phase 2)
   - Show all items sorted by name
   - If >100 items, show message "Too many items to display" + pagination

2. **No item quantity** (Phase 2)
   - One item = one checkbox
   - No "I'm bringing 3 of these" logic

3. **No session notes** (Phase 2)
   - Title only
   - No description/notes per item

4. **No item reordering** (Phase 2)
   - Fixed sort (by name or added order)
   - No drag-to-reorder

5. **No session duplication** (Phase 2)
   - Can't create session from template
   - User manually recreates or uses history

6. **No session sharing** (Phase 2)
   - Single device, single user
   - No QR code, link, or export

### Recommended UX Patterns

**Empty State**:
```
🧳 (icon)
No Active Sessions
Create a checklist before your next trip

[+ Create New Session] (primary button)
[View History] (secondary link)
```

**Active Session Summary**:
```
Session Title
3 of 5 items checked    [progress bar: ███░░]

[+ Add Items]           [Complete Session]
```

**Item List**:
```
[✓] Item Name
    Space Name › Container Name
    (strikethrough if checked, different color)
```

**Completed Session**:
```
Trip to Airport (Completed)
Completed on May 5, 2026
5 items (all checked)

[← Back] [Delete]
```

### Visual Hierarchy
1. **Session title** - Large, bold (header)
2. **Item count / progress** - Secondary info
3. **Item list** - Main content, checkboxes prominent
4. **Action buttons** - Bottom, full-width or paired

### Color/Styling
- **Checked items**: Strikethrough + muted color (gray #999)
- **Unchecked items**: Bold text, primary color
- **Active session**: Highlight/border, "In Progress" badge
- **Completed session**: Muted/grayed out, "✓ Done" badge

### Animations (NONE for MVP)
- No slide-in, fade-out, or parallax
- Simple instant changes
- Haptic feedback only (optional vibration on check)

---

## 13. Suggested Implementation Phases

### Phase 1 (MVP - Current Work)
**Goal**: Core session + item checklist functionality

**Tasks**:
1. Create domain models (OutsideSession, OutsideSessionItem types)
2. Create SQLite migration (tables, indexes, constraints)
3. Create OutsideSessionRepository (CRUD)
4. Create OutsideSessionItemRepository (item add/remove/check)
5. Create OutsideService (business logic, validation)
6. Create OutsidePage (empty state + active session view)
7. Create SessionDetailScreen (items list, check toggle, add items)
8. Create SessionForm modal (create session)
9. Create ItemPickerModal (select items to add)
10. Create route handlers (/outside, /outside/session/[id])
11. Test full flow: create → add → check → complete

**Deliverables**: Working MVP, all CRUD operations functional

---

### Phase 2 (Polish)
**Goal**: History, delete, UX refinements

**Tasks**:
1. SessionHistoryScreen (view completed sessions)
2. Delete session functionality
3. Search in ItemPickerModal (filter items by name)
4. Confirmation dialogs (before complete/delete)
5. Error messages and retry logic
6. Session title edit (optional - allow edit ACTIVE session name)
7. Item removal from session (swipe-to-delete or menu)
8. Pagination for large item lists (if >200 items)
9. Toast notifications (session created, completed, deleted)
10. Sort/filter options (by space, by check status)

**Deliverables**: Complete feature with history and refinements

---

### Phase 3 (Advanced, Future)
**Goal**: Enhancements and integrations

**Tasks**:
1. Session templates/favorites (quick-create common sessions)
2. Item quantity tracking (bring 2 passports, 3 snacks)
3. Notes per item ("Check expiration date")
4. Recurring sessions ("Weekly grocery list")
5. Session time tracking ("Out for 2 hours 15 mins")
6. Analytics (how long sessions usually last, most packed items)
7. Lending integration (show "Lent items" in session)
8. Photo attachments (take photos of packed items)
9. Offline-first sync prep (for future multi-device)
10. Dark mode theme support

---

## 14. Simplification Recommendations

### Keep Out of MVP
1. **No cloud sync** ← Specified constraint, avoid temptation
2. **No multi-device** ← Single device, single database
3. **No authentication** ← Single user per device
4. **No push notifications** ← No reminders or alerts
5. **No recurring/templates** ← Phase 2
6. **No item quantities** ← Simplify to "have this item" checkbox
7. **No geolocation** ← No "know when I left" triggers
8. **No analytics** ← No tracking, just local data
9. **No animations** ← Simple instant transitions
10. **No collaborative editing** ← Single user

### Code Simplifications
1. **No state management library** (Redux, MobX)
   - Use useState + useCallback only
   - Service layer handles orchestration

2. **No custom hooks at first**
   - Inline logic in screens initially
   - Extract custom hooks in Phase 2 if patterns emerge

3. **No API/backend integration**
   - Assume all data exists locally
   - No HTTP calls, no REST endpoints

4. **No complex animations**
   - Instant state changes
   - No Reanimated or Animated libraries

5. **No intensive computations**
   - Simple filters and sorts
   - O(n) acceptable for <1000 items

---

## 15. Risk Areas and Edge Cases

### Risk 1: One Active Session Enforcement
**Risk**: Multiple ACTIVE sessions created if validation layer bypassed

**Mitigation**:
- DB-level UNIQUE constraint (defensive)
- Service validation on every create
- Test: try creating 2nd session, verify error

**Edge Case**: 
- User creates session, app crashes → session in DB but UI shows empty
- **Mitigation**: useFocusEffect always loads active session on resume

---

### Risk 2: Orphaned Items (Item Deleted While in Session)
**Risk**: Session contains deleted item, item lookup fails

**Mitigation**:
- FK CASCADE DELETE removes from session automatically
- Or: FK SET NULL (keep reference but item_id null)
- Service handles gracefully: skip display if item_id is null

**Test**: Delete an item from Spaces while it's in session, verify session updates

---

### Risk 3: Duplicate Items in Session
**Risk**: User taps "Add" twice, item added twice

**Mitigation**:
- DB UNIQUE(session_id, item_id) prevents
- Service filters before adding
- UI disables item if already in session

**Test**: Try adding same item twice in picker, verify prevented

---

### Risk 4: Incomplete Session Completion
**Risk**: User completes session but UI doesn't update, still shows ACTIVE

**Mitigation**:
- After complete, navigate to history (clear ACTIVE from view)
- Or: Show confirmation "Session complete" with redirect
- useFocusEffect reloads on return

**Test**: Complete session, verify transition to history

---

### Risk 5: Performance with Large Item Lists
**Risk**: 500+ items in item picker = slow render

**Mitigation**:
- FlatList instead of ScrollView (virtualized)
- Pagination: load 50 at a time
- Search to filter items
- Lazy-load items as user scrolls

**Test**: Load picker with 500+ items, verify smooth scroll

---

### Risk 6: Check State Sync
**Risk**: User checks item, app crashes → check lost

**Mitigation**:
- Write to DB immediately (not debounced)
- Await DB operation before UI update (or optimistic + rollback on fail)
- On app resume, fetch latest state from DB

**Test**: Check item, force-quit app, reopen, verify check persisted

---

### Risk 7: State Inconsistency Between Screens
**Risk**: User checks item in detail screen, navigates to history → history shows unchecked

**Mitigation**:
- useFocusEffect reloads on every screen focus
- Share Service instance via memoization (same service = same state reference)
- Or: Use context/provider for state (Phase 2)

**Test**: Check item, navigate to history and back, verify consistency

---

### Risk 8: Database Migration Failed
**Risk**: Upgrade to new version, migration fails, app crashes

**Mitigation**:
- Test migrations extensively
- Idempotent: use IF NOT EXISTS, IF NOT NULL checks
- Backward compatible: new tables don't break old code
- Try-catch in migration runner

**Test**: Deploy migration, verify tables created, old data intact

---

### Risk 9: Service Initialization Error
**Risk**: Service creation fails → app unusable

**Mitigation**:
- Wrap useMemo with try-catch in component
- Show error screen if service fails
- Log error for debugging

**Test**: Mock repository to throw error, verify handled gracefully

---

### Risk 10: Concurrent Operations
**Risk**: User checks item while "Add Items" is still processing

**Mitigation**:
- Disable buttons while operation in progress
- Queue operations (not critical for MVP)
- Or: Ignore concurrent ops (last write wins)

**Test**: Rapidly tap check while modal still loading

---

## Implementation Approach

### Start Point
1. Write domain models (TypeScript types)
2. Write SQLite migration
3. Write repositories (data access)
4. Write service (business logic)
5. Write screens (UI)
6. Test full flow manually

### Quality Gate
- [ ] No TypeScript errors (strict mode)
- [ ] All CRUD operations work
- [ ] One active session enforced
- [ ] Items don't relocate
- [ ] Safe to close/reopen app
- [ ] No console errors

### Success Criteria
- User can create session, add items, check them off, complete session
- Data persists after app close/reopen
- All specified constraints enforced
- No orphaned data
- Performance acceptable (smooth scrolling, <100ms operations)

---

## Document History

| Version | Date | Author | Change |
|---------|------|--------|--------|
| 1.0 | 2026-05-06 | Plan | Initial MVP implementation plan |

---

**Plan Complete - Ready for Task Generation**
