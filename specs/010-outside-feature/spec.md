# Outside Checklist Feature Specification

**Feature:** 010 - Outside Checklist  
**Version:** 1.0  
**Status:** MVP Specification  
**Last Updated:** May 6, 2026

---

## 1. Feature Overview

The Outside Checklist feature enables users to create temporary, session-based checklists before leaving home. Users can organize and verify important items they plan to bring or have brought back, without permanently relocating items from their original locations in Spaces/Containers.

This is a **temporary tracking mechanism** for departure/return verification, not a permanent item organization tool.

### Core Value Proposition
- **Before leaving:** "Did I pack everything I need?"
- **When returning:** "Do I have everything I brought?"
- **Peace of mind:** Quick visual confirmation that important items are accounted for

---

## 2. User Goals

### Primary User Goal
As a user, I want to quickly create a checklist of items I'm taking outside, verify them before leaving, and check them off when I return home—without moving them from their original locations.

### Secondary Goals
- Create multiple checklists for different trips/occasions (historically)
- Add/remove items from a checklist mid-session
- See at a glance which items are checked off
- Complete a session to archive it

---

## 3. Core User Flows

### Flow 1: Create Outside Session
```
User taps "+" or "New Session" on Outside tab
→ Prompted for session name (e.g., "Grocery run", "Airport trip")
→ Session created with ACTIVE status
→ Timestamp recorded (created_at)
→ Shown item picker to start adding items
```

### Flow 2: Add Items to Session
```
User taps "Add Items" / "+" on session detail
→ Modal shows all items from all spaces/containers
→ User selects multiple items (checkboxes or swipe-to-select)
→ Selected items added to session with UNCHECKED state
→ Items remain in original spaces/containers
→ UI updates to show item count
```

### Flow 3: Check Off Item
```
User taps item in session checklist
→ Item toggles between UNCHECKED ↔ CHECKED
→ Visual feedback (strikethrough, badge, icon change)
→ Timestamp of check recorded (optional for analytics/future)
```

### Flow 4: Complete Session
```
User taps "Complete" or "End Session" button
→ Confirmation dialog: "Mark this session as completed?"
→ On confirm: status changes ACTIVE → COMPLETED
→ Timestamp recorded (completed_at)
→ Session moved to history/archive view
→ UI returns to active session (or empty state if was only session)
```

### Flow 5: View Active Session
```
User opens Outside tab
→ If ACTIVE session exists: Show session detail with items + check status
→ If no ACTIVE session: Show empty state with "Create New Session" CTA
→ If session exists but archived: Show "Active: None" with archive button
```

---

## 4. Functional Requirements

### FR1: Session Management
- **Create session**: User can create a new outside session with a name (title)
- **Session state**: Session has one of two states: ACTIVE or COMPLETED
- **One active limit**: Only ONE session can be ACTIVE at a time
- **Complete session**: User can mark an ACTIVE session as COMPLETED
- **View active session**: Outside tab displays the current ACTIVE session prominently

### FR2: Item Management
- **Add items**: User can add existing items from Spaces/Containers to an ACTIVE session
- **Add multiple**: Bulk-add multiple items in single action
- **Remove items**: User can remove items from a session (without deleting from spaces)
- **Item list**: Session displays all added items in a list view

### FR3: Check State
- **Toggle check**: User can check/uncheck items individually
- **Visual indication**: Checked items have distinct visual treatment (strikethrough, different color, badge, etc.)
- **Count display**: Show "X of Y items checked" summary
- **Persistence**: Check state persists when viewing session again

### FR4: Session History
- **View completed**: User can view list of completed sessions
- **Sort order**: Most recent first
- **Delete session**: User can delete completed sessions (optional for MVP, can be delete-only after completion)

### FR5: Empty States
- **No active session**: Friendly message with "Create New Session" button
- **No items in session**: Prompt "Add items to get started"
- **No history**: Empty message for completed sessions list

### FR6: Item Selection Modal
- **Show all items**: Display items from all spaces/containers with context
- **Search/filter**: Optional - filter items by name or space (can be in Phase 2)
- **Checkboxes**: Multi-select with visual feedback
- **Context display**: Show which space/container each item belongs to

---

## 5. Business Rules

### BR1: Items Don't Relocate
- Adding an item to an outside session does NOT move it from its original space/container
- Item remains linked to its original location
- Outside session is purely a reference/pointer system

### BR2: One Active Session
- Maximum one ACTIVE session allowed at any time
- Attempting to create while ACTIVE session exists: Either fail with message or auto-complete previous session (clarify in implementation)
- COMPLETED sessions do not count toward this limit

### BR3: Session Ownership
- Sessions are not user-specific (single-user app, no auth)
- Assumed one user per device

### BR4: Item Uniqueness in Session
- An item cannot be added to the same session twice
- No duplicate item entries in a single session

### BR5: Permanent Deletion
- Deleting an item from Spaces/Containers should handle orphaned session references gracefully:
  - Option A: Show item as "Deleted" in session with disabled check
  - Option B: Auto-remove item from session
  - (Specify in implementation phase)

---

## 6. Data Requirements

### Entities

#### OutsideSession
- `id`: UUID, unique session identifier
- `title`: String (1-100 characters), user-provided session name
- `status`: Enum {ACTIVE, COMPLETED}
- `created_at`: ISO 8601 timestamp, immutable
- `completed_at`: ISO 8601 timestamp, nullable, set when status changes to COMPLETED
- `updated_at`: ISO 8601 timestamp, auto-updated on any change

#### OutsideSessionItem
- `id`: UUID, unique junction entry identifier
- `session_id`: Foreign key to OutsideSession
- `item_id`: Foreign key to Item (in Items table)
- `is_checked`: Boolean, true if user checked off the item
- `checked_at`: ISO 8601 timestamp, nullable, set when is_checked becomes true
- `created_at`: ISO 8601 timestamp, when item was added to session

### Database Constraints
- `OutsideSession.status` check constraint: value IN ('ACTIVE', 'COMPLETED')
- `OutsideSessionItem` composite unique constraint: (session_id, item_id) - prevent duplicate items in session
- Unique index on `OutsideSession(status)` WHERE `status = 'ACTIVE'` - enforce one active session
- Foreign keys with CASCADE DELETE: session deletion removes all related session items

### Data Integrity
- No orphaned OutsideSessionItems (all must reference valid session and item)
- Session timestamps: `created_at ≤ completed_at` (if completed_at is set)
- No checked_at without is_checked = true

---

## 7. Edge Cases

### EC1: Item Deleted from Space While in Session
**Scenario**: Item is in active session, then deleted from Spaces  
**Expected Behavior**: 
- Session item remains (for history)
- Display as "Item deleted" or "Unavailable"
- Prevent new additions of this item
- Allow removal from session

### EC2: Complete Session with No Items
**Scenario**: User creates session, adds no items, completes it  
**Expected Behavior**: 
- Allow completion
- Show empty session in history
- Display "No items in this session" message

### EC3: Complete Session with Unchecked Items
**Scenario**: User completes session before checking all items  
**Expected Behavior**: 
- Allow completion with warning dialog: "X items not checked - complete anyway?"
- On confirm: show unchecked items in final state when viewing history

### EC4: Adding Item Already in Active Session
**Scenario**: User tries to add item that's already in the active session  
**Expected Behavior**: 
- Prevent duplicate (grayed out in picker or show "Already in session")
- Or: Allow re-add and skip (silently ignore duplicate attempt)

### EC5: Session Created but Never Used
**Scenario**: User creates session, never adds items, navigates away  
**Expected Behavior**: 
- Session persists in database
- Can be completed or deleted later
- Does not interfere with creating new sessions

### EC6: Device Offline
**Scenario**: User creates session while offline, then goes online  
**Expected Behavior**: 
- Session operations work normally (no sync needed - single device)
- Data persists locally
- No sync conflicts or warnings

---

## 8. MVP Scope Boundaries

### ✅ IN SCOPE
- Create ACTIVE session with title
- Add existing items to session
- Check/uncheck items in session
- Complete ACTIVE session → COMPLETED
- View active session on Outside tab
- View completed sessions history
- Delete completed sessions
- One ACTIVE session enforcement
- Empty states and error handling
- Local SQLite persistence

### ❌ OUT OF SCOPE (Phase 2+)
- Item search/filtering in picker (can add pagination)
- Item quantity tracking (e.g., "I'm taking 2 of these")
- Nested checklists or sub-items
- Recurring/template sessions
- Session sharing or export
- Reminders/notifications
- Geolocation verification
- Photo attachments
- Session notes/comments
- Item history within session
- Analytics or session insights
- Multiple active sessions
- Cloud sync

---

## 9. UX Expectations

### Visual Design
- **Session list**: Cards showing session title, item count, status badge, timestamps
- **Item list**: Rows with checkbox, item name, space/container context, strikethrough when checked
- **Empty state**: Helpful icon + message + primary CTA button
- **Color coding**: ACTIVE = prominent color, COMPLETED = muted/grayed
- **Status indicators**: Badge or icon showing session state

### Interactions
- **Tap to check**: Single tap toggles item check state (fast, no confirmation)
- **Swipe to delete** (optional): Quick item removal from session
- **Long-press context menu** (optional): Remove, view item details
- **Pull-to-refresh** (optional): Reload session data
- **Haptic feedback** (optional): Subtle vibration on check/completion

### Accessibility
- **Semantic labels**: Clear text for all buttons and states
- **Color contrast**: Sufficient contrast for checked/unchecked states
- **Screen reader**: Announce item counts, session status, check state changes
- **Touch targets**: Minimum 44pt tappable areas

### Performance
- **Load time**: Session + items list ≤ 100ms
- **Check toggle**: Instant visual feedback, ≤ 50ms DB update
- **Smooth scrolling**: List supports 100+ items without lag
- **Memory**: No noticeable memory increase for multiple completed sessions

---

## 10. Technical Constraints

### Architecture Constraints
- **Layered stack**: UI → Service → Repository → SQLite (strict separation)
- **No direct DB access from UI**: All queries via Service layer
- **Dependency injection**: Services created via useMemo to prevent re-renders
- **Type safety**: Full TypeScript coverage, strict mode

### Data Persistence
- **SQLite only**: No cloud sync, no async migration
- **Idempotent migrations**: Run on app startup, safe to re-run
- **Parameterized queries**: Prevent SQL injection, use ?/named parameters
- **Timestamps**: ISO 8601 format, UTC timezone

### Performance Constraints
- **Query optimization**: Indexes on session_id, item_id, status
- **Pagination**: Not required for MVP (assume <1000 sessions)
- **Batch operations**: Add multiple items in single transaction
- **No N+1 queries**: Load session + items in single JOIN query

### React/Expo Constraints
- **Hooks only**: No class components
- **useMemo**: Memoize service instances to prevent re-creation
- **useFocusEffect**: Reload data on screen focus
- **Navigation**: Use Expo Router native stack
- **No async/await in render**: Use useCallback for async operations
- **State management**: Local useState, no Redux/Context needed for MVP

### Error Handling
- **Graceful degradation**: Show error message, retry button, not crash
- **Offline behavior**: Assume always online (no sync needed)
- **Validation**: Validate input before DB operations
- **Try-catch blocks**: Wrap all DB operations with error handling

### Limits & Assumptions
- **Max session title**: 100 characters
- **Max items per session**: No hard limit (assume reasonable < 500)
- **Device storage**: SQLite stores locally, no space constraints for MVP
- **Single user**: No multi-device sync, single user per device

---

## Clarifications

### Session May 6, 2026

**Q1: Completion Navigation**  
→ A: Auto-navigate to history, show completed session in list  
**Decision**: When user completes an ACTIVE session, the app will automatically navigate to SessionHistoryScreen and display the newly completed session in the history list. This provides immediate visual confirmation and reduces interaction steps.

**Q2: Deleted Items in Active Session**  
→ A: Cascade delete - automatically remove from session when deleted from Spaces  
**Decision**: When an item is deleted from Spaces/Containers, the database CASCADE DELETE constraint will automatically remove it from any active/completed outside sessions. This prevents orphaned references and keeps data consistent.

**Q3: Multiple Active Sessions**  
→ A: Strictly one active session - enforce at all times  
**Decision**: Only ONE session can be ACTIVE at any time (reaffirms business rule BR2). Attempting to create a new session while one is ACTIVE will result in a validation error. User must complete or delete the existing session first.

**Q4: Session Title Editability**  
→ A: Title is immutable after creation  
**Decision**: Session titles cannot be edited after creation. This simplifies implementation and prevents confusion about session history. If user makes a mistake with the title, they can delete and recreate the session.

**Q5: Item Removal from Active Session**  
→ A: Allow individual item removal (swipe or menu option)  
**Decision**: Users can remove specific items from an ACTIVE session at any time using swipe-to-delete or context menu. This provides flexibility for correcting mistakes or changing minds about what to pack mid-session.

---

## Appendix: Success Criteria

### Definition of Done
- [ ] User can create session with name (form validation)
- [ ] User can add items from spaces/containers to active session
- [ ] User can toggle item check state with visual feedback
- [ ] User can complete session (status changes ACTIVE → COMPLETED)
- [ ] Session data persists in SQLite after app restart
- [ ] Only one ACTIVE session allowed at a time
- [ ] Completed sessions viewable in history
- [ ] Empty states display with appropriate messaging
- [ ] No errors in TypeScript strict mode
- [ ] All data flows through Service → Repository → SQLite

### Acceptance Testing Scenarios
1. **Create → Add → Check → Complete**: Full happy path
2. **Multiple sessions**: Create, complete first, create second (one active)
3. **Item removal**: Add item, remove it, verify session updates
4. **Persistence**: Create session, close app, reopen, data still there
5. **Error recovery**: Invalid input, show error, retry works
6. **History view**: Complete session, view in history with frozen state

---

## Appendix: Related Features

### Dependencies
- **Spaces, Containers, Items**: Must exist; Outside references them (no creation)
- **Bottom tab navigation**: Outside tab already exists in tab bar

### Future Integration Points
- Lending feature: Could show "items I lent" in outside session
- Spaces detail: Quick "add to outside session" option from item menu
- Dashboard: Show active outside session status/count

---

## Document History

| Version | Date | Author | Change |
|---------|------|--------|--------|
| 1.0 | 2026-05-06 | Specification | Initial MVP specification |

---

**Specification Complete**
