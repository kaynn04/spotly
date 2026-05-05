# Feature Specification: Create Space

**Feature Branch**: `001-create-space`  
**Created**: 2026-05-05  
**Status**: Draft  
**Input**: User description: "create_space"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Create a New Space (Priority: P1)

A user needs to establish a physical location in the app where they can track their belongings. This is the foundational action that enables all item tracking.

**Why this priority**: P1 - Without the ability to create spaces, users cannot use the app at all. This is the entry point to the item tracking workflow.

**Independent Test**: User can successfully create a space, see it listed in the app, and the space persists after app restart. This alone delivers value: users have a structured location for organizing items.

**Acceptance Scenarios**:

1. **Given** user opens the app for the first time, **When** they tap "Create Space", **Then** a dialog/form appears with a text input field
2. **Given** user enters a space name (e.g., "Home"), **When** they tap "Save", **Then** the space is created and appears in the space list
3. **Given** user creates a space named "Office", **When** they restart the app, **Then** the space still exists and is visible
4. **Given** user has created 3 spaces, **When** they view the space list, **Then** all 3 spaces are displayed

---

### User Story 2 - View All Spaces (Priority: P1)

Users need to see a complete list of all spaces they've created so they can quickly navigate to the right location.

**Why this priority**: P1 - Essential for basic app navigation. Without viewing spaces, users can't select where to add items.

**Independent Test**: After creating multiple spaces, user can see all of them in a list view. This can be tested independently by just creating and listing spaces.

**Acceptance Scenarios**:

1. **Given** user has created 2 spaces, **When** they view the main screen, **Then** both spaces are shown in a list
2. **Given** the space list is empty, **When** user views the main screen, **Then** an empty state is shown with guidance to create a space
3. **Given** user has many spaces, **When** they scroll the space list, **Then** all spaces are accessible

---

### User Story 3 - View Space Details (Priority: P1)

Users need to see information about a specific space they've created, including a summary of items stored there.

**Why this priority**: P1 - Users must be able to tap into a space to add/manage items. This is the entry point to item management.

**Independent Test**: After creating a space, user can tap it to view its details (name, item count). This works independently of item management.

**Acceptance Scenarios**:

1. **Given** user has created a space named "Home", **When** they tap on it, **Then** they see the space name and an option to add items
2. **Given** a space contains 5 items, **When** user views the space details, **Then** the item count is displayed
3. **Given** a space is empty, **When** user views it, **Then** an empty state is shown

---

### User Story 4 - Delete a Space (Priority: P2)

Users need to remove spaces they no longer use (e.g., moving to a new apartment, no longer using an office).

**Why this priority**: P2 - Useful for app maintenance but not essential for MVP. Users can simply stop using a space if needed.

**Independent Test**: User can delete a space and it no longer appears in the list. Works independently of other features.

**Acceptance Scenarios**:

1. **Given** user has created a space, **When** they tap the delete button, **Then** a confirmation dialog appears
2. **Given** user confirms deletion, **When** they tap "Delete", **Then** the space is removed from the list
3. **Given** user cancels deletion, **When** they tap "Cancel", **Then** the space remains unchanged

---

### Edge Cases

- What happens if user tries to create a space with an empty name? → Show validation error, don't create
- What happens if user creates two spaces with the same name? → Allow it (duplicates allowed, user responsibility)
- What happens if the database becomes corrupted? → Handle gracefully with error message, preserve existing data if possible
- What if user deletes a space that contains items? → Allow deletion; decide separately in item management spec whether items are also deleted or orphaned

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST allow users to create a new space with a name
- **FR-002**: System MUST validate that space name is not empty before creating
- **FR-003**: System MUST display all created spaces in a list view on the home screen
- **FR-004**: System MUST persist spaces to local SQLite database
- **FR-005**: System MUST allow users to tap a space to view its details
- **FR-006**: System MUST display item count for each space in the space list
- **FR-007**: System MUST display space name and item count on the space detail screen
- **FR-008**: System MUST allow users to delete a space (with confirmation dialog)
- **FR-009**: System MUST handle space names up to 100 characters
- **FR-010**: System MUST show an empty state message when no spaces exist

### Key Entities

**Space**:
- `id` (UUID, primary key)
- `name` (string, max 100 chars, required)
- `created_at` (timestamp)
- `updated_at` (timestamp)

## API/Data Model

### Space Repository Interface

```typescript
interface SpaceRepository {
  create(name: string): Promise<Space>;
  getAll(): Promise<Space[]>;
  getById(id: string): Promise<Space | null>;
  delete(id: string): Promise<void>;
  getSpaceWithItemCount(id: string): Promise<SpaceWithCount | null>;
}

interface Space {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

interface SpaceWithCount extends Space {
  item_count: number;
}
```

### SQLite Schema

```sql
CREATE TABLE spaces (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (length(name) > 0 AND length(name) <= 100)
);

CREATE INDEX idx_spaces_created_at ON spaces(created_at);
```

## UI Requirements

- **Home Screen**: Shows list of all spaces with item count badge
- **Create Space Dialog**: Simple text input with Save/Cancel buttons
- **Space Detail Screen**: Shows space name as header, displays items related to this space (when item feature exists)
- **Empty State**: When no spaces exist, show message "No spaces yet. Create one to get started."
- **Delete Confirmation**: Modal asking "Are you sure you want to delete [space name]?"

## Success Criteria

- ✅ User can create a space with a valid name
- ✅ Created spaces persist after app restart
- ✅ User can see all spaces listed on home screen
- ✅ User can view individual space details
- ✅ User can delete a space with confirmation
- ✅ Space validation prevents empty names
- ✅ Item count displays correctly for each space
- ✅ No critical errors or crashes during space operations
- ✅ Database schema matches specification
- ✅ All acceptance scenarios pass manual testing

## Dependencies

- React Native UI components (buttons, text input, list, modals) — already available in Expo
- SQLite database initialized and available
- Repository pattern implementation available

## Out of Scope

- Reordering spaces
- Editing space names after creation
- Space categories or tags
- Syncing spaces to cloud
- Photo/icon for spaces (V2 feature)
- Sharing spaces with other users

## Assumptions

- Single user only (no authentication needed)
- Space names are case-sensitive (e.g., "Home" and "home" are different)
- Duplicate space names are allowed
- Deleting a space should prompt the user; exact behavior of items when space is deleted will be defined in item management spec
- "Home", "Office", "Dorm", "Car" are suggested examples but users can create any space name

## Notes for Implementation

- Service layer should validate space name before calling repository
- Repository should use parameterized SQL to prevent injection
- Use UUID for space IDs (not auto-increment)
- Timestamps should use ISO 8601 format
- Keep space creation simple for MVP; no additional metadata beyond name and timestamps
