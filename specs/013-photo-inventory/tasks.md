# Tasks: Photo Inventory

**Input**: Design documents from `/specs/013-photo-inventory/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, quickstart.md

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2)
- Includes exact file paths in descriptions

---

## Phase 1: Setup

**Purpose**: Install dependencies and create project structure for photo support

- [X] T001 Install expo-image-picker and expo-image-manipulator via `npx expo install expo-image-picker expo-image-manipulator` in app/
- [X] T002 Create database migration to add photo_uri column in app/src/db/migrations/007-add-item-photo-uri.ts
- [X] T003 Register migration 007 in app/src/db/migrations.ts

---

## Phase 2: Foundational

**Purpose**: Core photo infrastructure that all user stories depend on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T004 Add `photoUri` field to Item interface and `photo_uri` to ItemRow interface in app/src/models/Item.ts
- [X] T005 Update ItemRepository row-to-entity mapping to include photo_uri → photoUri in app/src/repositories/ItemRepository.ts
- [X] T006 Update ItemRepository queries (getById, getAll, getBySpaceId, getByContainerId) to SELECT photo_uri in app/src/repositories/ItemRepository.ts
- [X] T007 Create PhotoService with capture, compress, save, delete, and exists methods in app/src/services/PhotoService.ts
- [X] T008 Create PhotoPickerSheet bottom sheet component (camera/gallery/cancel options) in app/components/PhotoPickerSheet.tsx

**Checkpoint**: Foundation ready — photo capture, storage, and picker UI available for use in screens

---

## Phase 3: User Story 1 — Add Photo to New Item (Priority: P1) 🎯 MVP

**Goal**: Users can attach a photo when creating a new item via camera or gallery

**Independent Test**: Create a new item with a photo attached, verify the photo file exists at `{documentDirectory}/photos/{itemId}.jpg` and the item's photoUri is set

- [X] T009 [US1] Add photo picker and preview to ItemFormModal in app/src/features/spaces/screens/components/ItemFormModal.tsx
- [X] T010 [US1] Update ItemFormModal's onSubmit prop to accept photoUri and pass it through to item creation in app/src/features/spaces/screens/components/ItemFormModal.tsx
- [X] T011 [US1] Update ItemRepository.createItem to accept and persist photo_uri in app/src/repositories/ItemRepository.ts
- [X] T012 [US1] Update ItemService.createItem to accept photoUri parameter in app/src/services/ItemService.ts
- [X] T013 [US1] Update space detail screen's handleAddItem to pass photoUri from form to service in app/app/space/[id].tsx
- [X] T014 [US1] Update container detail screen's handleAddItem to pass photoUri from form to service in app/app/container/[id].tsx

**Checkpoint**: Users can create items with photos from both space and container screens

---

## Phase 4: User Story 2 — View Item Photo (Priority: P1)

**Goal**: Photos display as 40×40 thumbnails in item lists and full-size on item detail screen

**Independent Test**: Open a space with items that have photos, verify thumbnails render; tap an item, verify full-size photo displays

- [X] T015 [P] [US2] Add 40×40 thumbnail to item rows in space detail screen in app/app/space/[id].tsx
- [X] T016 [P] [US2] Add 40×40 thumbnail to item rows in container detail screen in app/app/container/[id].tsx
- [X] T017 [US2] Add full-size photo display and placeholder to item detail screen in app/app/item/[id].tsx

**Checkpoint**: Photos are visible everywhere — thumbnails in lists, full-size on detail

---

## Phase 5: User Story 3 — Add Photo to Existing Item (Priority: P2)

**Goal**: Users can add a photo to an item that doesn't have one from the item detail screen

**Independent Test**: Open an existing item without a photo, tap add photo, select an image, verify it saves and displays

- [X] T018 [US3] Add "Add Photo" action to item detail screen when item has no photo in app/app/item/[id].tsx
- [X] T019 [US3] Create updateItemPhoto method in ItemRepository (UPDATE photo_uri WHERE id) in app/src/repositories/ItemRepository.ts
- [X] T020 [US3] Create updateItemPhoto method in ItemService that calls PhotoService.save + repo update in app/src/services/ItemService.ts

**Checkpoint**: Users can add photos to any existing item

---

## Phase 6: User Story 4 — Replace or Remove Photo (Priority: P2)

**Goal**: Users can replace an item's photo with a new one or remove it entirely

**Independent Test**: Open item with photo, replace it — verify old file deleted, new one saved. Remove photo — verify file deleted and placeholder shown.

- [X] T021 [US4] Add replace/remove photo actions (tap photo → bottom sheet) on item detail screen in app/app/item/[id].tsx
- [X] T022 [US4] Implement photo replacement flow: delete old file, save new, update DB in app/src/services/PhotoService.ts
- [X] T023 [US4] Implement photo removal: delete file, set photo_uri to NULL in app/src/services/ItemService.ts

**Checkpoint**: Full photo lifecycle complete — add, view, replace, remove

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Cleanup and integrity

- [X] T024 Hook photo deletion into ItemService.deleteItem and ItemRepository.deleteItem in app/src/services/ItemService.ts
- [X] T025 Handle missing/corrupted photo files gracefully — show placeholder, no crash in app/app/item/[id].tsx
- [X] T026 Handle permission denial with Alert + link to device settings in app/src/services/PhotoService.ts

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 — BLOCKS all user stories
- **US1 (Phase 3)**: Depends on Phase 2
- **US2 (Phase 4)**: Depends on Phase 2 (thumbnails work independently of US1 if items have photos in DB)
- **US3 (Phase 5)**: Depends on Phase 2
- **US4 (Phase 6)**: Depends on Phase 5 (uses same updateItemPhoto methods)
- **Polish (Phase 7)**: Depends on all user stories

### Parallel Opportunities

- T015 and T016 (thumbnails in space and container) can run in parallel
- US2 and US3 can run in parallel after Phase 2
- Within Phase 2, T004 must come before T005/T006; T007 and T008 are independent of each other

### Implementation Strategy

- **MVP**: Phase 1 + Phase 2 + Phase 3 (US1) + Phase 4 (US2) = users can add photos to new items and see them everywhere
- **Full feature**: Add Phase 5 + Phase 6 + Phase 7 = complete photo lifecycle
