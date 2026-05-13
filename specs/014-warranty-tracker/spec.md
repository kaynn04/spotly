# Feature Specification: Warranty Tracker

**Feature Branch**: `014-warranty-tracker`  
**Created**: 2026-05-13  
**Status**: Draft  
**Spec Directory**: `specs/014-warranty-tracker`

---

## Clarifications

### Session 2026-05-13

- Q: How should warranty data be stored — columns on the `items` table or a separate `warranties` table? → A: Add `warranty_expiry_date` + `warranty_reminder_id` columns directly to the existing `items` table via a migration (consistent with the lending feature pattern).
- Q: How should warranty entry be surfaced on the item detail screen? → A: A dedicated "Warranty" section/row on the item detail screen with an "Add Warranty" / "Edit" tap action — similar to how lending is shown as its own card.
- Q: What should the notification body include? → A: Item name + location (space/container), e.g. "Refrigerator (Kitchen) warranty expires in 30 days."

---

## Overview

Users of Spotly track physical items organized into Spaces and Containers. Many household items — appliances, electronics, tools — come with manufacturer warranties that expire after 1–3 years. Today there is no way to record or be reminded of those expiry dates; users rely on paper receipts or memory, and often miss the window to file a claim or purchase an extended warranty.

The Warranty Tracker feature lets users attach a warranty expiry date to any inventory item. The app proactively notifies the user 30 days before expiry and again on the expiry day itself, giving them time to act. A dedicated dashboard view surfaces all warranties grouped by status (active, expiring soon, expired) so users can manage them at a glance.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Attach a Warranty to an Item (Priority: P1)

As a homeowner who just purchased a new appliance, I want to record the warranty expiry date on the item in Spotly so I never lose track of when coverage ends.

**Why this priority**: This is the foundational capability — without it, no other part of the feature is possible. Every other story depends on at least one warranty existing.

**Independent Test**: Open any existing item, add a warranty expiry date, save, and confirm the date is displayed on the item detail view. Delivers standalone value as a reference record even without notifications.

**Acceptance Scenarios**:

1. **Given** I am viewing an item's detail screen, **When** I tap "Add Warranty" (or edit the warranty field), **Then** a date picker appears and I can select the warranty expiry date.
2. **Given** I have selected a warranty expiry date, **When** I save the item, **Then** the expiry date is stored and displayed on the item detail screen.
3. **Given** an item already has a warranty date, **When** I edit and change the date, **Then** the new date replaces the old one and is persisted.
4. **Given** an item already has a warranty date, **When** I choose to remove/clear the warranty date, **Then** the warranty is deleted and no notifications are scheduled for that item.
5. **Given** I try to enter a warranty date in the past, **When** I save, **Then** the app accepts it (expired warranties are still useful reference data) and labels it as "Expired".

---

### User Story 2 — Receive Warranty Expiry Notifications (Priority: P2)

As a user with a warranty on record, I want to be notified before it expires so I have time to file a claim or buy an extended plan.

**Why this priority**: The core value proposition of the feature is proactive awareness. Without notifications, users must manually check expiry dates, which provides less utility than simply writing the date on paper.

**Independent Test**: Attach a warranty expiry date that is 30 days from today, verify that a notification is scheduled 30 days out and another is scheduled for the expiry day itself (viewable via device notification settings or a test trigger for nearby dates).

**Acceptance Scenarios**:

1. **Given** a user saves a warranty expiry date that is more than 30 days in the future, **When** the date is saved, **Then** two notifications are scheduled: one 30 days before expiry and one on the expiry day.
2. **Given** a warranty expiry date is fewer than 30 days away (but still in the future), **When** the date is saved, **Then** only the on-day notification is scheduled (the 30-day-prior reminder is skipped since it's already passed).
3. **Given** a warranty expiry date is in the past, **When** the date is saved, **Then** no notifications are scheduled.
4. **Given** a user changes a warranty expiry date, **When** the new date is saved, **Then** any previously scheduled notifications are cancelled and new notifications are scheduled for the updated date.
5. **Given** a user removes a warranty expiry date from an item, **When** the change is saved, **Then** all previously scheduled notifications for that item are cancelled.
6. **Given** a notification fires at 30 days before expiry, **When** the user taps it, **Then** the app opens and navigates to the relevant item detail screen.

---

### User Story 3 — View All Warranties Dashboard (Priority: P3)

As a homeowner with multiple warranted items, I want to see all my warranties in one place grouped by status so I can quickly understand what needs attention.

**Why this priority**: Provides discoverability and overview. Adds meaningful value over the per-item view alone, but the feature is useful without it.

**Independent Test**: With at least one item in each status (active, expiring soon, expired), open the Warranty Tracker screen from the Tools tab and verify items appear under the correct group headings.

**Acceptance Scenarios**:

1. **Given** I am on the Tools tab, **When** I tap "Warranty Tracker", **Then** a screen opens showing all items that have a warranty expiry date attached.
2. **Given** the warranty dashboard is open, **Then** items are grouped into three sections: **Expiring Soon** (within 30 days), **Active** (more than 30 days remaining), and **Expired** (expiry date in the past).
3. **Given** there are no items with warranties, **When** I open the dashboard, **Then** an empty-state message is shown prompting me to add a warranty to an item.
4. **Given** I tap an item in the warranty dashboard, **Then** I am taken to that item's detail screen.
5. **Given** a warranty is updated or removed on an item, **When** I return to the dashboard, **Then** the dashboard reflects the updated status without requiring a full app restart.

---

### Edge Cases

- What happens when an item is deleted and it has an active warranty with scheduled notifications? → All scheduled notifications for that item must be cancelled when the item is deleted.
- What if the user denies notification permissions? → Warranty dates are still stored and displayed; only the notification scheduling is skipped. The app informs the user that notifications are disabled.
- What if two items have the same expiry date? → Each item's notifications are independent; both fire normally.
- What if the device clock is wrong? → The app uses the stored expiry date as-is; accuracy depends on the device clock (no server-side time validation is required for v1).
- What if the app is uninstalled and reinstalled? → Notification IDs are stored in the local database; after reinstall, the database is fresh and the user must re-enter warranty data.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Users MUST be able to attach a warranty expiry date (date only, no time) to any inventory item via a dedicated "Warranty" section on the item detail screen — tapping "Add Warranty" or "Edit" opens a date picker inline without leaving the screen.
- **FR-002**: Users MUST be able to edit a previously saved warranty expiry date.
- **FR-003**: Users MUST be able to remove a warranty expiry date from an item.
- **FR-004**: The system MUST display the warranty expiry date on the item's detail screen, including a human-readable status label (e.g., "Active", "Expiring Soon", "Expired").
- **FR-005**: When a warranty expiry date is saved that is more than 30 days in the future, the system MUST schedule two local push notifications: one 30 days before the expiry date and one on the expiry date.
- **FR-006**: When a warranty expiry date is saved that is fewer than 30 days but still in the future, the system MUST schedule only a single local push notification on the expiry date.
- **FR-007**: When a warranty expiry date is in the past, the system MUST NOT schedule any notifications.
- **FR-008**: When a warranty expiry date is changed, the system MUST cancel all previously scheduled warranty notifications for that item and reschedule based on the new date.
- **FR-009**: When a warranty is removed from an item, the system MUST cancel all scheduled warranty notifications for that item.
- **FR-010**: When an item is deleted from the inventory, the system MUST cancel all scheduled warranty notifications for that item.
- **FR-011**: Notification messages MUST include the item name and its location (space or container name) in the body, e.g. *"Refrigerator (Kitchen) warranty expires in 30 days"* for the 30-day reminder and *"Refrigerator (Kitchen) warranty expires today"* for the expiry-day notification.
- **FR-012**: Tapping a warranty notification MUST open the app and navigate to the relevant item's detail screen.
- **FR-013**: The app MUST provide a Warranty Tracker dashboard screen (accessible from the Tools tab) that lists all items with warranty dates.
- **FR-014**: The Warranty Tracker dashboard MUST group items into three sections: "Expiring Soon" (≤ 30 days remaining), "Active" (> 30 days remaining), and "Expired" (expiry date passed).
- **FR-015**: If the user has not granted notification permissions, the app MUST still allow warranty dates to be saved and displayed, and MUST inform the user that notifications are disabled.

### Key Entities

- **Warranty**: An association between an inventory item and a warranty expiry date. Stored as columns on the `items` table — no separate table. Belongs to exactly one item; an item may have at most one warranty record.
- **Item** *(extended)*: The existing `items` table gains two new columns via migration: `warranty_expiry_date` (TEXT, ISO date, nullable) and `warranty_reminder_id` (TEXT, comma-separated notification IDs, nullable).

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can attach, edit, or remove a warranty expiry date from any item in 3 taps or fewer from the item detail screen.
- **SC-002**: 100% of scheduled warranty notifications are cancelled within the same session when a warranty date is removed or an item is deleted.
- **SC-003**: The Warranty Tracker dashboard loads and displays all warranted items within 1 second on a device with up to 500 inventory items.
- **SC-004**: Users with pending warranties receive at least one notification before any warranty expires (given notification permissions are granted and the device is reachable).
- **SC-005**: The empty-state, active, expiring-soon, and expired states on the dashboard are each reachable and visually distinct without additional navigation.

---

## Assumptions

- The existing `ReminderService` (used by the Lending feature) can be reused or extended to schedule warranty notifications using the same `expo-notifications` mechanism.
- Notification permission prompting follows the same flow already established by the Lending feature; no new permission UI needs to be designed from scratch.
- Warranty data is stored locally in SQLite alongside existing item data; no cloud sync is required for v1.
- Each item can have at most one active warranty record (no multi-warranty support, e.g., parts vs. labour, is required for v1).
- The 30-day "expiring soon" threshold is fixed for v1; user-configurable thresholds are out of scope.
- The Tools tab already exists in the app and has a placeholder entry for Warranty Tracker; this spec covers replacing that placeholder with the live screen.
- Items can have a warranty date in the past (already-expired warranties); these are valid records and are displayed in the "Expired" group.
- Notification delivery reliability depends on device platform and user-granted permissions; the app is not responsible for OS-level delivery failures.
- The feature targets the same devices and OS versions already supported by Spotly (iOS 16+ and Android 10+).

---

## Out of Scope

- Multi-tier warranties (e.g., separate parts and labour warranty periods).
- User-configurable notification lead times (the 30-day threshold is fixed for v1).
- Cloud backup or cross-device sync of warranty data.
- Receipt or document attachment (photo of warranty card/receipt) — covered separately by the Photo Inventory feature (013).
- Extended warranty purchase flows or integrations with third-party warranty providers.
- Warranty categories or tags.
- Exporting warranty data (CSV, PDF, etc.).
