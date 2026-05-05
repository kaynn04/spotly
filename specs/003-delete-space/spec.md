# Feature Specification: Delete Space

**Feature Branch**: `003-delete-space`  
**Created**: 2026-05-05  
**Status**: Draft  
**Depends On**: [001-create-space](../001-create-space/spec.md), [002-view-space-details](../002-view-space-details/spec.md)

## Description

Allow users to delete a space from the app. Deletion removes the space from the SQLite database permanently.

## User Story

**As a** user  
**I want to** delete a space  
**So that** I can remove spaces I no longer need

## Inputs & Outputs

**Input**:
- `spaceId`: string (UUID)

**Output**:
- Space is removed from SQLite database

## Acceptance Criteria

✅ User can delete a space from the detail screen  
✅ Space is removed from SQLite database  
✅ UI updates immediately after deletion  
✅ Deleted space no longer appears in list  
✅ If user is on detail screen, navigate back after deletion  

## Constraints

- Keep UI simple (use native alert for confirmation only)
- No undo functionality
- No soft delete (permanent delete only)
- Deletion is permanent and irreversible

---

## User Scenarios & Testing

### Scenario 1: Delete Space from Detail View

**Given** user is viewing a space's detail information, **When** they tap the delete button, **Then** a confirmation dialog appears.

**Acceptance**:
1. Delete button is visible on space detail view
2. Tapping delete opens a confirmation dialog
3. Dialog has "Delete" (confirm) and "Cancel" options
4. Tapping "Cancel" closes dialog without deletion
5. Tapping "Delete" removes space and navigates back to list

### Scenario 2: Space Removed from Database

**Given** user confirms deletion, **When** the delete operation completes, **Then** the space is permanently removed from SQLite database.

**Acceptance**:
1. Space record is deleted from database
2. Deletion persists across app restarts

### Scenario 3: UI Updates After Deletion

**Given** user has deleted a space, **When** they navigate back to the space list, **Then** the deleted space no longer appears.

**Acceptance**:
1. Deleted space is no longer in the list
2. List UI updates immediately after deletion
3. No orphaned UI elements remain

---

## Key Entities

### Space
- `id`: UUID
- `name`: String
- `createdAt`: DateTime
- `updatedAt`: DateTime

---

## Requirements

### Functional Requirements

- **FR-001**: User can delete a space from the detail screen
- **FR-002**: Deletion shows a confirmation dialog
- **FR-003**: Confirmation dialog has "Delete" and "Cancel" options
- **FR-004**: Space is permanently removed from SQLite database after confirmation
- **FR-005**: User is navigated back to space list after deletion
- **FR-006**: Deleted space no longer appears in the space list
- **FR-007**: List view re-queries spaces on navigation focus to ensure deleted space is removed (using React Navigation `useFocusEffect`)
- **FR-008**: When all spaces are deleted, list view shows empty state message: "No spaces yet. Create one to get started." with a button to create a new space

### Data Requirements

- Space record is deleted using parameterized SQL
- Deletion persists across app restarts

### Error Handling

- **ERR-001**: If deletion fails, show error alert: "Failed to delete space. Please try again."
- **ERR-002**: On error, keep user on detail view (do not navigate)
- **ERR-003**: User can dismiss error alert and either retry or navigate back manually

---

## Dependencies

- [001-create-space](../001-create-space/spec.md)
- [002-view-space-details](../002-view-space-details/spec.md)

---

## Out of Scope

- Undo/Trash functionality
- Batch deletion
- Soft deletes
- Delete analytics
- Biometric authentication for delete

---

## Success Criteria

### Functional Testing
- ✅ User can delete a space from detail view
- ✅ Confirmation dialog appears before deletion
- ✅ "Cancel" closes dialog without deletion
- ✅ "Delete" removes space and navigates back to list
- ✅ Deleted space no longer appears in list
- ✅ Deleting last space shows empty state message with "Create a space" button

### Data Integrity Testing
- ✅ Space record is removed from SQLite database
- ✅ Deletion persists after app restart

### Error Handling Testing
- ✅ Deletion error shows alert; user remains on detail view
- ✅ User can retry or navigate back after error

### Edge Case Testing
- ✅ Deleting the last space shows empty state view
- ✅ No UI crashes after deletion

---

## Clarifications

### Session 2026-05-05
- Q: State management & list refresh after deletion → A: Use local component state with React Navigation `useFocusEffect` to re-query list when navigating back from detail view
- Q: Error handling when deletion fails → A: Show error alert and keep user on detail view
- Q: Empty state when all spaces deleted → A: Show empty state message with "Create a space" button

1. **Confirmation Dialog**: Use native `Alert.alert()` (React Native) for consistency with 001-create-space error patterns
2. **Navigation**: Use `navigation.goBack()` to return to space list (aligns with 002-view-space-details back button)
3. **Transaction Safety**: Use SQLite transactions (`BEGIN / COMMIT / ROLLBACK`) to ensure cascade delete is atomic
4. **UI State**: No optimistic UI updates; wait for database confirmation before updating UI to prevent inconsistency
5. **Button Styling**: Match existing delete button style in the project (if established); otherwise use red/warning color for delete
6. **Performance**: Direct SQLite delete is fast (< 50ms even with items); no loading state required unless handling large datasets
