# Implementation Plan: Photo Inventory

**Branch**: `034-photo-inventory` | **Date**: 2026-05-12 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/013-photo-inventory/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

Add single-photo support to items: users can attach, view, replace, or remove a photo per item. Photos are captured via camera or gallery using `expo-image-picker`, compressed with `expo-image-manipulator`, stored locally at `{documentDirectory}/photos/{itemId}.jpg`, and referenced via a `photo_uri` column on the items table. Thumbnails (40×40) appear inline in item rows; full-size photos display on item detail screens.

## Technical Context

**Language/Version**: TypeScript 5.x (strict mode)
**Primary Dependencies**: React Native, Expo SDK, expo-image-picker (new), expo-image-manipulator (new), expo-file-system (existing)
**Storage**: expo-sqlite (existing) + local filesystem for photo files
**Testing**: Manual on-device (Android primary)
**Target Platform**: Android (primary), iOS (best-effort)
**Project Type**: Mobile app (React Native + Expo managed workflow)
**Performance Goals**: Thumbnails load <1s in lists; photo capture to preview <10s
**Constraints**: Offline-capable, no cloud sync, single photo per item, ~300KB per compressed image
**Scale/Scope**: Extends existing Item entity, touches item creation modal, item detail screen, space/container item lists

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Gate | Status | Notes |
|------|--------|-------|
| Spec exists and is approved | ✅ PASS | spec.md complete with clarifications |
| Simplicity First | ✅ PASS | Single photo_uri field, no multi-photo complexity |
| Vertical Slice | ✅ PASS | End-to-end from UI to DB migration |
| Local-First | ✅ PASS | Photos stored on device filesystem, no cloud |
| Clean Layered Architecture | ✅ PASS | PhotoService handles logic, repository handles DB |
| No ORMs / direct SQL | ✅ PASS | Parameterized SQL for migration |
| Spec-Driven | ✅ PASS | All requirements traced to spec FRs |

## Project Structure

### Documentation (this feature)

```text
specs/013-photo-inventory/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
└── tasks.md             # Phase 2 output (/speckit.tasks)
```

### Source Code (repository root)

```text
app/
├── src/
│   ├── models/Item.ts                    # Add photo_uri field
│   ├── repositories/ItemRepository.ts    # Update queries for photo_uri
│   ├── services/ItemService.ts           # Hook photo cleanup into deleteItem
│   ├── services/PhotoService.ts          # NEW: capture, compress, save, delete
│   ├── db/migrations/
│   │   └── 007-add-item-photo-uri.ts     # NEW: ALTER TABLE migration
│   └── db/migrations.ts                  # Register migration
├── app/
│   ├── item/[id].tsx                     # Add photo display + add/replace/remove
│   ├── space/[id].tsx                    # Add thumbnails to item rows
│   └── container/[id].tsx                # Add thumbnails to item rows
└── components/
    └── PhotoPickerSheet.tsx              # NEW: Custom bottom sheet for camera/gallery choice
```

**Structure Decision**: Follows existing layered architecture. PhotoService is a new service-layer module handling photo lifecycle. PhotoPickerSheet is a reusable UI component.

## Complexity Tracking

> No constitution violations. No justification needed.
