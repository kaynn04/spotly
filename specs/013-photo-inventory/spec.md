# Feature Specification: Photo Inventory

**Feature Branch**: `034-photo-inventory`  
**Created**: 2026-05-12  
**Status**: Draft  
**Input**: User description: "Users can attach a single photo to an item — add, view, replace, or remove. Photos stored locally, displayed as thumbnails on cards and full-size on detail screens. Compressed for storage efficiency."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Add Photo to New Item (Priority: P1)

A user is creating a new item in a space or container. They want to attach a photo so they can visually identify the item later. They tap a "Add Photo" button, choose to take a photo with the camera or pick one from their device's photo library, and the photo is saved alongside the item.

**Why this priority**: Adding a photo during item creation is the primary entry point. Without this, the feature has no value.

**Independent Test**: Create a new item, attach a photo via camera or gallery, verify the photo persists after saving and appears on the item card.

**Acceptance Scenarios**:

1. **Given** a user is on the "Add Item" screen, **When** they tap the photo area, **Then** they are presented with options to take a photo or choose from their library.
2. **Given** a user selects a photo from their library, **When** they confirm the selection, **Then** a compressed thumbnail preview is shown on the form before saving.
3. **Given** a user takes a photo with the camera, **When** the photo is captured, **Then** it is compressed/resized and a preview is displayed on the form.
4. **Given** a user has attached a photo and fills in item details, **When** they save the item, **Then** the photo is stored locally on the device and linked to the item.

---

### User Story 2 - View Item Photo (Priority: P1)

A user browses their items and sees thumbnail photos on item cards, helping them quickly identify items visually. When they tap an item to see its details, the photo is displayed at a larger size.

**Why this priority**: Viewing photos is the core payoff of the feature — without it, adding photos has no purpose.

**Independent Test**: Open a space or container with items that have photos, verify thumbnails display on cards, tap an item and verify the full-size photo displays on the detail screen.

**Acceptance Scenarios**:

1. **Given** an item has an attached photo, **When** the user views the item in a list or grid, **Then** a thumbnail of the photo is displayed on the item card.
2. **Given** an item has an attached photo, **When** the user opens the item detail screen, **Then** the photo is displayed at a larger size.
3. **Given** an item does not have a photo, **When** the user views the item card or detail screen, **Then** a placeholder or no image area is shown (no broken image).

---

### User Story 3 - Add Photo to Existing Item (Priority: P2)

A user has an existing item without a photo and wants to add one. They open the item, tap an "Add Photo" option, and attach a photo.

**Why this priority**: Many users will add items first and photos later. This complements the creation flow.

**Independent Test**: Open an existing item without a photo, add a photo, verify it saves and displays correctly.

**Acceptance Scenarios**:

1. **Given** an item exists without a photo, **When** the user opens the item detail screen, **Then** an option to add a photo is visible.
2. **Given** a user selects "Add Photo" on an existing item, **When** they choose a photo, **Then** the photo is compressed, saved locally, and linked to the item.

---

### User Story 4 - Replace or Remove Photo (Priority: P2)

A user wants to update an item's photo (e.g., the item changed appearance) or remove the photo entirely. They can replace the existing photo with a new one, or delete the photo from the item.

**Why this priority**: Essential for maintaining accurate inventory, but secondary to initial add/view flows.

**Independent Test**: Open an item with a photo, replace it with a new photo and verify the old one is gone; remove the photo entirely and verify the item shows no photo.

**Acceptance Scenarios**:

1. **Given** an item has an existing photo, **When** the user taps the photo on the detail screen, **Then** options to replace or remove the photo are presented.
2. **Given** a user chooses to replace the photo, **When** they select a new photo, **Then** the old photo file is deleted from local storage and the new one is saved.
3. **Given** a user chooses to remove the photo, **When** they confirm removal, **Then** the photo file is deleted from local storage and the item no longer has a photo.

---

### Edge Cases

- What happens when the user denies camera or photo library permissions? → The app shows a clear message explaining that permission is required, with a link/button to open device settings.
- What happens when device storage is critically low? → The app shows an error message indicating insufficient storage and does not save a corrupted/partial photo.
- What happens when the photo file on disk is missing or corrupted (e.g., deleted outside the app)? → The item displays a placeholder instead of a broken image, and the photo_uri is treated as empty.
- What happens when the user cancels photo selection mid-flow? → The app returns to the previous state without changes.
- What happens when an item is deleted? → The associated photo file is also deleted from local storage.

## Clarifications

### Session 2026-05-12

- Q: Where should item thumbnails appear — on the existing item row/card, or only on the item detail screen? → A: Small thumbnail (40×40) inline with existing text row, minimal layout change.
- Q: How should the photo picker be presented — native action sheet or custom bottom sheet? → A: Custom bottom sheet matching the app's existing modal style (like the lending picker).
- Q: Where should photo files be stored on the device filesystem? → A: `{documentDirectory}/photos/{itemId}.jpg` — one file per item, named by item ID.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST allow users to attach a photo to an item during item creation.
- **FR-002**: System MUST allow users to attach a photo to an existing item that has no photo.
- **FR-003**: System MUST allow users to replace an existing photo on an item with a new one.
- **FR-004**: System MUST allow users to remove a photo from an item.
- **FR-005**: System MUST compress and resize photos before saving to limit storage usage (target max dimension ~1000px, JPEG quality ~80%).
- **FR-006**: System MUST store photos as local JPEG files at `{documentDirectory}/photos/{itemId}.jpg` and persist the file path in the item record's `photo_uri` field.
- **FR-007**: System MUST display item photos as small thumbnails (40×40px) inline to the left of the item name in existing list rows.
- **FR-008**: System MUST display item photos at a larger size on item detail screens.
- **FR-009**: System MUST show a placeholder when an item has no photo or the photo file is missing.
- **FR-010**: System MUST delete the photo file from local storage when the photo is removed or replaced.
- **FR-011**: System MUST delete the associated photo file when an item is deleted.
- **FR-012**: System MUST request camera and photo library permissions before accessing them, and handle denial gracefully.
- **FR-013**: System MUST support both camera capture and photo library selection as photo sources, presented via a custom bottom sheet matching the app's existing modal style.

### Key Entities

- **Item**: Existing entity representing a physical object tracked by the user. Gains a new optional attribute for the photo file reference (photo_uri). An item has zero or one photo.
- **Photo File**: A compressed JPEG image stored on the device filesystem, referenced by the item's photo_uri. Lifecycle is tied to the item — deleted when the item is deleted or the photo is removed/replaced.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can add a photo to an item (new or existing) in under 10 seconds from tapping "Add Photo" to seeing the preview.
- **SC-002**: Photo thumbnails load and display on item cards within 1 second when scrolling through a list.
- **SC-003**: Compressed photos consume no more than 300 KB per image on average.
- **SC-004**: 100% of deleted or replaced photos are cleaned up from device storage (no orphaned files).
- **SC-005**: Items with missing photo files display gracefully with a placeholder — no crashes or broken image indicators.

## Assumptions

- Users have a device with a camera and/or photo library available.
- The app already has an item creation and item detail screen that can be extended.
- One photo per item is sufficient for the initial release — multi-photo support is out of scope.
- No cloud sync, sharing, or backup of photos is needed.
- Photos do not need AI-based recognition, barcode scanning, or any automated tagging.
- The existing item data model can be extended with a single `photo_uri` text field.
- Compression/resize parameters (max ~1000px, ~80% JPEG quality) are reasonable defaults that balance quality and storage.

## Out of Scope

- Cloud storage or sync of photos
- Multi-photo support (galleries per item)
- AI-powered image recognition or auto-tagging
- Barcode or QR code scanning
- Photo editing (crop, rotate, filters) beyond automatic compression
- Sharing photos with other users
- Photo backup/export functionality
