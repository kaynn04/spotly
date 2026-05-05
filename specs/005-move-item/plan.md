# Implementation Plan: Move Item

**Branch**: `005-move-item` | **Date**: 2026-05-05 | **Spec**: [spec.md](./spec.md)  
**Input**: Feature specification from `/specs/005-move-item/spec.md`

**Note**: Minimal MVP plan - reuses existing repository/service pattern from Feature 004 (add-item)

## Summary

**Primary Requirement**: Allow users to move items between spaces by updating the item's space_id in SQLite and refreshing UI.

**Technical Approach**: 
- Add `ItemRepository.updateSpaceId(itemId, newSpaceId)` with parameterized UPDATE query
- Add `ItemService.moveItem(itemId, newSpaceId)` with validation (newSpaceId ≠ currentSpaceId)
- Add Move button next to each item in FlatList on detail screen
- Add Modal with FlatList to select target space (disable Move button if < 2 spaces)
- Call service on space selection, refresh both source and target space lists on success

**Scope**: Minimal - no history tracking, no drag-drop, no complex animations

## Technical Context

**Language/Version**: TypeScript 5+ with React Native  
**Primary Dependencies**: React Native, Expo Router, expo-sqlite  
**Storage**: SQLite (expo-sqlite) with existing items table  
**Testing**: Manual testing on Expo app (no automated tests in scope)  
**Target Platform**: Mobile (iOS/Android via Expo)  
**Project Type**: Mobile app (Expo/React Native)  
**Performance Goals**: Move completes in <2 seconds (SQLite instant)  
**Constraints**: Offline-first, single-user, no network calls  
**Scale/Scope**: Single space with multiple items (no limits)

## Constitution Check

✅ **Spec-Driven**: Spec completed with 3 clarifications before planning  
✅ **Simplicity First**: Minimal scope - only update space_id, no undo/redo/history  
✅ **Vertical Slice**: Feature works end-to-end: UI → Service → Repository → Database  
✅ **Local-First**: All data persists in SQLite immediately  
✅ **Clean Layers**: UI (Move button/Modal) → Service (validation) → Repository (UPDATE query) → SQLite  

**No violations identified.** Feature aligns with constitution principles.

## Project Structure

### Documentation (this feature)

```text
specs/005-move-item/
├── plan.md              # This file (implementation plan)
├── research.md          # Phase 0 (research - skipped, spec is clear)
├── data-model.md        # Phase 1 (no new entities, only Item.space_id update)
├── quickstart.md        # Phase 1 (quick dev setup)
├── spec.md              # Feature specification
└── checklists/requirements.md
```

### Source Code Changes

```text
app/
├── app/space/[id].tsx             # Add Move button + Modal UI
├── src/
│   ├── repositories/
│   │   └── ItemRepository.ts       # Add updateSpaceId() method
│   └── services/
│       └── ItemService.ts          # Add moveItem() method
```

## Phase 0: Research & Unknowns

**Status**: ✅ Complete - No unknowns remain after clarification

| Question | Resolution |
|----------|-----------|
| Move action trigger? | Move button inline next to item (clarified) |
| Space selection component? | Modal with FlatList (clarified) |
| Edge case (1 space)? | Disable Move button (clarified) |

**No additional research needed.** Spec is unambiguous and implementation is straightforward.

---

## Phase 1: Design & Contracts

### Data Model

**No new entities needed.** Reuse existing Item model.

**Item** (existing - no changes required):
```typescript
interface Item {
  id: string;           // UUID
  name: string;         // Item name
  spaceId: string;      // Foreign key to spaces - THIS IS WHAT WE UPDATE
  createdAt: string;    // ISO 8601 timestamp
}
```

**Database schema** (existing - already supports move):
```sql
-- Already exists from Feature 004
CREATE TABLE items (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  space_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (space_id) REFERENCES spaces(id) ON DELETE CASCADE
);
```

**Move operation** (the update):
```sql
UPDATE items 
SET space_id = ? 
WHERE id = ?
```

### Contracts / API

**ItemRepository**:
- `createItem(name, spaceId)`: Existing (Feature 004) ✅
- `getItemsBySpaceId(spaceId)`: Existing (Feature 004) ✅
- **`updateSpaceId(itemId, newSpaceId)`**: NEW - Parameterized UPDATE query, throws ServiceError

**ItemService**:
- `createItem(spaceId, name)`: Existing (Feature 004) ✅
- `getItemsBySpaceId(spaceId)`: Existing (Feature 004) ✅
- **`moveItem(itemId, currentSpaceId, newSpaceId)`**: NEW - Validates newSpaceId ≠ currentSpaceId, calls repository

**SpaceService** (reuse existing):
- `getAllSpaces()`: Existing - fetch all spaces for Modal list

**UI Components**:
- Move button: Inline button next to item name, disabled if < 2 spaces
- Modal: Shows FlatList of available spaces (all except current space)
- No new custom components needed - reuse Button, Pressable, Modal, FlatList

### Quickstart

**Setup** (already done in Feature 004):
```bash
npm install  # expo-sqlite, uuid, react-native already installed
```

**Dev workflow**:
1. Edit files per task list
2. Expo dev server auto-reloads (`npx expo start -c` already running)
3. Test on iOS/Android simulator or physical device
4. Items move instantly (SQLite local)

**Test scenario**:
1. Create 2+ spaces
2. Add items to Space 1
3. Click Move button on item
4. Select Space 2 from Modal
5. Item disappears from Space 1, appears in Space 2

---

## Implementation Phases

### Phase 1: Backend (Repository + Service)

**Dependency**: Features 001, 004 already complete ✅

1. **Update ItemRepository** (`app/src/repositories/ItemRepository.ts`):
   - Add `updateSpaceId(itemId: string, newSpaceId: string): Promise<void>`
   - SQL: `UPDATE items SET space_id = ? WHERE id = ?` with parameters [newSpaceId, itemId]
   - Throw ServiceError on failure

2. **Update ItemService** (`app/src/services/ItemService.ts`):
   - Add `moveItem(itemId: string, currentSpaceId: string, newSpaceId: string): Promise<void>`
   - Validate: `newSpaceId !== currentSpaceId` (prevent no-op move)
   - Call `ItemRepository.updateSpaceId(itemId, newSpaceId)`
   - Throw ServiceError with appropriate message

**Estimated effort**: 15 minutes (copy pattern from createItem, minimal logic)

### Phase 2: Frontend (UI)

**Dependency**: Phase 1 backend complete

1. **Update SpaceDetailScreen** (`app/app/space/[id].tsx`):
   - Import `SpaceService` (to fetch all spaces for Modal)
   - Import `Modal` component
   - Add state: `const [showMoveModal, setShowMoveModal] = useState(false)`
   - Add state: `const [selectedMoveItemId, setSelectedMoveItemId] = useState<string | null>(null)`
   - Add handler: `handleMovePress(itemId)` - opens Modal, stores selectedMoveItemId
   - Add handler: `handleSelectTargetSpace(targetSpaceId)` - calls `ItemService.moveItem()`, closes Modal, refreshes lists
   - Update FlatList renderItem: Add Move button next to item name
   - Move button: disabled if spaces.length < 2
   - Add Modal component: Shows FlatList of all spaces except currentSpace
   - Modal has Cancel and space list items as selection buttons

**UI Layout**:
```
Item Name              [Move] [Delete]
├─ Modal (conditional)
│  ├─ Title: "Move to space"
│  └─ FlatList of spaces (except current)
│     ├─ Space 1
│     ├─ Space 2
│     └─ [Cancel]
```

**Estimated effort**: 30 minutes (follows delete button pattern already in code)

---

## Success Criteria (MVP Minimum)

✅ **All acceptance criteria from spec met**:
- [x] User can click Move button next to item
- [x] Move button is disabled when only 1 space exists
- [x] Modal shows available target spaces (all except current)
- [x] Clicking space confirms move and updates database
- [x] Item disappears from old space
- [x] Item appears in new space
- [x] Error alert on move failure
- [x] List refreshes immediately (no manual refresh needed)

✅ **Technical acceptance**:
- [x] `ItemRepository.updateSpaceId()` uses parameterized SQL
- [x] `ItemService.moveItem()` validates and calls repository
- [x] Both spaces refresh after move (useFocusEffect handles this)
- [x] No TypeScript errors
- [x] No console errors

---

## Dependencies & Blockers

**Blocks**: None - all dependencies satisfied
- ✅ Feature 001 (Create Space) - Complete
- ✅ Feature 004 (Add Item) - Complete  
- ✅ Database schema (items table) - Complete
- ✅ ItemRepository/ItemService base - Complete

**Potential blockers**: None identified

---

## Risks & Mitigations

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|-----------|
| SQL error on UPDATE | Low | Move fails, error shown | Parameterized query, error handling |
| Modal component issues | Low | UI doesn't render | Reuse working pattern from other screens |
| Space list fetch fails | Low | Modal shows error | Fetch in service, error handling |

---

## Out of Scope

- ❌ Undo/redo move
- ❌ Move history audit log
- ❌ Bulk move (multiple items)
- ❌ Drag-drop reordering
- ❌ Custom animations
- ❌ Optimistic UI updates

---

## Next Steps

**After plan approval**:
1. `/speckit.tasks move_item` → Generate 4-5 atomic implementation tasks
2. `/speckit.implement move_item` → Execute tasks
3. Manual testing on device
4. Commit to 005-move-item branch
5. Create pull request

**Estimated total time**: 1-2 hours (simple feature, proven pattern)
<!--
  ACTION REQUIRED: Replace the placeholder tree below with the concrete layout
  for this feature. Delete unused options and expand the chosen structure with
  real paths (e.g., apps/admin, packages/something). The delivered plan must
  not include Option labels.
-->

```text
# [REMOVE IF UNUSED] Option 1: Single project (DEFAULT)
src/
├── models/
├── services/
├── cli/
└── lib/

tests/
├── contract/
├── integration/
└── unit/

# [REMOVE IF UNUSED] Option 2: Web application (when "frontend" + "backend" detected)
backend/
├── src/
│   ├── models/
│   ├── services/
│   └── api/
└── tests/

frontend/
├── src/
│   ├── components/
│   ├── pages/
│   └── services/
└── tests/

# [REMOVE IF UNUSED] Option 3: Mobile + API (when "iOS/Android" detected)
api/
└── [same as backend above]

ios/ or android/
└── [platform-specific structure: feature modules, UI flows, platform tests]
```

**Structure Decision**: [Document the selected structure and reference the real
directories captured above]

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| [e.g., 4th project] | [current need] | [why 3 projects insufficient] |
| [e.g., Repository pattern] | [specific problem] | [why direct DB access insufficient] |
