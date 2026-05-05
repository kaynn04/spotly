# Feature Specification: Create Space

**Feature Branch**: `001-create-space`  
**Created**: 2026-05-05  
**Status**: Draft  
**Input**: User description: "create_space"

## Description

Create a new space stored locally on the device using expo-sqlite. A space represents a physical location where users can organize and track their belongings (e.g., Home, Office, Dorm, Car).

## Core User Story

**As a** user  
**I want to** create a space  
**So that** I can organize my items by location

## Inputs & Outputs

**Input**:
- `name`: string (required, max 100 characters)

**Output**:
- Space object: `{ id, name, createdAt, updatedAt }`

## Acceptance Criteria (Core Feature)

✅ Name must not be empty  
✅ Name must be trimmed (leading/trailing whitespace removed)  
✅ Name must not exceed 100 characters  
✅ Space is saved to expo-sqlite  
✅ Space is returned after creation  

## Constraints

- **Database**: expo-sqlite only (no ORM)
- **Architecture**: Offline-first (all data persists locally)
- **User Model**: Single-user only (no authentication)
- **Data Format**: All queries use parameterized SQL

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

- **Empty name**: Show validation error, don't create
- **Whitespace-only name** (e.g., "   "): Trim first, then validate as empty
- **Name with leading/trailing spaces**: Trim before saving (e.g., " Home " becomes "Home")
- **Duplicate names**: Allow (same name in different spaces is allowed, user responsibility)
- **Name exactly 100 characters**: Allowed
- **Name exceeds 100 characters**: Validation error, don't create
- **Database error on write**: Return error to user, don't persist
- **Space deletion with items**: Handle per item management spec (separate decision)

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST create a new space with a name input from user
- **FR-002**: System MUST validate that space name is not empty before creating
- **FR-003**: System MUST trim whitespace from space name before validation
- **FR-004**: System MUST validate that space name does not exceed 100 characters
- **FR-005**: System MUST persist spaces to expo-sqlite database using parameterized queries
- **FR-006**: System MUST return created space object with id, name, createdAt, updatedAt fields
- **FR-007**: System MUST display all created spaces in a list view on the home screen
- **FR-008**: System MUST allow users to tap a space to view its details
- **FR-009**: System MUST display item count for each space in the space list
- **FR-010**: System MUST show an empty state message when no spaces exist

### Key Entities

**Space**:
- `id` (UUID, primary key)
- `name` (string, max 100 chars, required, trimmed)
- `createdAt` (ISO 8601 timestamp)
- `updatedAt` (ISO 8601 timestamp)

## API/Data Model

### Space Service Interface

```typescript
interface ISpaceService {
  create(name: string): Promise<Space>; // Validates, trims, persists
  getAll(): Promise<Space[]>;
  getById(id: string): Promise<Space | null>;
  delete(id: string): Promise<void>;
  getSpaceWithItemCount(id: string): Promise<SpaceWithCount | null>;
}

interface Space {
  id: string;
  name: string;
  createdAt: string; // ISO 8601 format
  updatedAt: string; // ISO 8601 format
}

interface SpaceWithCount extends Space {
  itemCount: number;
}

// Input validation happens in Service layer
interface CreateSpaceInput {
  name: string; // Must be provided, will be trimmed, max 100 chars
}
```

### SQLite Schema (expo-sqlite)

```sql
CREATE TABLE IF NOT EXISTS spaces (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK (length(trim(name)) > 0 AND length(name) <= 100)
);

CREATE INDEX IF NOT EXISTS idx_spaces_created_at ON spaces(created_at);
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

## Technical Implementation Notes

### Layer Responsibilities

**Service Layer**:
- Validate name is not empty
- Trim whitespace from name
- Validate name does not exceed 100 characters
- Generate UUID for id
- Call repository to persist
- Return Space object

**Repository Layer**:
- Execute parameterized SQL queries only (no string interpolation)
- Use expo-sqlite database connection
- Map database results to Space objects
- Handle database errors

**Database (expo-sqlite)**:
- Use ISO 8601 format for timestamps
- Enforce schema constraints
- Support offline-first operations

### Key Implementation Details

- Use `import { openDatabaseSync } from 'expo-sqlite'` for expo-sqlite
- Trim name before any validation: `name.trim()`
- Generate IDs using library like `uuid` package
- All SQL queries must use parameterized placeholders (?, NOT string concat)
- Keep MVP simple: no metadata beyond name and timestamps
