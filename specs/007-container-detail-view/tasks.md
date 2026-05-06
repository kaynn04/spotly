# Implementation Tasks: Container Detail View with Breadcrumb Navigation

**Feature**: 009-container-detail-view  
**Date**: May 6, 2026  
**Status**: Ready

## Task Breakdown

### T001: Create Breadcrumb Component

**Description**: Build a reusable breadcrumb navigation component that displays navigation path and allows navigation to parent levels.

**Implementation Details**:
- Create `app/components/breadcrumb.tsx`
- Accept props: `items: Array<{ label: string; onPress?: () => void }>`
- Render segments separated by "/"
- Style current segment (not clickable, bold/highlighted)
- Style parent segments (clickable, normal weight)
- Handle empty states

**Acceptance Criteria**:
- [ ] Component renders breadcrumb items separated by "/"
- [ ] Parent items are clickable and call onPress callback
- [ ] Current item (last) is not clickable
- [ ] Styling distinguishes current vs clickable items
- [ ] Component handles variable number of items

**Effort**: 1.5 hours

---

### T002: Create Container Detail Screen

**Description**: Build the Container Detail Screen to display all items in a container with full management capabilities.

**Implementation Details**:
- Create `app/container/[id].tsx`
- Route params: `id` (container ID)
- Load: container details, associated space, all items in container
- UI Elements:
  - Header with back button
  - Breadcrumb: Space Name > Container Name
  - Container title
  - FlatList of items (similar to space detail)
  - FAB for adding items
  - Modals: add item, move item, delete confirmation
- Reuse services: ContainerService, SpaceService, ItemService
- Use useFocusEffect to refresh data on return

**Acceptance Criteria**:
- [ ] Container details load and display correctly
- [ ] All items in container are shown
- [ ] Breadcrumb displays with correct space/container names
- [ ] FlatList renders with proper styling
- [ ] FAB displays and opens add item modal
- [ ] Move and delete buttons functional
- [ ] Data refreshes when screen receives focus
- [ ] Header back button works

**Effort**: 3 hours

**Dependencies**: T001 (Breadcrumb component)

---

### T003: Update Space Detail Screen - Remove Expand/Collapse

**Description**: Modify the Space Detail Screen to replace container expand/collapse with navigation to Container Detail page.

**Implementation Details**:
- Remove `expandedContainerId` state
- Remove `handleContainerPress` and `handleContainerExpand` logic
- Update container card press handler to navigate:
  ```typescript
  onPress={() => router.push({
    pathname: '/container/[id]',
    params: { id: container.id }
  })}
  ```
- Remove conditional rendering of container items
- Keep container card styling and item count display
- Remove nested item rendering logic (that was in expanded view)
- Simplify container rendering to just card display

**Acceptance Criteria**:
- [ ] Container cards no longer expand inline
- [ ] Tapping container navigates to Container Detail page
- [ ] Container cards still show item count
- [ ] No expand/collapse UI elements remain
- [ ] Space detail screen still shows all containers
- [ ] Navigation works smoothly

**Effort**: 1 hour

**Dependencies**: T002 (Container Detail Screen must exist)

---

### T004: Add Breadcrumb to Space Detail Screen

**Description**: Add breadcrumb navigation to Space Detail Screen showing current space.

**Implementation Details**:
- Import Breadcrumb component in Space Detail Screen
- Add breadcrumb at top of page:
  - Single item: "Space Name"
  - No parent to click (it's the top level)
- Position breadcrumb in header area above space title
- Use Breadcrumb component with single item and no click handler

**Acceptance Criteria**:
- [ ] Breadcrumb appears at top of space detail screen
- [ ] Shows only "Space Name"
- [ ] Is not clickable (disabled state or no onPress)
- [ ] Styling matches container detail breadcrumb

**Effort**: 0.5 hours

**Dependencies**: T001 (Breadcrumb component), T003 (Space Detail updated)

---

### T005: Test Navigation Flow

**Description**: Comprehensive testing of navigation between space and container views.

**Test Cases**:
1. **Navigate to Container**:
   - [ ] From space detail, tap container
   - [ ] Container detail page loads with correct data
   - [ ] Breadcrumb shows correct path

2. **Navigate Back via Breadcrumb**:
   - [ ] On container detail, tap space name in breadcrumb
   - [ ] Returns to space detail page
   - [ ] Space data is intact

3. **Navigate Back via Back Button**:
   - [ ] On container detail, press device back button
   - [ ] Returns to space detail page

4. **Item Operations**:
   - [ ] Add item to container from detail page
   - [ ] Item appears in list
   - [ ] Move item from container to another space
   - [ ] Delete item from container
   - [ ] All operations refresh the list

5. **Data Persistence**:
   - [ ] Navigate away and back
   - [ ] Data loads correctly
   - [ ] No stale data displayed

6. **Empty States**:
   - [ ] Empty container shows "No items" message
   - [ ] Empty space shows appropriate message

**Effort**: 2 hours

**Dependencies**: T001, T002, T003, T004

---

### T006: Code Review & Polish

**Description**: Review code for quality, performance, and consistency.

**Checklist**:
- [ ] Code follows project style conventions
- [ ] No console errors or warnings
- [ ] Performance acceptable (FlatList optimization)
- [ ] Styling consistent with existing screens
- [ ] Comments added for complex logic
- [ ] Error handling proper (alerts on failures)
- [ ] Loading states handled
- [ ] Accessibility considered (text colors, sizes)

**Effort**: 1 hour

**Dependencies**: T001, T002, T003, T004, T005

---

## Task Execution Order

1. **T001** - Breadcrumb Component (foundation)
2. **T002** - Container Detail Screen (new feature)
3. **T003** - Update Space Detail Screen (breaking change)
4. **T004** - Add Breadcrumb to Space Detail (polish)
5. **T005** - Test Navigation Flow (validation)
6. **T006** - Code Review & Polish (quality)

## Blockers & Dependencies

- No external blockers
- All feature dependencies (008-nested-containers) already complete
- No database migrations needed

## Success Metrics

- ✅ All tasks completed
- ✅ No navigation regressions
- ✅ Breadcrumb navigation working in both directions
- ✅ Item operations work from both space and container views
- ✅ Code review approved
- ✅ Test coverage maintained or improved
