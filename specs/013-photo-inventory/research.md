# Research: Photo Inventory

**Feature**: 013 - Photo Inventory
**Date**: 2026-05-12

## R1: expo-image-picker for Camera & Gallery

**Decision**: Use `expo-image-picker` for both camera capture and gallery selection.

**Rationale**: Expo's official image picker handles permissions, camera access, and gallery selection across iOS and Android with a single API. Returns a local URI after selection. Supports quality and resize options at capture time.

**Alternatives considered**:
- `react-native-image-picker`: Requires native module linking; not Expo-managed-compatible without config plugins. More setup overhead.
- `expo-camera`: Full camera UI — overkill for simple capture. expo-image-picker's `launchCameraAsync` is sufficient.

**Key API**:
```typescript
import * as ImagePicker from 'expo-image-picker';

// Gallery
const result = await ImagePicker.launchImageLibraryAsync({
  mediaTypes: ['images'],
  quality: 0.8,
});

// Camera
const result = await ImagePicker.launchCameraAsync({
  mediaTypes: ['images'],
  quality: 0.8,
});
```

## R2: expo-image-manipulator for Compression/Resize

**Decision**: Use `expo-image-manipulator` for post-capture compression and resizing.

**Rationale**: While expo-image-picker supports basic quality settings, expo-image-manipulator gives precise control over resize dimensions and JPEG compression. Ensures consistent output regardless of source (camera vs gallery).

**Alternatives considered**:
- Relying solely on expo-image-picker's `quality` param: Does not resize dimensions. A 12MP photo at 80% quality is still multi-MB.
- `react-native-image-resizer`: Not an Expo-managed package, requires config plugin.

**Key API**:
```typescript
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';

const compressed = await manipulateAsync(
  sourceUri,
  [{ resize: { width: 1000 } }],  // Max 1000px width, height auto
  { compress: 0.8, format: SaveFormat.JPEG }
);
// compressed.uri → temp file path
```

## R3: expo-file-system for Storage Management

**Decision**: Use `expo-file-system` (already installed) for copying compressed photos to the app's document directory and deleting old files.

**Rationale**: Already a project dependency. Provides `documentDirectory`, `copyAsync`, `deleteAsync`, `getInfoAsync` — everything needed for photo lifecycle management.

**Key API**:
```typescript
import * as FileSystem from 'expo-file-system';

const photosDir = `${FileSystem.documentDirectory}photos/`;

// Ensure directory exists
await FileSystem.makeDirectoryAsync(photosDir, { intermediates: true });

// Copy compressed photo to final location
await FileSystem.copyAsync({ from: tempUri, to: `${photosDir}${itemId}.jpg` });

// Delete photo
await FileSystem.deleteAsync(`${photosDir}${itemId}.jpg`, { idempotent: true });

// Check if file exists
const info = await FileSystem.getInfoAsync(`${photosDir}${itemId}.jpg`);
```

## R4: Database Migration Strategy

**Decision**: Add `photo_uri TEXT` nullable column to existing `items` table via migration 007.

**Rationale**: Single column addition. Nullable so existing items are unaffected. Stores the full file path for direct use with `<Image source={{ uri }}/>`.

**Migration**:
```sql
ALTER TABLE items ADD COLUMN photo_uri TEXT DEFAULT NULL;
```

## R5: Permission Handling

**Decision**: Use expo-image-picker's built-in permission request methods.

**Rationale**: `ImagePicker.requestCameraPermissionsAsync()` and `ImagePicker.requestMediaLibraryPermissionsAsync()` handle the OS-level permission dialogs. If denied, the app shows an Alert directing the user to device settings via `Linking.openSettings()`.

**Key behavior**:
- Request permission on first use (not on app launch)
- If denied, show Alert with "Open Settings" button
- If previously denied, re-request will show the settings prompt on Android
