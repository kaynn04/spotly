# Tasks: Warranty Tracker

**Input**: Design documents from `/specs/014-warranty-tracker/`
**Prerequisites**: plan.md ✅ spec.md ✅ research.md ✅ data-model.md ✅ quickstart.md ✅

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story this task belongs to
- No tests requested — implementation tasks only

---

## Phase 1: Foundation (Blocks all stories)

**Purpose**: DB migration + model + repository + reminder service. Must complete before any UI work.

- [X] T001 Create migration `app/src/db/migrations/012-add-item-warranty.ts` — adds `warranty_expiry TEXT` and `warranty_reminder_id TEXT` to `items` table using PRAGMA check + ALTER TABLE pattern
- [X] T002 Wire migration 012 in `app/src/db/migrations.ts` — add import + try/catch block after migration 011
- [X] T003 Extend `app/src/models/Item.ts` — add `warrantyExpiry?: string | null` and `warrantyReminderId?: string | null` to `Item` and `ItemRow` interfaces
- [X] T004 Extend `app/src/repositories/ItemRepository.ts` — add `warranty_expiry`, `warranty_reminder_id` to SELECT in `getById()` and `getAll()`, map to model fields, add `updateWarranty(id, expiryDate)` and `setWarrantyReminderId(id, reminderId)` methods
- [X] T005 [P] Create `app/src/services/WarrantyReminderService.ts` — `scheduleWarrantyReminders(itemId, itemName, locationName, expiryDate, existingReminderId?)` scheduling 30-day + expiry-day notifications at 09:00 using expo-notifications (Android channel `synop-warranty-reminders`); `cancelWarrantyReminders(reminderId)` delegating to `ReminderService.cancelReminders()`
- [X] T006 Extend `app/src/services/ItemService.ts` — add `updateWarranty(itemId, expiryDate, locationName)` (cancel old reminders, persist date, schedule new reminders, store IDs) and `clearWarranty(itemId)` (cancel reminders, clear both columns)

**Checkpoint**: DB columns exist, model types updated, all business logic in place — US1 and US2 can now begin.

---

## Phase 2: User Story 1 — Attach a Warranty to an Item (P1) 🎯 MVP

**Goal**: User can add, edit, and remove a warranty expiry date from any item's detail screen.

**Independent Test**: Open any item detail → tap "Add Warranty" → pick a date → save → date shown with status badge. Edit to a new date → old notifications cancelled, new ones scheduled. Remove → warranty cleared.

- [X] T007 [US1] Add warranty section card to `app/app/item/[id].tsx`
- [X] T008 [US1] Add notification deep-link listener to `app/app/_layout.tsx`

**Checkpoint**: US1 fully functional — add/edit/remove warranty on any item, notifications scheduled, deep-link works.

---

## Phase 3: User Story 2 — Warranty Expiry Notifications (P2)

**Goal**: Correct notifications fire at the right times and deep-link to the item.

**Independent Test**: Attach a warranty expiry exactly 30 days from today → confirm 2 notifications scheduled (viewable in device notification settings). Attach a date 5 days away → confirm only 1 notification. Change the date → confirm old cancelled, new scheduled. Remove warranty → confirm all cancelled.

> This story is **fully delivered by T005, T006, T007, and T008** from Phases 1 and 2. No additional implementation tasks are required — the notification logic lives in `WarrantyReminderService` (T005), is called by `ItemService` (T006), triggered from the UI (T007), and deep-linked via the root layout listener (T008).

**Checkpoint**: US2 complete via US1 implementation. Verify with quickstart.md notification checklist.

---

## Phase 4: User Story 3 — Warranty Tracker Dashboard (P3)

**Goal**: Tools tab shows a dashboard of all warranted items grouped by status.

**Independent Test**: With items in each status group, open Tools → Warranty Tracker → verify three sections (Expiring Soon / Active / Expired) with correct items. Tap an item → navigates to item detail.

- [X] T009 [P] [US3] Create `app/src/features/tools/models/WarrantyItem.ts`
- [X] T010 [US3] Create `app/src/features/tools/screens/WarrantyTrackerScreen.tsx`
- [X] T011 [US3] Create `app/app/tools/warranty-tracker.tsx`
- [X] T012 [US3] Update `app/src/features/tools/screens/ToolsPage.tsx`

**Checkpoint**: All three user stories complete and independently testable.

---

## Dependencies & Execution Order

### Phase Dependencies

```
Phase 1 (Foundation) → Phase 2 (US1) → verify US2 → Phase 3 (US3)
```

- **Phase 1**: No dependencies — start immediately
- **Phase 2**: Requires Phase 1 complete (model + service + repository ready)
- **Phase 3 (US2)**: No new tasks — validate that T005–T008 satisfy all US2 acceptance criteria
- **Phase 4 (US3)**: Requires Phase 1 only (reads items from repository); can start in parallel with Phase 2

### Parallel Opportunities

- **T005** (WarrantyReminderService) can be written in parallel with **T003** (model) and **T004** (repository)
- **T009** (WarrantyItem model) can be written in parallel with **T007** (item detail warranty card) once Phase 1 is done
- **T011** (route file) can be written in parallel with **T010** (screen)

### Within Each Story

- US1: T007 → T008 (listener logically follows the UI that schedules notifications)
- US3: T009 → T010 → T011 → T012 (model first, then screen, then route, then activate)

---

## Implementation Strategy

**MVP**: Complete Phase 1 + Phase 2 (T001–T008) — users can attach, edit, remove warranties and receive notifications. The dashboard (Phase 4) is additive.

**Full feature**: All 12 tasks. Estimated scope: small — no new tables, no new libraries, no new permissions beyond what lending already uses.
