/**
 * UUID Generator for React Native/Expo
 * 
 * Generates v4 UUIDs without requiring Node's crypto module
 * Safe to use in Expo environment
 */

/**
 * Generate a random UUID v4
 * Works in React Native/Expo without Node crypto module
 * 
 * @returns UUID v4 string (e.g., "550e8400-e29b-41d4-a716-446655440000")
 */
export function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
