# Implementation Plan: View Space Details

**Feature Branch**: `002-view-space-details`  
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
- React Native built-in components (Button, Text, View, ScrollView)

### Reused Patterns
- **Repository Pattern**: SpaceRepository with parameterized SQL queries
- **Service Layer**: SpaceService for business logic
- **TypeScript Models**: Space interface from existing models
- **Error Handling**: ServiceError pattern from 001-create-space

---

## Constitution Check

✅ **Architecture**: 4-layer architecture maintained (no new layers)  
✅ **Database**: expo-sqlite with parameterized queries (no ORM)  
✅ **Type Safety**: TypeScript strict mode  
✅ **Scope**: MVP focused (view only, no edit/delete)  

---

## Design Decisions

### 1. Navigation Approach
- **Decision**: Expo Router dynamic route `[id].tsx` in new `space` folder
- **Rationale**: Simple, minimal setup. No need for complex stack navigator configuration
- **Alternative Considered**: Stack navigator within tabs (too complex for MVP)

### 2. Data Fetching
- **Decision**: Fetch on screen render using `useEffect`
- **Rationale**: Simple, straightforward pattern matching 001-create-space
- **No caching**: First implementation, optimize later if needed

### 3. Error Handling
- **Decision**: Reuse ServiceError pattern from 001-create-space
- **Behavior**: Show alert on error, navigate back to space list
- **Rationale**: Consistent with existing error handling

### 4. Timestamp Display
- **Decision**: Use `.toLocaleDateString()` for human-readable dates
- **Format**: "May 5, 2026" (locale-aware)
- **Rationale**: Simple, requires no external dependencies

### 5. Navigation Integration
- **Decision**: Tab with nested stack (each tab has own navigator)
- **Rationale**: Standard React Native pattern, integrates with existing structure

---

## Phase 1: Core Repository & Service Methods

### T001: Repository - getSpaceById
**File**: `app/src/repositories/SpaceRepository.ts`

Add new method:
```typescript
static async getSpaceById(id: string): Promise<Space | null>
```

**Implementation**:
- Execute: `SELECT id, name, created_at, updated_at FROM spaces WHERE id = ?`
- Parameterized query with `id`
- Map snake_case to camelCase
- Return Space object or null if not found
- Throw ServiceError on database error

**Acceptance**: Returns correct Space object when space exists; returns null when not found

---

### T002: Service - getSpaceDetails
**File**: `app/src/services/SpaceService.ts`

Add new method:
```typescript
static async getSpaceDetails(id: string): Promise<Space | null>
```

**Implementation**:
- Validate id is not empty/null
- Call `SpaceRepository.getSpaceById(id)`
- Return Space object or null
- Throw ServiceError if validation fails

**Acceptance**: Returns Space when id is valid; throws VALIDATION_ERROR for invalid id

---

## Phase 2: Navigation & Screen

### T003: Create Dynamic Route Handler
**File**: `app/src/screens/space/[id].tsx`

New screen component: `SpaceDetailScreen`

**Implementation**:
- Use `useLocalSearchParams()` to get `id` from route
- Use `useEffect` to fetch space on mount
- Display space name and created date
- Show error alert if space not found (then navigate back)
- Back button returns to previous screen

**Props**: None (all data from params and database)

**Acceptance**: Displays correct space details for any valid space id

---

### T004: Update Space List Screen - Add Tap Navigation
**File**: `app/src/screens/SpaceScreen.tsx`

Update existing `renderSpaceItem` function:

**Change**:
- Wrap space item in `Pressable` component
- On press: navigate to `space/${space.id}` using router
- Use `href` prop for navigation

**Acceptance**: Tapping a space navigates to detail view with correct id

---

### T005: Create Error Alert Handler
**File**: `app/src/screens/space/[id].tsx` (part of T003)

**Implementation**:
- Catch space not found (null return)
- Show Alert: "Space not found"
- Navigate back to list on alert dismiss
- Catch ServiceError and show error message

**Acceptance**: User sees error and returns to list when space doesn't exist

---

## Phase 3: UI Polish (Optional for MVP)

### T006: Format Date Display
**File**: `app/src/screens/space/[id].tsx`

**Implementation**:
- Format `createdAt` using `.toLocaleDateString()`
- Display as: "Created on [Date]"
- Example: "Created on May 5, 2026"

**Acceptance**: Date displays in readable format, not ISO string

---

## Implementation Order

1. ✅ **T001**: Repository.getSpaceById - Core data access
2. ✅ **T002**: Service.getSpaceDetails - Business logic
3. ✅ **T003**: Dynamic route screen [id].tsx - View component with error handling
4. ✅ **T004**: Update SpaceScreen navigation - Link from list to detail
5. ✅ **T005**: Error handling (part of T003)
6. ✅ **T006**: Date formatting (part of T003)

**Total: 4 implementation tasks**

---

## Success Criteria

- ✅ User can tap space from list and see details
- ✅ Detail view shows: space name, creation date
- ✅ Back button returns to space list
- ✅ Error handling for non-existent spaces
- ✅ Navigation works after app restart
- ✅ All database queries use parameterized SQL
- ✅ <1 second navigation time
- ✅ No TypeScript errors

---

## Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| Expo Router not configured | Use simple dynamic route pattern, test early |
| Performance | SQLite queries are fast; no caching needed for MVP |
| Navigation state loss | React Navigation handles by default |
| Space deleted between screens | Show error alert and navigate back |

---

## Dependencies

### External
- expo-router (installed)
- React Native built-in (View, Text, Button, Alert)

### Internal
- SpaceRepository.getSpaceById (to create)
- SpaceService.getSpaceDetails (to create)
- Space model (existing)
- SpaceScreen.tsx (to update)

### Feature Dependencies
- 001-create-space (completed) - provides Space entity and list screen

---

## Out of Scope (V2+)

- Editing space details
- Deleting spaces
- Viewing items in space
- Caching or performance optimization
- Loading indicators
- Pull-to-refresh
- Pagination
- Search/filter spaces
