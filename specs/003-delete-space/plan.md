# Implementation Plan: Delete Space

**Feature Branch**: `003-delete-space`  
**Based On**: [spec.md](./spec.md)  
**Created**: 2026-05-05  
**Last Updated**: 2026-05-05

## Technical Context

### Stack
- **Runtime**: React Native (Expo)
- **Database**: expo-sqlite (existing)
- **Navigation**: Expo Router with dynamic routes
- **TypeScript**: Strict mode (existing)
- **Architecture**: 4-layer (UI → Service → Repository → Database)

### Dependencies
- `expo-router` - Already configured in project
- `expo-sqlite` - Existing database client
- React Native built-in components (Button, Alert, Text, View)

### Reused Patterns
- **Repository Pattern**: SpaceRepository with parameterized SQL queries
- **Service Layer**: SpaceService for business logic
- **TypeScript Models**: Space interface from existing models
- **Error Handling**: ServiceError pattern from 001-create-space

---

## Constitution Check

✅ **Architecture**: 4-layer architecture maintained (no new layers)  
✅ **Database**: expo-sqlite with parameterized queries (no ORM, permanent delete only)  
✅ **Type Safety**: TypeScript strict mode  
✅ **Scope**: MVP focused (delete only, no soft delete or undo)  
✅ **Navigation**: Expo Router (existing pattern)

---

## Design Decisions

### 1. Delete Location
- **Decision**: Delete button on space detail view ([id].tsx) only
- **Rationale**: Simple MVP scope, consistent with 002-view-space-details
- **Why not list view**: Avoid accidental deletion; detail view is safer

### 2. Confirmation Dialog
- **Decision**: Use React Native `Alert.alert()` for confirmation
- **Rationale**: Native, no custom modal needed, simple, familiar to users
- **Behavior**: Alert shows space name, has "Delete" and "Cancel" buttons

### 3. Navigation After Deletion
- **Decision**: Use `router.dismiss()` to return to space list
- **Rationale**: Simple, works with Expo Router dynamic routes
- **Fallback**: If dismiss fails, navigate to home and then to list

### 4. List Refresh Strategy
- **Decision**: Use React Navigation `useFocusEffect` hook on space list screen
- **Rationale**: Re-query spaces when list comes into focus (after returning from detail)
- **Alternative Considered**: Global state (Redux) - too complex for MVP

### 5. Empty State
- **Decision**: Show empty state message on SpaceScreen when no spaces exist
- **Rationale**: Minimal implementation; user sees "No spaces yet" + create button
- **Location**: In SpaceScreen render logic

### 6. Error Handling
- **Decision**: On deletion error, show Alert and keep user on detail view
- **Rationale**: User can see space still exists, can retry or navigate back manually
- **Error Message**: "Failed to delete space. Please try again."

---

## Phase 1: Database & Service Methods

### T001: Repository - deleteSpace
**File**: `app/src/repositories/SpaceRepository.ts`

Add new method:
```typescript
static async deleteSpace(id: string): Promise<void>
```

**Implementation**:
- Execute: `DELETE FROM spaces WHERE id = ?`
- Parameterized query with `id`
- No return value (void)
- Throw ServiceError if query fails

**Acceptance**: Space is deleted from database; throws error if database operation fails

---

### T002: Service - deleteSpace
**File**: `app/src/services/SpaceService.ts`

Add new method:
```typescript
static async deleteSpace(id: string): Promise<void>
```

**Implementation**:
- Validate id is not empty/null
- Call `SpaceRepository.deleteSpace(id)`
- Throw ServiceError if validation fails
- Re-throw repository errors as-is

**Acceptance**: Throws VALIDATION_ERROR for invalid id; propagates database errors

---

## Phase 2: UI Integration

### T003: Add Delete Button to Detail Screen
**File**: `app/src/screens/space/[id].tsx`

Update `SpaceDetailScreen` component:

**Changes**:
- Import `Alert` from React Native
- Add delete button at bottom of screen
- On button press: call confirmation dialog

**Acceptance**: Delete button is visible and clickable on detail screen

---

### T004: Implement Confirmation Dialog
**File**: `app/src/screens/space/[id].tsx` (part of T003)

**Implementation**:
- Use `Alert.alert()` to show confirmation
- Title: "Delete Space"
- Message: `Delete '${space.name}'? This cannot be undone.`
- Buttons: "Delete" (destructive), "Cancel" (default)
- Handle user response

**Acceptance**: Dialog appears on delete button press; user can confirm or cancel

---

### T005: Handle Deletion & Navigation
**File**: `app/src/screens/space/[id].tsx` (part of T004)

**Implementation**:
- On confirm, show loading state (optional)
- Call `SpaceService.deleteSpace(id)`
- On success: `router.back()` to return to list
- On error: show error alert `Alert.alert('Error', 'Failed to delete space. Please try again.')`
- On error, stay on detail screen

**Acceptance**: Successfully deleted space navigates back; failed deletion stays on screen with error

---

### T006: Add Refresh on List Focus
**File**: `app/src/screens/SpaceScreen.tsx`

Update `SpaceScreen` component:

**Implementation**:
- Import `useFocusEffect` from `@react-navigation/native`
- On focus, re-query spaces from database
- Update state with refreshed list
- This ensures deleted space no longer appears

**Acceptance**: After deleting a space and returning to list, deleted space is gone

---

### T007: Add Empty State Message
**File**: `app/src/screens/SpaceScreen.tsx` (part of T006)

**Implementation**:
- Check if spaces list is empty
- Show message: "No spaces yet. Create one to get started."
- Show button to navigate to create space screen
- This handles the case where user deletes their last space

**Acceptance**: Empty state displays when no spaces exist; button enables space creation

---

## Implementation Order

1. ✅ **T001**: Repository.deleteSpace - Core delete operation
2. ✅ **T002**: Service.deleteSpace - Business logic wrapper
3. ✅ **T003**: Add delete button to detail screen
4. ✅ **T004**: Confirmation dialog with Alert
5. ✅ **T005**: Handle deletion result & navigation
6. ✅ **T006**: Refresh space list on focus
7. ✅ **T007**: Empty state handling

**Total: 7 implementation tasks**

---

## Success Criteria

- ✅ User can delete a space from detail view
- ✅ Confirmation dialog appears before deletion
- ✅ Deleted space is removed from database
- ✅ Deleted space no longer appears in list after deletion
- ✅ User is navigated back to list after successful deletion
- ✅ Error message appears if deletion fails; user stays on detail view
- ✅ Empty state appears when no spaces exist
- ✅ All database queries use parameterized SQL
- ✅ No TypeScript errors
- ✅ Deletion persists after app restart

---

## Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| Accidental deletion | Confirmation dialog with space name reminder |
| Database error during deletion | Show error alert, keep user on screen for retry |
| List doesn't update after deletion | Use `useFocusEffect` to re-query on focus |
| Race condition (space deleted twice) | Database will return error (space not found); handled by error handler |
| Navigation fails | Catch router error and show alert to user |

---

## Notes for Implementation

- Keep error messages simple and user-friendly
- No need for loading spinner during deletion (SQLite is fast locally)
- Use existing SpaceRepository and SpaceService patterns
- Leverage React Navigation `useFocusEffect` for list refresh
- Test with app restart to verify database persistence
