# Feature Specification: Add Item

**Feature Branch**: `004-add-item`  
**Created**: 2026-05-05  
**Status**: Draft  
**Depends On**: [001-create-space](../001-create-space/spec.md), [002-view-space-details](../002-view-space-details/spec.md)

## Description

Allow users to add items to a space. Users can create items with a name and associate them with a specific space. Items are stored locally in SQLite and appear in the space detail view.

## User Story

**As a** user  
**I want to** add items to a space  
**So that** I can track what belongs to that space

## Inputs & Outputs

**Input**:
- `spaceId`: string (UUID)
- `itemName`: string (item name)

**Output**:
- Item is saved and associated with the space

## Acceptance Criteria

✅ User can add an item from the space detail screen  
✅ Item is stored in SQLite and linked to the space  
✅ Item appears in the space detail screen list  
✅ Multiple items can be added to a space  

## Constraints

- Keep UI simple
- Item only has a name (no description or quantity yet)
- No editing or deleting items for now
- Deletion is permanent when not in scope

---

## User Scenarios & Testing

### Scenario 1: Add Item from Space Detail Screen

**Given** user is viewing a space detail, **When** they add an item with a name, **Then** the item is saved and appears in the list.

**Acceptance**:
1. User sees "Add Item" button on space detail screen
2. Taps button and enters item name (e.g., "Laptop")
3. Taps "Save" or "Add"
4. Item appears in space's item list
5. Item persists after navigation and app restart

### Scenario 2: Multiple Items in Same Space

**Given** a space has one item, **When** user adds a second item, **Then** both items appear in the list.

**Acceptance**:
1. Add first item: "Backpack"
2. Add second item: "Books"
3. Space shows both items
4. Each item displays correct name

### Scenario 3: Item Persistence

**Given** user adds items to a space, **When** they navigate away and restart the app, **Then** all items are still there.

**Acceptance**:
1. Add items to space
2. Navigate away and close app
3. Reopen app and return to space
4. Items are displayed correctly

---

## Key Entities

### Item
- `id`: UUID
- `spaceId`: UUID (foreign key to Space)
- `name`: String
- `createdAt`: DateTime
- `updatedAt`: DateTime

---

## Requirements

### Functional Requirements

- **FR-001**: User can add item from space detail screen
- **FR-002**: Item name is required (cannot be empty)
- **FR-003**: Item is stored in SQLite with unique UUID id
- **FR-004**: Item is associated with correct spaceId (foreign key)
- **FR-005**: Item appears in space detail screen list after creation
- **FR-006**: Item has createdAt and updatedAt timestamps
- **FR-007**: Multiple items can be added to same space
- **FR-008**: Item data persists across app restarts

### Data Requirements

- Item record created with parameterized SQL
- Foreign key relationship: Item.spaceId → Space.id
- Timestamps in ISO 8601 format

### Error Handling

- **ERR-001**: If item name is empty or whitespace-only, show alert: "Item name cannot be empty" and keep form open
- **ERR-002**: If database insertion fails, show error alert and keep form open for retry
- **ERR-003**: User can dismiss error and either retry or navigate away

**Item**: Represents a physical object stored in a space. Items belong to exactly one space.

- `id`: UUID (unique, immutable, generated at creation)
- `spaceId`: UUID (immutable, references Space.id, required)
- `name`: String (1-100 characters, required, trimmed)
- `quantity`: Number (positive integer, 1-999,999, required)
- `createdAt`: ISO 8601 timestamp (UTC, immutable, set at creation)
- `updatedAt`: ISO 8601 timestamp (UTC, set at creation, updated on future modifications)

**Database Table Schema**:
```sql
CREATE TABLE IF NOT EXISTS items (
---

## Clarifications

### Session 2026-05-05
- Q: Item list display on detail screen → A: Display items in FlatList below space details on same screen
- Q: Empty name validation → A: Show error alert, keep form open for retry

### Items Table (SQLite)

```sql
CREATE TABLE items (
  id TEXT PRIMARY KEY,
  spaceId TEXT NOT NULL,
  name TEXT NOT NULL,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  FOREIGN KEY (spaceId) REFERENCES spaces(id) ON DELETE CASCADE
);
```

---

## API/Service Contract

### ItemService

```typescript
interface ItemService {
  createItem(spaceId: string, name: string): Promise<Item>
}

interface Item {
  id: string
  spaceId: string
  name: string
  createdAt: string
  updatedAt: string
}
```

### ItemRepository

```typescript
interface ItemRepository {
  create(item: Item): Promise<Item>
}
```

---

## UI Requirements

- Add Item button/input on space detail screen
- Simple form with name input field
- Save button to create item
- **Item list displayed inline below space details using FlatList**:
  - Shows all items for that space
  - Each item displays name only
  - New items appear immediately after creation

---

## Success Criteria

- ✅ User can add item with name from space detail screen
- ✅ Item is saved to SQLite and linked to space
- ✅ Item appears immediately in space item list
- ✅ Multiple items can be added to same space
- ✅ Item data persists after app restart
- ✅ No empty item names allowed

---

## Dependencies

- [001-create-space](../001-create-space/spec.md)
- [002-view-space-details](../002-view-space-details/spec.md)

---

## Out of Scope

- Edit items
- Delete items  
- Item descriptions
- Item categories
- Item search/filtering
- Batch operations

---

## Assumptions

- Item only has a name (no quantity, description, or other properties for MVP)
- Single-user, offline-only
- No external APIs or network calls needed
