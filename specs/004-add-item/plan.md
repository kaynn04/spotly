# Implementation Plan: Add Item

**Feature Branch**: `004-add-item`  
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
- React Native built-in components (Button, TextInput, FlatList, Alert)
- `uuid` - Already installed for ID generation

### Reused Patterns
- **Repository Pattern**: ItemRepository (new) following SpaceRepository style
- **Service Layer**: ItemService (new) following SpaceService style
- **TypeScript Models**: Item interface (new) following Space pattern
- **Error Handling**: ServiceError pattern from existing features

---

## Constitution Check

✅ **Architecture**: 4-layer architecture maintained (no new layers)  
✅ **Database**: expo-sqlite with parameterized queries (no ORM)  
✅ **Type Safety**: TypeScript strict mode  
✅ **Scope**: MVP focused (add only, no edit/delete)  
✅ **Navigation**: Expo Router (existing pattern)
✅ **Reusability**: Uses existing patterns from Space feature

---

## Design Decisions

### 1. Item Model
- **Decision**: Item has only: id, spaceId, name, createdAt, updatedAt
- **Rationale**: MVP scope, minimal fields, name-only tracking
- **Future**: Can add quantity, description, category later

### 2. Item Display Location
- **Decision**: Display items in FlatList below space details on same screen
- **Rationale**: Simplest UI, no extra navigation, integrated view
- **Alternative Considered**: Separate items screen (too complex for MVP)

### 3. Add Item UI
- **Decision**: TextInput field + Button on detail screen
- **Rationale**: Simple, inline with space details, no modal complexity
- **Behavior**: Clear input after successful creation

### 4. Validation
- **Decision**: Server-side validation (service layer) only, no client-side validation
- **Rationale**: Keep UI simple, single source of truth for rules
- **Error Handling**: Show Alert.alert() on validation failure

### 5. Empty Name Handling
- **Decision**: Show error alert "Item name cannot be empty", keep form open
- **Rationale**: Consistent with delete space error handling pattern
- **User Action**: User can correct and retry immediately

### 6. List Refresh
- **Decision**: Items list refreshes automatically when item is added
- **Rationale**: State update in component, immediate visual feedback
- **No useFocusEffect needed**: Items won't change when navigating away

---

## Phase 1: Database & Models

### T001: Create Item Model
**File**: `app/src/models/Item.ts`

Add new TypeScript interfaces:
```typescript
interface Item {
  id: string
  spaceId: string
  name: string
  createdAt: string
  updatedAt: string
}

interface ItemRow {
  id: string
  spaceId: string
  name: string
  created_at: string
  updated_at: string
}
```

**Acceptance**: Interfaces compile, types are exported

---

### T002: Create Items Table (Database Migration)
**File**: `app/src/db/migrations.ts`

Add SQL to create items table:
```sql
CREATE TABLE IF NOT EXISTS items (
  id TEXT PRIMARY KEY,
  spaceId TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (spaceId) REFERENCES spaces(id) ON DELETE CASCADE
);
```

**Acceptance**: Table is created when database initializes, foreign key constraint works

---

## Phase 2: Backend (Repository & Service)

### T003: Repository - createItem
**File**: `app/src/repositories/ItemRepository.ts`

Create new file with method:
```typescript
static async createItem(name: string, spaceId: string): Promise<Item>
```

**Implementation**:
- Execute: `INSERT INTO items (id, spaceId, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`
- Generate UUID for id, current ISO timestamp for dates
- Parameterized query with [id, spaceId, name, now, now]
- Return Item object
- Throw ServiceError on database failure

**Acceptance**: Item created with correct data, exists in database

---

### T004: Repository - getItemsBySpaceId
**File**: `app/src/repositories/ItemRepository.ts`

Add new method:
```typescript
static async getItemsBySpaceId(spaceId: string): Promise<Item[]>
```

**Implementation**:
- Execute: `SELECT * FROM items WHERE spaceId = ? ORDER BY created_at DESC`
- Parameterized query with [spaceId]
- Map snake_case to camelCase
- Return array of Item objects
- Throw ServiceError on database failure

**Acceptance**: Returns all items for space in correct order

---

### T005: Service - createItem
**File**: `app/src/services/ItemService.ts`

Create new file with method:
```typescript
static async createItem(spaceId: string, name: string): Promise<Item>
```

**Implementation**:
- Validate name is not empty after trim
- Call ItemRepository.createItem(name, spaceId)
- Return Item
- Throw ServiceError on validation failure

**Acceptance**: Creates item with validation, throws error on invalid name

---

### T006: Service - getItemsBySpaceId
**File**: `app/src/services/ItemService.ts`

Add new method:
```typescript
static async getItemsBySpaceId(spaceId: string): Promise<Item[]>
```

**Implementation**:
- Call ItemRepository.getItemsBySpaceId(spaceId)
- Return items array
- Throw ServiceError on database failure

**Acceptance**: Returns items for space

---

## Phase 3: Frontend (UI & Integration)

### T007: Update Detail Screen - Add Items FlatList
**File**: `app/app/space/[id].tsx`

Update `SpaceDetailScreen` component:

**Changes**:
- Add state: `const [items, setItems] = useState<Item[]>([])`
- Add useEffect to fetch items on mount
- Add FlatList to display items below delete button
- Each item shows name only

**Acceptance**: FlatList renders with items from database

---

### T008: Add Item UI - Input & Button
**File**: `app/app/space/[id].tsx`

Add to detail screen:

**Implementation**:
- Add TextInput for item name
- Add Button to create item
- Handle button press: call `ItemService.createItem(id, itemName)`
- On success: clear input, fetch updated items, show in list
- On error: show Alert.alert() with error message

**Acceptance**: User can type name, press button, item appears in list

---

## Implementation Order

1. ✅ **T001**: Item TypeScript model/interfaces
2. ✅ **T002**: Database migration (create items table)
3. ✅ **T003**: ItemRepository.createItem
4. ✅ **T004**: ItemRepository.getItemsBySpaceId
5. ✅ **T005**: ItemService.createItem
6. ✅ **T006**: ItemService.getItemsBySpaceId
7. ✅ **T007**: FlatList component integration
8. ✅ **T008**: Add item input & button

**Total: 8 implementation tasks (backend + frontend)**

---

## Success Criteria

- ✅ User can add item from detail screen
- ✅ Item is stored in SQLite database
- ✅ Item appears immediately in FlatList
- ✅ Multiple items display in list
- ✅ Items persist after app restart
- ✅ Empty name rejected with error alert
- ✅ All database queries use parameterized SQL
- ✅ No TypeScript errors
- ✅ Creation completes quickly (local DB is fast)

---

## Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| Database table not created | Run migration on app init; check logs |
| Items don't display after creation | Fetch items after creation, update state |
| Empty names accepted | Server-side validation in service layer |
| Database errors | Show error alert, keep form open for retry |
| Performance | SQLite queries are fast for MVP scale |

---

## Notes for Implementation

- Keep validation simple: just check for empty/whitespace
- No length limits for MVP (can add later if needed)
- Use existing error handling patterns from delete space feature
- Item list should update immediately (no background refresh needed)
- Test with multiple items to verify FlatList and persistence
