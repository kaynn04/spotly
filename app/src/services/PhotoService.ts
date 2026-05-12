/**
 * PhotoService
 *
 * Handles photo capture, compression, storage, and deletion for items.
 * Photos are stored locally at {documentDirectory}/photos/{itemId}.jpg
 *
 * Feature: 013 - Photo Inventory
 */

import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { Alert, Linking, Platform } from 'react-native';

const PHOTOS_DIR = `${FileSystem.documentDirectory}photos/`;
const MAX_DIMENSION = 1000;
const JPEG_QUALITY = 0.8;

/**
 * Ensure the photos directory exists
 */
async function ensurePhotosDir(): Promise<void> {
  const info = await FileSystem.getInfoAsync(PHOTOS_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(PHOTOS_DIR, { intermediates: true });
  }
}

/**
 * Request camera permission, handling denial gracefully
 */
async function requestCameraPermission(): Promise<boolean> {
  const { status } = await ImagePicker.requestCameraPermissionsAsync();
  if (status !== 'granted') {
    Alert.alert(
      'Camera Permission Required',
      'Please enable camera access in your device settings to take photos.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Open Settings', onPress: () => Linking.openSettings() },
      ]
    );
    return false;
  }
  return true;
}

/**
 * Request media library permission, handling denial gracefully
 */
async function requestMediaLibraryPermission(): Promise<boolean> {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status !== 'granted') {
    Alert.alert(
      'Photo Library Permission Required',
      'Please enable photo library access in your device settings to select photos.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Open Settings', onPress: () => Linking.openSettings() },
      ]
    );
    return false;
  }
  return true;
}

/**
 * Compress and resize an image to meet storage targets
 */
async function compressImage(uri: string): Promise<string> {
  const result = await manipulateAsync(
    uri,
    [{ resize: { width: MAX_DIMENSION } }],
    { compress: JPEG_QUALITY, format: SaveFormat.JPEG }
  );
  return result.uri;
}

export class PhotoService {
  /**
   * Launch camera to capture a photo
   * @returns Compressed image URI or null if cancelled/denied
   */
  static async captureFromCamera(): Promise<string | null> {
    if (Platform.OS === 'web') return null;
    const hasPermission = await requestCameraPermission();
    if (!hasPermission) return null;

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 1, // Full quality — we compress afterwards
      allowsEditing: false,
    });

    if (result.canceled || !result.assets?.[0]?.uri) return null;

    return compressImage(result.assets[0].uri);
  }

  /**
   * Launch gallery to pick a photo
   * @returns Compressed image URI or null if cancelled/denied
   */
  static async pickFromGallery(): Promise<string | null> {
    if (Platform.OS === 'web') return null;
    const hasPermission = await requestMediaLibraryPermission();
    if (!hasPermission) return null;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 1,
      allowsEditing: false,
    });

    if (result.canceled || !result.assets?.[0]?.uri) return null;

    return compressImage(result.assets[0].uri);
  }

  /**
   * Save a compressed photo to the app's photos directory.
   * Uses a timestamp suffix to ensure a unique URI on every save,
   * which prevents React Native's Image cache from showing a stale photo.
   * @param tempUri - URI of the compressed temp file
   * @param key - Base key for the filename (e.g. itemId, `space_${id}`)
   * @returns Final file path (includes timestamp)
   */
  static async savePhoto(tempUri: string, key: string): Promise<string> {
    await ensurePhotosDir();
    const destPath = `${PHOTOS_DIR}${key}_${Date.now()}.jpg`;
    await FileSystem.copyAsync({ from: tempUri, to: destPath });
    return destPath;
  }

  /**
   * Delete a photo file from storage by its full URI.
   * @param photoUri - The exact file path stored in the database
   */
  static async deletePhoto(photoUri: string): Promise<void> {
    await FileSystem.deleteAsync(photoUri, { idempotent: true });
  }

  /**
   * Check if a photo file exists for an item
   * @param photoUri - The stored photo URI
   * @returns true if the file exists
   */
  static async exists(photoUri: string): Promise<boolean> {
    try {
      const info = await FileSystem.getInfoAsync(photoUri);
      return info.exists;
    } catch {
      return false;
    }
  }

  /**
   * Get the expected photo path for an item (legacy helper, key-based)
   */
  static getPhotoPath(key: string): string {
    return `${PHOTOS_DIR}${key}.jpg`;
  }
}
