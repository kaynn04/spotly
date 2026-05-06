# Implementation Plan: Container Detail View with Nested Containers

**Branch**: `007-container-detail-view-with-nested-containers` | **Date**: May 6, 2026
**Status**: Ready for Implementation  
**Sprint**: Current

## Overview

Implement nested containers feature allowing users to organize items into logical groups within spaces. Includes container creation, item grouping, container detail screen with breadcrumb navigation for improved UX. Users can create containers, add items to containers, view grouped items on space detail screen, and navigate to a dedicated container detail page with breadcrumb navigation.

## Architecture

### New Routes

```
/container/[id].tsx  ← Container Detail Screen (NEW)
```

### New Components

```
components/breadcrumb.tsx  ← Reusable breadcrumb navigation
```

### Modified Routes

```
/space/[id].tsx  ← Update to navigate instead of expand
```

## Implementation Phases

### Phase 1: Breadcrumb Component

1. Create `components/breadcrumb.tsx`
   - Accept array of breadcrumb items: `{ label: string; routerPath?: string; params?: any }`
   - Render segments separated by "/"
   - Make segments clickable (except current/last segment)
   - Use existing router for navigation

### Phase 2: Container Detail Screen

1. Create `/app/container/[id].tsx`
   - Accept container ID from route params
   - Load container details, space details, and items
   - Mirror Space Detail Screen layout:
     - Header with back button
     - Breadcrumb showing: Space Name > Container Name
     - FlatList of items with move/delete buttons
     - FAB for adding items
     - Modals for add item, move item, delete confirmation
   - Reuse ItemService and ContainerService

### Phase 3: Update Space Detail Screen

1. Modify `/app/space/[id].tsx`
   - Remove expand/collapse logic for containers
   - Change container press to navigate to `/container/[id]`
   - Keep container cards showing item count
   - Remove `expandedContainerId` state (no longer needed)
   - Simplify container rendering

### Phase 4: Testing & Polish

1. Test navigation flows:
   - Space → Container → Space
   - Breadcrumb clicks
   - Device back button
   - Item operations (add, move, delete)

2. Verify state management:
   - Items update correctly
   - Lists refresh on navigation return
   - No stale data displayed

## Code Structure

### Breadcrumb Component

```typescript
interface BreadcrumbItem {
  label: string;
  routerPath?: string;
  params?: any;
}

export function Breadcrumb({ items }: { items: BreadcrumbItem[] }) {
  // Render breadcrumb with clickable segments
}
```

### Container Detail Screen

```typescript
export default function ContainerDetailScreen() {
  const { id: containerId } = useLocalSearchParams<{ id: string }>();
  const [container, setContainer] = useState<Container | null>(null);
  const [space, setSpace] = useState<Space | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  // ... UI similar to Space Detail but focused on one container
}
```

### Space Detail Screen Changes

```typescript
// OLD:
<Pressable onPress={() => handleContainerPress(container.id)}>
  {/* render items if expanded */}
</Pressable>

// NEW:
<Pressable onPress={() => router.push({
  pathname: '/container/[id]',
  params: { id: container.id }
})}>
  {/* show container card with item count */}
</Pressable>
```

## File Changes Summary

| File | Change | Lines |
|------|--------|-------|
| `components/breadcrumb.tsx` | CREATE | ~50 |
| `app/container/[id].tsx` | CREATE | ~400 |
| `app/space/[id].tsx` | MODIFY | ~-100 (remove expand logic) |

## Testing Checklist

- [ ] Navigate from space to container
- [ ] Breadcrumb displays correctly on container page
- [ ] Click breadcrumb to go back to space
- [ ] Add item to container from detail page
- [ ] Move item from container to another space
- [ ] Delete item from container
- [ ] Device back button navigates correctly
- [ ] No items shown when container is empty
- [ ] Item counts accurate in space view

## Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| Navigation state loss | Use Expo Router's useFocusEffect to reload data |
| Stale data after operations | Refresh containers/items on screen focus |
| Performance with many items | FlatList already handles virtualization |
| Breaking existing 008 feature | Only change container display, keep data model |

## Rollback Plan

If issues arise:
1. Revert `/app/space/[id].tsx` to previous version (with expand/collapse)
2. Delete `/app/container/[id].tsx`
3. Delete `components/breadcrumb.tsx`
4. No database migrations required (no data model changes)

## Estimated Effort

- Breadcrumb component: 1-2 hours
- Container Detail Screen: 2-3 hours
- Update Space Detail Screen: 1 hour
- Testing & Polish: 1-2 hours
- **Total: 5-8 hours**

## Success Criteria

- Container Detail page displays with proper styling
- Breadcrumb navigation works in both directions
- All item operations (add, move, delete) work from container detail
- No regression in existing container functionality
- Navigation feels smooth and responsive
