# Data Model: Photo Inventory

**Feature**: 013 - Photo Inventory
**Date**: 2026-05-12

## Entity Changes

### Item (modified)

| Field | Type | Nullable | Default | Notes |
|-------|------|----------|---------|-------|
| id | TEXT (UUID) | NO | — | Primary key (existing) |
| name | TEXT | NO | — | Existing |
| description | TEXT | YES | NULL | Existing |
| quantity | INTEGER | NO | 1 | Existing |
| space_id | TEXT | NO | — | FK to spaces (existing) |
| container_id | TEXT | YES | NULL | FK to containers (existing) |
| **photo_uri** | **TEXT** | **YES** | **NULL** | **NEW — Full file path to local JPEG** |
| created_at | TEXT | NO | datetime('now') | Existing |
| updated_at | TEXT | YES | NULL | Existing |

### Photo File (filesystem, not a DB entity)

| Attribute | Value |
|-----------|-------|
| Location | `{documentDirectory}/photos/{itemId}.jpg` |
| Format | JPEG, 80% quality |
| Max dimension | 1000px (width or height, aspect preserved) |
| Avg size | ~300KB |
| Lifecycle | Created on attach, deleted on remove/replace/item-delete |

## Migration: 007-add-item-photo-uri

```sql
ALTER TABLE items ADD COLUMN photo_uri TEXT DEFAULT NULL;
```

## TypeScript Type Changes

### Item interface (app/src/models/Item.ts)

```typescript
export interface Item {
  // ... existing fields ...
  photoUri?: string | null;     // NEW: local file path to photo
}
```

### ItemRow interface (app/src/models/Item.ts)

```typescript
export interface ItemRow {
  // ... existing fields ...
  photo_uri?: string | null;    // NEW: maps to photo_uri column
}
```

## Relationships

- Item → Photo File: 1:0..1 (one item has zero or one photo)
- Photo file lifecycle is fully managed by PhotoService
- When an item is deleted, its photo file must also be deleted
- When a photo is replaced, the old file is deleted before the new one is saved

## State Transitions

```
Item without photo → [Add Photo] → Item with photo
Item with photo → [Replace Photo] → Item with new photo (old file deleted)
Item with photo → [Remove Photo] → Item without photo (file deleted)
Item with photo → [Delete Item] → Item deleted + file deleted
```
