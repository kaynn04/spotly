# Feature Specification: Delete Item

**Feature Branch**: `006-delete-item`  
**Created**: 2026-05-06  
**Status**: Draft  

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Delete Item from Space (Priority: P1)

As a user, I want to delete an item from a space so I can remove things I no longer track.

**Why this priority**: Core feature for item lifecycle management. Users need to remove items they no longer care about to keep their spaces clean and relevant.

**Independent Test**: Can be fully tested by opening a space with items, selecting an item to delete, confirming deletion, and verifying the item is removed from the UI and database.

**Acceptance Scenarios**:

1. **Given** a space with one or more items exists, **When** the user presses the delete button on an item, **Then** a confirmation dialog appears asking the user to confirm deletion
2. **Given** a confirmation dialog is shown, **When** the user taps "Delete", **Then** the item is removed from the database and the UI updates immediately
3. **Given** a confirmation dialog is shown, **When** the user taps "Cancel", **Then** the dialog closes and nothing is deleted
4. **Given** an item has been successfully deleted, **When** the space details screen is viewed, **Then** the deleted item no longer appears in the item list

---

### Edge Cases

- What happens when the user tries to delete the last item in a space? → Deletion should succeed, space continues to exist (empty)
- How does the system handle a delete operation that fails due to database error? → User sees error alert, item remains in UI
- What happens if the user is viewing a space and an item is deleted from another session? → Next time screen is loaded/refreshed, item is gone (session-specific concern, not critical for MVP)

---

## Clarifications

### Session 2026-05-06

- Q: Delete button placement → A: Inline next to Move button for UI consistency with Feature 005. Item row displays: [Item Name] [Move Button] [Delete Button]

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST provide a delete button inline next to the Move button for each item in the space detail screen (item row layout: [Item Name] [Move] [Delete])
- **FR-002**: System MUST show a confirmation dialog before deleting an item to prevent accidental deletions
- **FR-003**: System MUST permanently delete the item from SQLite database when user confirms deletion
- **FR-004**: System MUST update the UI immediately after successful deletion (item removed from list)
- **FR-005**: System MUST display an error alert if deletion fails and retain the item in the UI

### Key Entities

- **Item**: Represents a tracked item with id, name, spaceId, and createdAt. Deletion is permanent (no soft delete).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can delete an item with 2 taps (button press + confirmation)
- **SC-002**: Deleted items are permanently removed from the database (no recovery)
- **SC-003**: UI updates immediately after deletion with zero latency
- **SC-004**: Item list shows 0 errors when rendering after deletion
- **SC-005**: Users cannot accidentally delete an item (confirmation required)

## Assumptions

- Delete operation uses SQLite DELETE statement (permanent, no soft delete)
- Confirmation dialog uses native Alert.alert() for consistency with existing features
- Delete button uses same styling as other action buttons on the space detail screen
- Error handling follows existing ItemService pattern (throws ServiceError with code and message)
- No undo/recovery functionality needed (users accept permanent deletion)
- Single-space context: Item is deleted from its space immediately, no cross-space concerns
