# Data Model: Warranty Tracker

**Feature**: 014 - Warranty Tracker  
**Date**: 2026-05-13

---

## Schema Changes

### Migration 012 — Add warranty columns to `items`

New file: `app/src/db/migrations/012-add-item-warranty.ts`

```sql
-- Idempotent: checks column existence via PRAGMA before adding
ALTER TABLE items ADD COLUMN warranty_expiry TEXT;        -- ISO date string "YYYY-MM-DD", nullable
ALTER TABLE items ADD COLUMN warranty_reminder_id TEXT;   -- comma-separated notification IDs, nullable
```

No new tables. No index needed (warranty queries are always filtered from the full items list, not looked up by warranty key).

---

## Model Changes

### `Item` (extended)

File: `app/src/models/Item.ts`

```typescript
export interface Item {
  // ... existing fields unchanged ...
  warrantyExpiry?: string | null;      // ISO date "YYYY-MM-DD" — nullable
  warrantyReminderId?: string | null;  // comma-separated expo-notifications IDs — nullable
}

export interface ItemRow {
  // ... existing fields unchanged ...
  warranty_expiry?: string | null;
  warranty_reminder_id?: string | null;
}
```

---

## Derived Types (new)

File: `app/src/features/tools/models/WarrantyItem.ts`

```typescript
export type WarrantyStatus = 'expiring-soon' | 'active' | 'expired';

export interface WarrantyItem extends Item {
  warrantyExpiry: string;        // guaranteed non-null (only items with warranty are included)
  warrantyStatus: WarrantyStatus;
  daysRemaining: number;         // negative if expired
}
```

---

## Repository Changes

### `ItemRepository` (extended)

File: `app/src/repositories/ItemRepository.ts`

**Modified methods** (add warranty columns to SELECT):
- `getById()` — include `warranty_expiry`, `warranty_reminder_id` in SELECT + map to model
- `getAll()` — include `warranty_expiry`, `warranty_reminder_id` in SELECT + map to model

**New method**:
```typescript
async setWarrantyReminderId(id: string, reminderId: string | null): Promise<void>
// UPDATE items SET warranty_reminder_id = ?, updated_at = ? WHERE id = ?
```

**New method**:
```typescript
async updateWarranty(id: string, expiryDate: string | null): Promise<void>
// UPDATE items SET warranty_expiry = ?, updated_at = ? WHERE id = ?
```

---

## Service Layer

### `WarrantyReminderService` (new)

File: `app/src/services/WarrantyReminderService.ts`

```typescript
export class WarrantyReminderService {
  /**
   * Schedule warranty expiry notifications.
   * - 30 days before: "Item (Location) warranty expires in 30 days."
   * - On expiry day: "Item (Location) warranty expires today."
   * Returns comma-joined notification IDs or null if permission denied / date past.
   */
  static async scheduleWarrantyReminders(
    itemId: string,
    itemName: string,
    locationName: string,           // space name, or container name if in container
    expiryDate: Date,
    existingReminderId?: string | null
  ): Promise<string | null>

  /**
   * Cancel all notifications for a warranty.
   * Delegates to ReminderService.cancelReminders().
   */
  static async cancelWarrantyReminders(reminderId: string): Promise<void>
}
```

Notification content:
```
Title: "🛡️ Warranty Expiring Soon"
Body:  "{itemName} ({locationName}) warranty expires in 30 days."
data:  { itemId }

Title: "🛡️ Warranty Expires Today"
Body:  "{itemName} ({locationName}) warranty expires today."
data:  { itemId }
```

### `ItemService` (extended)

File: `app/src/services/ItemService.ts`

**New methods**:
```typescript
static async updateWarranty(
  itemId: string,
  expiryDate: Date | null,
  locationName: string
): Promise<void>
// Validates itemId exists, cancels existing reminders, persists new date,
// schedules new reminders, stores reminder IDs.

static async clearWarranty(itemId: string): Promise<void>
// Cancels reminders, clears warranty_expiry + warranty_reminder_id columns.
```

---

## State Transitions

```
Item (no warranty)
      │
      ▼  updateWarranty(date)
Item (active warranty) ──────────────────────────────► Item (expiring soon, ≤30 days)
      │                                                        │
      │  clearWarranty()                                       │  clearWarranty()
      ▼                                                        ▼
Item (no warranty)                                    Item (no warranty)
      │                                                        │
      │  (time passes)                                         │  (time passes)
      ▼                                                        ▼
   (same)                                             Item (expired warranty)
                                                               │
                                                               │  clearWarranty()
                                                               ▼
                                                      Item (no warranty)
```

---

## Grouping Logic (dashboard)

```typescript
const EXPIRING_SOON_DAYS = 30;

function classifyWarranty(expiryDateStr: string): WarrantyStatus {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiry = new Date(expiryDateStr);
  expiry.setHours(0, 0, 0, 0);
  const daysRemaining = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (daysRemaining < 0) return 'expired';
  if (daysRemaining <= EXPIRING_SOON_DAYS) return 'expiring-soon';
  return 'active';
}
```

---

## Notification Deep-Link Handler

File: `app/app/_layout.tsx` (modified)

```typescript
// Add inside root layout component:
useEffect(() => {
  const sub = Notifications.addNotificationResponseReceivedListener((response) => {
    const itemId = response.notification.request.content.data?.itemId;
    if (itemId) router.push(`/item/${itemId}`);
  });
  return () => sub.remove();
}, []);
```
