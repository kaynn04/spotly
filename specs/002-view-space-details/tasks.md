# Tasks: View Space Details

**Feature**: View Space Details  
**Branch**: `002-view-space-details`  
**Based On**: [plan.md](./plan.md)  
**Created**: 2026-05-05  
**Status**: Ready to Implement

---

## Phase 1: Data Access Layer

- [ ] T001 Add SpaceRepository.getSpaceById() method in app/src/repositories/SpaceRepository.ts
- [ ] T002 Add SpaceService.getSpaceDetails() method in app/src/services/SpaceService.ts

## Phase 2: UI & Navigation

- [X] T003 Create SpaceDetailScreen at app/src/screens/space/[id].tsx with fetch, display, and error handling
- [X] T004 [P] Update SpaceScreen.tsx renderSpaceItem to wrap in Pressable and navigate to space detail

---

## Task Details

### T001: Repository.getSpaceById

**File**: `app/src/repositories/SpaceRepository.ts`

Add method to SpaceRepository class:
```typescript
static async getSpaceById(id: string): Promise<Space | null>
```

Implementation:
- Execute parameterized query: `SELECT id, name, created_at, updated_at FROM spaces WHERE id = ?`
- Map database row to Space object (snake_case → camelCase)
- Return Space object if found, null if not found
- Throw ServiceError on database error

**Verification**: 
- Returns correct Space for valid id
- Returns null for non-existent id
- Uses parameterized query (no string concatenation)

---

### T002: Service.getSpaceDetails

**File**: `app/src/services/SpaceService.ts`

Add method to SpaceService class:
```typescript
static async getSpaceDetails(id: string): Promise<Space | null>
```

Implementation:
- Validate id is not empty
- Call SpaceRepository.getSpaceById(id)
- Return result (Space or null)
- Throw VALIDATION_ERROR if id is empty
- Let database errors propagate as ServiceError from repository

**Verification**:
- Returns Space for valid id
- Returns null when space doesn't exist
- Throws VALIDATION_ERROR for empty id

---

### T003: SpaceDetailScreen

**File**: `app/src/screens/space/[id].tsx` (new file)

Create new screen component:
```typescript
export default function SpaceDetailScreen()
```

Implementation:
- Use `useLocalSearchParams()` to extract `id` from route
- Use `useRouter()` for navigation
- Use `useEffect` to fetch space on mount
- State: space (Space | null), isLoading, error
- Display: space name (large), created date (human-readable format)
- Back button uses `router.back()`
- Error handling: Show Alert, navigate back on dismiss
- Handle space not found (null return)

**UI Layout**:
- Header with back button and space name
- Text fields: id, name, createdAt (formatted)
- Minimal styling

**Verification**:
- Displays space details when space exists
- Shows "Space not found" alert when space doesn't exist
- Back button returns to previous screen
- Date displays in readable format (e.g., "May 5, 2026")

---

### T004: Update SpaceScreen Navigation

**File**: `app/src/screens/SpaceScreen.tsx`

Update existing `renderSpaceItem` function:

Change from:
```typescript
function renderSpaceItem({ item }: { item: Space }) {
  return (
    <View style={styles.spaceItem}>
      ...
    </View>
  );
}
```

Change to:
```typescript
function renderSpaceItem({ item }: { item: Space }) {
  return (
    <Link href={`/space/${item.id}`} asChild>
      <Pressable style={styles.spaceItem}>
        ...
      </Pressable>
    </Link>
  );
}
```

Or using `useRouter`:
```typescript
const router = useRouter();
...
function renderSpaceItem({ item }: { item: Space }) {
  return (
    <Pressable 
      onPress={() => router.push(`/space/${item.id}`)}
      style={styles.spaceItem}
    >
      ...
    </Pressable>
  );
}
```

**Verification**:
- Tapping a space navigates to detail screen
- Passes correct space id to detail screen
- Navigation works smoothly

---

## Implementation Order

1. **T001** ← Prerequisite for T002
2. **T002** ← Prerequisite for T003
3. **T003** ← Can work in parallel with T004
4. **T004** ← [P] Can work in parallel with T003

**Parallelization**: T003 and T004 can be worked on simultaneously by different developers.

---

## Success Criteria

✅ All parameterized SQL queries  
✅ <1 second navigation  
✅ User can tap space and see details  
✅ Error handling for missing spaces  
✅ TypeScript strict mode compliance  
✅ Dates display in human-readable format  

---

## Out of Scope

- Tests/testing tasks
- Performance optimization
- Loading indicators
- Complex state management
- Pull-to-refresh
- Items count or display
- Edit/delete functionality
- Documentation
- Code comments beyond essential JSDoc
