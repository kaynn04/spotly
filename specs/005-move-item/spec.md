# Feature Specification: Move Item

**Feature Branch**: `005-move-item`  
**Created**: 2026-05-05  
**Status**: Ready for Planning  
**Input**: User can move items between spaces

## Clarifications

### Session 2026-05-05

- Q: How should users access the "Move" action for an item? → A: Small "Move" button next to item name in FlatList (inline, always visible)
- Q: Which React Native component should display available target spaces? → B: Modal with FlatList of spaces to choose from (full featured)
- Q: What should happen if user tries to move an item but only 1 space exists? → A: Disable Move button (gray out, not clickable)

---

## User Scenarios & Testing

### User Story 1 - Move Item to Different Space (Priority: P1)

User has an item in Space A and wants to relocate it to Space B to organize their items better.

**Why this priority**: Core feature - users need to reorganize items as their workflow evolves

**Independent Test**: Can be fully tested by: navigating to item detail screen, clicking Move button, selecting new space, confirming move, and verifying item no longer appears in original space but appears in new space

**Acceptance Scenarios**:

1. **Given** user is viewing items in Space A, **When** user clicks "Move" button on an item, **Then** space selection dialog appears showing all spaces except current space
2. **Given** user has selected a target space in dialog, **When** user confirms selection, **Then** item's space_id is updated in database
3. **Given** item has been moved, **When** user returns to original space, **Then** item no longer appears in that space's list
4. **Given** item has been moved, **When** user navigates to new space, **Then** item appears in that space's list

---

### Edge Cases

- **Single space scenario**: Move button is disabled (grayed out) when only 1 space exists - no target spaces available
- **Concurrent moves**: If item is moved while viewing old space, useFocusEffect refresh shows updated list
- **Permission scenario**: No permission checks - all spaces are valid targets

---

## Requirements

### Functional Requirements

- **FR-001**: System MUST allow users to move an item from one space to another
- **FR-002**: System MUST update item's space_id in SQLite when move is confirmed
- **FR-003**: System MUST display available target spaces in a Modal with FlatList (excluding current space)
- **FR-004**: System MUST disable Move button when fewer than 2 spaces exist (no valid targets)
- **FR-005**: System MUST prevent moving item to its current space (validation in service)
- **FR-006**: System MUST refresh both source and target space views after move
- **FR-007**: System MUST show confirmation dialog before completing move
- **FR-008**: Users MUST see error message if move operation fails

### Key Entities

- **Item**: Has id, name, space_id, created_at - moving updates space_id
- **Space**: Target destination - must exist and be different from current space

---

## Acceptance Criteria

### User Acceptance

- [ ] User can access Move button next to each item name
- [ ] Move button is disabled when only 1 space exists
- [ ] User sees Modal with list of target spaces when clicking Move (excludes current space)
- [ ] Move completes immediately with no loading state (SQLite instant)
- [ ] Item disappears from old space and appears in new space
- [ ] User receives error alert if move fails
- [ ] User can retry after failed move

### Technical Acceptance

- [ ] ItemRepository.updateSpaceId(itemId, newSpaceId) implemented with parameterized SQL
- [ ] ItemService.moveItem(itemId, newSpaceId) validates and calls repository
- [ ] Current space_id is checked to prevent no-op moves
- [ ] Both spaces refresh after successful move
- [ ] All database queries use parameterized queries (no SQL injection)
- [ ] No TypeScript compilation errors

---

## Success Criteria

- ✅ Users can move items between spaces in under 2 seconds
- ✅ Item availability in correct space immediately reflects move (100% accuracy)
- ✅ Move operation succeeds or fails with clear user feedback
- ✅ No data loss or orphaned items
- ✅ Item displays in target space list within 1 second

---

## Out of Scope

- Undo/redo functionality (cannot undo move)
- Move history tracking (no audit log)
- Bulk move (move multiple items at once)
- Move with copy (move creates copy in new space)
- Scheduled moves (move at future time)
- Reordering items within space

---

## Dependencies

- ✅ Feature 001 - Create Space (spaces exist)
- ✅ Feature 004 - Add Item (items exist with space_id)
- ✅ React Native components (Alert, FlatList, Modal/Picker)
- ✅ expo-sqlite with parameterized queries

---

## Assumptions

1. **Move target validation**: Can only move to spaces that exist and are different from current space
2. **No blocking moves**: All spaces are valid targets (no permission system)
3. **Immediate update**: No async delay - SQLite update is instant
4. **UI refresh**: Both source and target space screens refresh via useFocusEffect
5. **Single operation**: Move is atomic - no partial moves or rollbacks needed

---

## Implementation Notes

- Move button displays inline next to each item in FlatList (similar to delete button placement)
- Clicking Move button opens Modal with FlatList showing all spaces except current space
- User selects space from Modal list to set target space
- Confirmation required before move completes
- Validate: itemId exists, newSpaceId exists, newSpaceId ≠ currentSpaceId
- SQL: UPDATE items SET space_id = ? WHERE id = ?
- Reuse ItemService for business logic consistency
