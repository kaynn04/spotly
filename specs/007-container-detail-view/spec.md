# Feature Specification: Container Detail View with Breadcrumb Navigation

**Feature Branch**: `009-container-detail-view`  
**Created**: May 6, 2026  
**Status**: Draft  
**Input**: User request: "For containers, instead of dropdown, can we make it to open a new page and display all the items inside of it. Add also a indication on where is the user currently like they can also click it if they want to go back to the main space or the container in a space"

## User Scenarios & Testing

### User Story 1 - Navigate to Container Detail View (Priority: P1)

User wants to click on a container in the space detail view and see a full page dedicated to that container's items, replacing the dropdown expansion mechanism.

**Why this priority**: Improves UX by providing dedicated screen real estate for viewing container items with full navigation capabilities.

**Acceptance Scenarios**:

1. **Given** user is viewing space detail screen with containers, **When** user taps a container name/card, **Then** app navigates to a new Container Detail page showing the container name and all items in that container
2. **Given** user is on Container Detail page, **When** items are displayed, **Then** each item shows the same interaction options as space-level items (move, delete)
3. **Given** a container has no items, **When** user views Container Detail page, **Then** a "No items in this container" message appears with a prominent "Add Item" button
4. **Given** user is on Container Detail page, **When** user presses device back button, **Then** app navigates back to the space detail screen

---

### User Story 2 - Breadcrumb Navigation (Priority: P1)

User wants to see their current location in the navigation hierarchy (Space > Container) and be able to click breadcrumbs to navigate to parent levels.

**Why this priority**: Essential UX pattern for understanding context and navigating back without using device back button.

**Acceptance Scenarios**:

1. **Given** user is on Container Detail page, **When** page loads, **Then** a breadcrumb appears at the top showing "Space Name > Container Name"
2. **Given** breadcrumb is displayed, **When** user taps "Space Name" in breadcrumb, **Then** app navigates back to space detail screen
3. **Given** breadcrumb is displayed, **When** user taps "Container Name" in breadcrumb, **Then** nothing happens (current location)
4. **Given** user is on space detail screen, **When** page loads, **Then** breadcrumb shows only "Space Name" (no parent to click)
5. **Given** breadcrumb shows multiple clickable segments, **When** user taps any parent segment, **Then** app navigates to that level with proper state restoration

---

### User Story 3 - Container Item Management (Priority: P1)

User wants to add, move, and delete items while viewing a container's detail page, maintaining the same functionality as the space detail page.

**Acceptance Scenarios**:

1. **Given** user is on Container Detail page, **When** user taps "Add Item" button, **Then** a modal appears for entering item name and the item is automatically added to this container
2. **Given** user is on Container Detail page with multiple items, **When** user taps "Move" on an item, **Then** a modal appears showing other spaces and the item is moved to the selected space (leaving the container)
3. **Given** user is on Container Detail page, **When** user taps "Delete" on an item, **Then** a confirmation dialog appears and item is deleted on confirmation
4. **Given** item is moved from container to another space, **When** Container Detail page reloads, **Then** the item no longer appears in the list

---

## Requirements

### Functional Requirements

- **FR-001**: System MUST create a new Container Detail Screen accessible via `/container/[id]` route
- **FR-002**: System MUST display all items in a container on the Container Detail Screen
- **FR-003**: System MUST display a breadcrumb navigation showing the navigation path (Space > Container)
- **FR-004**: System MUST allow users to click breadcrumb segments to navigate to parent levels
- **FR-005**: System MUST prevent clicking the current location breadcrumb segment (disable interaction)
- **FR-006**: System MUST support adding items directly to a container from the Container Detail Screen
- **FR-007**: System MUST support moving and deleting items from Container Detail Screen
- **FR-008**: System MUST maintain item state when navigating between space and container views
- **FR-009**: System MUST update Space Detail Screen to navigate to Container Detail on container tap (instead of expand/collapse)
- **FR-010**: System MUST remove expand/collapse functionality for containers in Space Detail Screen

### UI Requirements

- **UI-001**: Breadcrumb navigation must be placed prominently at the top of Container Detail Screen
- **UI-002**: Breadcrumb segments must be styled differently (current vs clickable parents)
- **UI-003**: Container name must be displayed as page title/header
- **UI-004**: FAB (Floating Action Button) for quick item addition should be available on Container Detail Screen
- **UI-005**: Item count badge should be visible in space detail container card (existing feature, keep)

### Data Model Requirements

- **DM-001**: No database changes required - use existing Container and Item relationships
- **DM-002**: Item.containerId remains the primary relationship
- **DM-003**: Container.spaceId remains the space relationship

---

## Implementation Notes

### Navigation Flow

```
Space List (/)
    ↓
Space Detail (/space/[id])
    ↓
Container Detail (/container/[id]) ← NEW
```

### Architecture Decisions

1. **Breadcrumb Component**: Create reusable `<Breadcrumb>` component that accepts path array and handles navigation
2. **Container Detail Screen**: Mirror Space Detail structure but focused on single container
3. **State Management**: Maintain consistent item/container loading patterns used in Space Detail
4. **Navigation**: Use Expo Router's dynamic routes for `/container/[id]`

---

## Out of Scope

- Nested containers beyond one level (already out of scope per 008-nested-containers)
- Reordering items within container
- Moving items between containers (within same space)
- Editing container names
- Editing item details

---

## Dependencies

- Feature `008-nested-containers` must be complete (containers, items relationship)
- Expo Router dynamic routing capability
- Existing ItemService, ContainerService, SpaceService APIs

---

## Success Criteria

- ✅ Container Detail page loads and displays correct items
- ✅ Breadcrumb navigation appears and is clickable
- ✅ Can add items from Container Detail page
- ✅ Can move/delete items from Container Detail page
- ✅ Space Detail page shows containers as clickable cards (not expandable)
- ✅ Navigation between space and container pages is smooth
- ✅ Device back button works correctly
- ✅ State is preserved when navigating back and forth
