# Tasks: Add Item

**Feature**: Add Item  
**Feature Branch**: `004-add-item`  
**Spec**: [spec.md](./spec.md)  
**Plan**: [plan.md](./plan.md)  
**Created**: 2026-05-05

---

## Overview

**Total Tasks**: 6 (Minimal MVP)

**Scope**: Items table, repository/service methods, UI to add and display items

**Out of Scope**: Testing, edge cases, editing, deleting, advanced validation

---

## Implementation Tasks

### Phase 1: Database & Models

- [x] T001 Create Item TypeScript model in `app/src/models/Item.ts` with id, spaceId, name, createdAt, updatedAt properties
- [x] T002 Add items table to database migration in `app/src/db/migrations.ts` with spaceId foreign key

### Phase 2: Backend (Repository & Service)

- [x] T003 Create ItemRepository in `app/src/repositories/ItemRepository.ts` with createItem and getItemsBySpaceId methods
- [x] T004 Create ItemService in `app/src/services/ItemService.ts` with createItem and getItemsBySpaceId methods

### Phase 3: Frontend (UI Integration)

- [x] T005 Update SpaceDetailScreen in `app/app/space/[id].tsx` to fetch and display items in FlatList below space details
- [x] T006 Add TextInput and Button to SpaceDetailScreen to create new items, call service, and update list

---

## Task Completion Guide

### T001: Create Item TypeScript Model
**File**: `app/src/models/Item.ts`

**Acceptance Criteria**:
- ✅ Item interface has properties: id, spaceId, name, createdAt, updatedAt
- ✅ ItemRow interface for database snake_case mapping
- ✅ ServiceError type exported
- ✅ Types are exported for use in other files

**Test**: Import Item interface in other files without errors

---

### T002: Add Items Table to Database Migration
**File**: `app/src/db/migrations.ts`

**Acceptance Criteria**:
- ✅ CREATE TABLE IF NOT EXISTS items with correct schema
- ✅ Columns: id (TEXT PRIMARY KEY), spaceId (TEXT NOT NULL), name (TEXT NOT NULL), created_at (TEXT NOT NULL), updated_at (TEXT NOT NULL)
- ✅ Foreign key constraint: FOREIGN KEY (spaceId) REFERENCES spaces(id) ON DELETE CASCADE
- ✅ Table is created when database initializes

**Test**: Verify table exists in database after app starts

---

### T003: Create ItemRepository
**File**: `app/src/repositories/ItemRepository.ts`

**Acceptance Criteria**:
- ✅ `static async createItem(name: string, spaceId: string): Promise<Item>` method
  - Generates UUID for id
  - Inserts into items table with parameterized query
  - Returns Item object
  - Throws ServiceError on failure
- ✅ `static async getItemsBySpaceId(spaceId: string): Promise<Item[]>` method
  - Queries items table WHERE spaceId = ?
  - Orders by created_at DESC
  - Maps snake_case to camelCase
  - Returns array of Item objects
  - Throws ServiceError on failure

**Test**: Create item and verify it exists in database; fetch items for space

---

### T004: Create ItemService
**File**: `app/src/services/ItemService.ts`

**Acceptance Criteria**:
- ✅ `static async createItem(spaceId: string, name: string): Promise<Item>` method
  - Validates name is not empty after trim
  - Calls ItemRepository.createItem(name, spaceId)
  - Returns Item
  - Throws ServiceError on validation failure or database error
- ✅ `static async getItemsBySpaceId(spaceId: string): Promise<Item[]>` method
  - Calls ItemRepository.getItemsBySpaceId(spaceId)
  - Returns items array
  - Throws ServiceError on failure

**Test**: Call service methods and verify they work correctly

---

### T005: Display Items FlatList on Detail Screen
**File**: `app/app/space/[id].tsx`

**Acceptance Criteria**:
- ✅ Add state: `const [items, setItems] = useState<Item[]>([])`
- ✅ Add useEffect to fetch items when component mounts or space changes
- ✅ Add FlatList component below space details
- ✅ Each FlatList item displays item name
- ✅ FlatList has keyExtractor using item.id

**Test**: Navigate to detail screen and verify items appear in FlatList

---

### T006: Add Item Creation UI
**File**: `app/app/space/[id].tsx`

**Acceptance Criteria**:
- ✅ Add TextInput for item name with placeholder "Add item..."
- ✅ Add Button labeled "Add Item"
- ✅ On button press:
  - Call `ItemService.createItem(id, itemName)`
  - On success: clear input, refresh items list, update FlatList
  - On error: show `Alert.alert('Error', 'Failed to add item')`
- ✅ Input field and button positioned above or below space details
- ✅ No loading indicator (SQLite is instant)

**Test**: Type item name, press Add button, verify item appears in list

---

## Dependencies

- ✅ Feature 001-create-space (spaces exist)
- ✅ Feature 002-view-space-details (detail screen exists)
- ✅ React Native components (TextInput, Button, FlatList)
- ✅ expo-sqlite client configured
- ✅ uuid package (already installed)

---

## Success Criteria (MVP)

- ✅ User can add item from detail screen
- ✅ Item is stored in SQLite with spaceId foreign key
- ✅ Items display in FlatList on detail screen
- ✅ Multiple items appear in list for same space
- ✅ Items persist after app restart
- ✅ Empty name rejected with error alert
- ✅ All database queries use parameterized SQL
- ✅ No TypeScript errors

---

## Notes

- Minimal scope: No testing tasks, no optimization, no advanced UI
- Reuses existing patterns from Space feature
- Error handling uses Alert.alert() (consistent with delete space)
- Item list updates immediately after creation (no background sync needed)
- Keep UI simple: just TextInput + Button + FlatList
