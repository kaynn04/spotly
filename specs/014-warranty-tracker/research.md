# Research: Warranty Tracker

**Feature**: 014 - Warranty Tracker  
**Date**: 2026-05-13  
**Status**: Complete — no NEEDS CLARIFICATION items remain

---

## Decision Log

### D-001: Storage — Columns on `items` table

- **Decision**: Add `warranty_expiry TEXT` and `warranty_reminder_id TEXT` columns directly to the existing `items` table via a new migration (012).
- **Rationale**: One warranty per item (spec constraint), so there is no normalization benefit to a separate table. The lending feature uses this exact pattern (`due_date` + `reminder_id` on `lendings`). Keeps queries simple — no joins needed to fetch warranty data alongside item data.
- **Alternatives considered**: Separate `warranties` table — rejected for V1 due to added complexity with no benefit given the 1:1 relationship.

---

### D-002: Notification Scheduling — Reuse `ReminderService` directly

- **Decision**: Reuse `ReminderService.scheduleDueDateReminders()` by adding a thin `WarrantyReminderService` wrapper that adapts the warranty-specific parameters (30-day lead time instead of 1-day) and notification copy ("warranty expires in 30 days" instead of "lending due tomorrow").
- **Rationale**: `ReminderService` already handles permission requests, Android channel registration, notification scheduling, and cancellation. Duplicating it would violate DRY. A thin wrapper keeps warranty logic isolated without touching the lending flow.
- **Alternatives considered**: Extend `ReminderService` directly with warranty-specific methods — acceptable, but a separate wrapper keeps the lending and warranty concerns cleanly separated.

---

### D-003: Notification Lead Times — 30 days before + expiry day

- **Decision**: Schedule two notifications: one 30 days before expiry at 09:00 and one on the expiry day at 09:00. If the expiry is fewer than 30 days away, only the expiry-day notification fires.
- **Rationale**: Specified in FR-005 and FR-006. 30 days gives enough lead time to file a claim or purchase an extended warranty.
- **Alternatives considered**: 7-day reminder — rejected; too short for extended warranty purchase decisions.

---

### D-004: Notification Body — Item name + location

- **Decision**: Notification body includes item name and location (space or container name).
  - 30-day: `"[Item] ([Location]) warranty expires in 30 days."`
  - Expiry day: `"[Item] ([Location]) warranty expires today."`
- **Rationale**: Synop's core value is knowing where things are. Including the location makes the notification immediately actionable — users know exactly which item and where it is without opening the app.
- **Alternatives considered**: Item name only — rejected; inconsistent with app's core purpose.

---

### D-005: UX Entry Point — Dedicated warranty section on item detail

- **Decision**: A dedicated "Warranty" card/section on the item detail screen. Shows expiry date + status badge when set; shows "Add Warranty" tap target when not set. Tapping opens a date picker modal inline.
- **Rationale**: Mirrors how the lending banner appears as a distinct card on the item detail screen. Keeps warranty data visible without cluttering the item edit form.
- **Alternatives considered**: Field inside item edit form — rejected; warranty is logically distinct from name/description/quantity.

---

### D-006: Deep-Link on Notification Tap — Add response listener in root layout

- **Decision**: Add a `Notifications.addNotificationResponseReceivedListener` in `app/app/_layout.tsx` that reads `data.itemId` from the notification payload and calls `router.push('/item/' + itemId)`.
- **Rationale**: The lending feature does not currently handle notification taps (no listener exists). Warranty notifications need to navigate to the item. Adding the listener in the root layout ensures it catches taps regardless of app state.
- **Alternatives considered**: Expo Router's default notification URL handling — the app does not use notification URLs, so a manual listener is needed.

---

### D-007: Dashboard Route — `/tools/warranty-tracker`

- **Decision**: Create `app/app/tools/warranty-tracker.tsx` as the Expo Router route, rendering `WarrantyTrackerScreen`. Update `ToolsPage.tsx` to set `route: '/tools/warranty-tracker'` and `available: true` for the warranty entry.
- **Rationale**: Follows the same pattern as `app/app/outside/index.tsx` for the Outside tool. Keeps all tool sub-screens under `/tools/`.
- **Alternatives considered**: A modal sheet — rejected; dashboard has enough content to warrant a full screen.

---

## Implementation Patterns (confirmed from codebase)

| Concern | Pattern | Source |
|---------|---------|--------|
| New migration | `PRAGMA table_info` check + `ALTER TABLE ADD COLUMN` | `011-add-lending-due-date.ts` |
| Model extension | Add optional fields to `Item` interface + `ItemRow` | `Item.ts` |
| Repository update | Parameterized `UPDATE items SET ... WHERE id = ?` | `ItemRepository.updateItem()` |
| Repository warranty fields | New `setWarrantyReminderId()` method mirroring `LendingRepository.setReminderId()` | `LendingRepository.ts` |
| Service validation | `ServiceError` with `code` + `message` | `ItemService.ts` |
| Notification scheduling | `scheduleNotificationAsync` with `DATE` trigger | `ReminderService.ts` |
| Notification cancellation | `cancelScheduledNotificationAsync` per ID | `ReminderService.ts` |
| UI warranty card color | `WARRANTY = '#e09b3a'` (amber — distinct from PRIMARY and LENDING purple) | Design decision |
| Dashboard grouping | Filter items array into 3 buckets by expiry date vs today vs 30 days | Logic decision |
