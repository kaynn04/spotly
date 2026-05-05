# Feature Specification: Nested Containers

**Feature Branch**: `008-nested-containers`  
**Created**: May 6, 2026  
**Status**: Draft  
**Input**: User description: "Allow users to create containers inside a space, and place items within those containers to better organize and locate belongings."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Create Container in Space (Priority: P1)

User wants to organize items into logical groups (e.g., "Kitchen Items", "Bedroom", "Tools") so they can quickly navigate their space and locate items by category.

**Why this priority**: Creating containers is the foundational action that enables the entire feature. Without this, items cannot be grouped.

**Independent Test**: Can be fully tested by creating a container, verifying it appears in the space detail view with a distinct visual treatment, and confirming it persists in the database.

**Acceptance Scenarios**:

1. **Given** user is viewing a space detail screen, **When** user taps the "Add Container" button, **Then** a modal appears with a text input for container name
2. **Given** the add container modal is open, **When** user enters "Kitchen Items" and taps "Create", **Then** the container is created, modal closes, and "Kitchen Items" appears in the container list
3. **Given** a container has been created, **When** user navigates away and returns to the space, **Then** the container is still visible (data persisted)
4. **Given** user taps "Create" without entering a name, **When** the form is submitted, **Then** an error alert appears saying "Container name cannot be empty"

---

### User Story 2 - Add Items to Container (Priority: P1)

User wants to place items into containers (e.g., put "Plates", "Cups", "Forks" into the "Kitchen Items" container) so they can organize and group related items.

**Why this priority**: Adding items to containers is equally critical to container creation. Together, these P1 stories form the MVP.

**Independent Test**: Can be fully tested by creating a container, adding items to that container, verifying items appear grouped under the container, and confirming data persistence.

**Acceptance Scenarios**:

1. **Given** a container exists in the space, **When** user taps the "Add Item" button within/near the container, **Then** a modal appears for entering item name with a note indicating which container will contain it
2. **Given** the add item modal is open and container is selected, **When** user enters "Plates" and taps "Add Item", **Then** the item appears in the container, is grouped visually under the container name, and modal closes
3. **Given** items exist in multiple containers, **When** user views the space detail screen, **Then** items are displayed grouped by their container with a visual indicator (e.g., indentation, grouping header)
4. **Given** user taps "Add Item" without selecting a container, **When** the item is created, **Then** it goes to the space root level (not in any container)

---

### User Story 3 - View Items Grouped by Container (Priority: P1)

User wants to see items organized by container on the space detail screen so they can quickly scan and understand what items are in which group.

**Why this priority**: Display/visualization is essential for the feature to be useful. Without seeing the grouping, containers add no value.

**Independent Test**: Can be fully tested by creating multiple containers with multiple items each, then verifying the display shows proper grouping with visual hierarchy.

**Acceptance Scenarios**:

1. **Given** a space has 3 containers with 2 items each, **When** user views the space detail screen, **Then** containers appear as headers/sections with their items grouped underneath
2. **Given** a container has items and there are also space-level items, **When** user views the space, **Then** space-level items appear separately (either at top or in "Uncategorized" section)
3. **Given** a space has many containers, **When** user scrolls the list, **Then** all containers remain scrollable without performance degradation
4. **Given** a container has no items, **When** user views the space, **Then** the empty container still appears but may show "No items in this container" message

---

### Edge Cases

- What happens when user creates two containers with the same name? (Allow it - containers are distinguished by ID)
- What if user has a large number of containers (e.g., 50+)? (List should remain scrollable and performant)
- Can user move an item from space-level to a container? (Out of scope for v1 - not editing/deleting containers)
- What if a container is accidentally created with a typo? (Out of scope for v1 - no editing)

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST allow users to create a new container within a space with a name
- **FR-002**: System MUST store containers with a unique ID, associated space ID, name, and creation date
- **FR-003**: System MUST allow users to create items and assign them to either space-level or a specific container
- **FR-004**: System MUST store items with an optional container ID (null = space-level item)
- **FR-005**: System MUST display items grouped by their container on the space detail screen
- **FR-006**: System MUST display space-level items separately from containerized items
- **FR-007**: System MUST validate container names are not empty before creation
- **FR-008**: System MUST validate item names are not empty before creation (existing requirement, extends to containers)
- **FR-009**: System MUST prevent duplicate action submissions (debounce create container/item actions)
- **FR-010**: System MUST handle errors gracefully and show user-friendly error messages

### Key Entities

- **Container**: Represents a logical grouping of items within a space
  - Attributes: `id` (UUID), `spaceId` (FK), `name` (string), `createdAt` (timestamp)
  - Relationships: One container belongs to one space; one space has many containers
  - Constraints: Container name required, container name max 50 characters (reasonable default)

- **Item** (updated): Existing entity, now includes optional container relationship
  - Updated attributes: Add `containerId` (UUID, nullable) - references Container.id if item is in a container
  - Backward compatibility: Existing items have `containerId` = null (space-level)

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can create a container and see it appear on the space detail screen within 2 seconds
- **SC-002**: Users can add 10+ items to containers without performance degradation (< 1 second per action)
- **SC-003**: Containers and their items are permanently persisted (survives app close/reopen)
- **SC-004**: Items display correctly grouped by container with clear visual hierarchy (at least 2 distinct visual levels)
- **SC-005**: Container creation and item addition have zero unhandled errors in normal usage (all errors caught and displayed to user)
- **SC-006**: Users can manage 50+ containers and 500+ items per space without UI lag or crashes

## Assumptions

- Users expect containers to be creatable inline (modal or in-place) rather than requiring complex workflows
- Container names are typically short (5-30 characters) and don't require special characters
- Visual grouping can be achieved with indentation, color, or section headers without complex animations
- No need for container editing/deleting in v1 - focus on creation and organization
- Items can belong to at most one container (not multiple containers)
- Container hierarchy is one level deep (no containers within containers)
- Existing Move Item functionality between spaces should extend to support moving items between containers (future consideration)
- SQLite supports the hierarchical queries needed for grouped display efficiently
- No real-time sync needed - local-first, single-device model sufficient
