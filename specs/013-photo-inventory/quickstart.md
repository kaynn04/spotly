# Quickstart: Photo Inventory

**Feature**: 013 - Photo Inventory
**Branch**: `034-photo-inventory`

## Prerequisites

```bash
cd app
npx expo install expo-image-picker expo-image-manipulator
```

`expo-file-system` is already installed.

## Key Files to Create

1. **Migration**: `app/src/db/migrations/007-add-item-photo-uri.ts`
2. **Service**: `app/src/services/PhotoService.ts`
3. **Component**: `app/components/PhotoPickerSheet.tsx`

## Key Files to Modify

1. **Model**: `app/src/models/Item.ts` — add `photoUri` / `photo_uri` fields
2. **Repository**: `app/src/repositories/ItemRepository.ts` — include `photo_uri` in queries and row mapping
3. **Service**: `app/src/services/ItemService.ts` — call PhotoService.deletePhoto in deleteItem
4. **Migrations**: `app/src/db/migrations.ts` — register migration 007
5. **Item Detail**: `app/app/item/[id].tsx` — display photo, add/replace/remove actions
6. **Item Form**: `app/src/features/spaces/screens/components/ItemFormModal.tsx` — add photo capture during creation
7. **Space Detail**: `app/app/space/[id].tsx` — add 40×40 thumbnail to item rows
8. **Container Detail**: `app/app/container/[id].tsx` — add 40×40 thumbnail to item rows

## Quick Validation

1. Create a new item with a photo → photo appears on detail screen
2. View item in space list → 40×40 thumbnail visible
3. Replace photo on existing item → old file gone, new one shown
4. Remove photo → placeholder shown, file deleted from filesystem
5. Delete item with photo → photo file cleaned up
