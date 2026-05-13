# Quickstart: Warranty Tracker

**Feature**: 014 - Warranty Tracker  
**Branch**: `037-other-tools`

---

## What This Feature Does

Adds a warranty expiry date to any inventory item. The app sends push notifications 30 days before and on the expiry day, and provides a dashboard in the Tools tab grouped by status (Expiring Soon / Active / Expired).

---

## Files to Create

| File | Purpose |
|------|---------|
| `app/src/db/migrations/012-add-item-warranty.ts` | SQLite migration — 2 new columns on `items` |
| `app/src/services/WarrantyReminderService.ts` | Notification scheduler for warranty reminders |
| `app/src/features/tools/models/WarrantyItem.ts` | `WarrantyItem` type + `WarrantyStatus` |
| `app/src/features/tools/screens/WarrantyTrackerScreen.tsx` | Dashboard screen |
| `app/app/tools/warranty-tracker.tsx` | Expo Router route for dashboard |

## Files to Modify

| File | Change |
|------|--------|
| `app/src/db/migrations.ts` | Wire migration 012 |
| `app/src/models/Item.ts` | Add `warrantyExpiry`, `warrantyReminderId` fields |
| `app/src/repositories/ItemRepository.ts` | SELECT + map warranty fields; add `updateWarranty()`, `setWarrantyReminderId()` |
| `app/src/services/ItemService.ts` | Add `updateWarranty()`, `clearWarranty()` |
| `app/app/item/[id].tsx` | Add warranty section card |
| `app/app/_layout.tsx` | Add notification deep-link listener |
| `app/src/features/tools/screens/ToolsPage.tsx` | Activate warranty tracker entry |

---

## Implementation Order

1. **Migration** → `012-add-item-warranty.ts` + wire in `migrations.ts`
2. **Model** → extend `Item` + `ItemRow` types
3. **Repository** → add warranty fields to SELECT/map; add `updateWarranty()` + `setWarrantyReminderId()`
4. **WarrantyReminderService** → new service wrapping expo-notifications
5. **ItemService** → `updateWarranty()` + `clearWarranty()`
6. **WarrantyItem model** + `WarrantyTrackerScreen` + route file
7. **Item detail screen** → warranty card section
8. **Root layout** → notification deep-link listener
9. **ToolsPage** → activate warranty tracker entry

---

## Key Constants

```typescript
const WARRANTY_COLOR = '#e09b3a';           // amber — distinct from PRIMARY and LENDING purple
const EXPIRING_SOON_DAYS = 30;              // threshold for "Expiring Soon" badge + early notification
const NOTIFICATION_HOUR = 9;               // 09:00 local time for all warranty notifications
const ANDROID_CHANNEL_ID = 'spotly-warranty-reminders';
```

---

## Notification Payload

```typescript
// 30-day reminder
{
  title: '🛡️ Warranty Expiring Soon',
  body: `${itemName} (${locationName}) warranty expires in 30 days.`,
  data: { itemId },
}

// Expiry day
{
  title: '🛡️ Warranty Expires Today',
  body: `${itemName} (${locationName}) warranty expires today.`,
  data: { itemId },
}
```

---

## Grouping Logic

```typescript
function classifyWarranty(expiryDateStr: string): WarrantyStatus {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiry = new Date(expiryDateStr);
  expiry.setHours(0, 0, 0, 0);
  const days = Math.ceil((expiry.getTime() - today.getTime()) / 86400000);
  if (days < 0) return 'expired';
  if (days <= 30) return 'expiring-soon';
  return 'active';
}
```

---

## Testing Checklist

- [ ] Add a warranty date > 30 days out — confirm 2 notifications scheduled
- [ ] Add a warranty date < 30 days out — confirm 1 notification scheduled
- [ ] Add a warranty date in the past — confirm 0 notifications scheduled
- [ ] Change the warranty date — confirm old notifications cancelled, new ones scheduled
- [ ] Remove the warranty — confirm all notifications cancelled, columns cleared
- [ ] Delete an item with a warranty — confirm notifications cancelled
- [ ] Open warranty tracker dashboard — items appear in correct groups
- [ ] Tap an item on dashboard — navigates to item detail
- [ ] Deny notification permission — date still saves, user informed
- [ ] Tap notification (Android/iOS) — app opens to correct item detail
