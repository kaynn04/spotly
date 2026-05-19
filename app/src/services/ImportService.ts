/**
 * ImportService
 *
 * Imports inventory data from a Synop JSON export file.
 * Supports two modes:
 *   - Merge: inserts new records, skips existing (by ID)
 *   - Replace: wipes all data first, then inserts everything
 */

import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { getDatabase } from '../db/client';
import { resetDatabase, initializeDatabase } from '../db/migrations';

const PHOTOS_DIR = `${FileSystem.documentDirectory}photos/`;

/** Write a base64-encoded photo to the photos directory, return the saved URI */
async function restorePhoto(base64: string, filename: string): Promise<string> {
  const info = await FileSystem.getInfoAsync(PHOTOS_DIR);
  if (!info.exists) await FileSystem.makeDirectoryAsync(PHOTOS_DIR, { intermediates: true });
  const destPath = `${PHOTOS_DIR}${filename}`;
  await FileSystem.writeAsStringAsync(destPath, base64, { encoding: FileSystem.EncodingType.Base64 });
  return destPath;
}

export type ImportMode = 'merge' | 'replace';

export interface ImportResult {
  spaces: number;
  containers: number;
  items: number;
  lendings: number;
  outsideSessions: number;
  outsideSessionItems: number;
}

export const ImportService = {
  /**
   * Pick a JSON file and import its contents.
   * Returns null if user cancelled the picker.
   */
  async pickAndImport(mode: ImportMode): Promise<ImportResult | null> {
    const result = await DocumentPicker.getDocumentAsync({
      type: '*/*',
      copyToCacheDirectory: true,
    });

    if (result.canceled || !result.assets?.length) {
      return null;
    }

    const asset = result.assets[0];
    const content = await FileSystem.readAsStringAsync(asset.uri);
    let data: any;
    try {
      data = JSON.parse(content);
    } catch {
      throw new Error('Please choose a valid Synop JSON export file.');
    }

    return await this.importData(data, mode);
  },

  async importData(data: any, mode: ImportMode): Promise<ImportResult> {
    if (!data || typeof data !== 'object') {
      throw new Error('Invalid import file format.');
    }

    const db = getDatabase();
    const counts: ImportResult = {
      spaces: 0,
      containers: 0,
      items: 0,
      lendings: 0,
      outsideSessions: 0,
      outsideSessionItems: 0,
    };

    if (mode === 'replace') {
      await resetDatabase();
      await initializeDatabase();
    }

    const insertOrIgnore = mode === 'merge' ? 'INSERT OR IGNORE' : 'INSERT OR REPLACE';

    await db.withTransactionAsync(async () => {
      // Spaces
      if (Array.isArray(data.spaces)) {
        for (const s of data.spaces) {
          if (!s.id || !s.name) continue;
          let photoUri: string | null = null;
          if (s.photo_base64) {
            try { photoUri = await restorePhoto(s.photo_base64, `space_${s.id}.jpg`); } catch {}
          }
          await db.runAsync(
            `${insertOrIgnore} INTO spaces (id, name, photo_uri, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`,
            [s.id, s.name, photoUri, s.created_at || new Date().toISOString(), s.updated_at || s.created_at || new Date().toISOString()]
          );
          counts.spaces++;
        }
      }

      // Containers
      if (Array.isArray(data.containers)) {
        for (const c of data.containers) {
          if (!c.id || !c.name || !c.space_id) continue;
          let photoUri: string | null = null;
          if (c.photo_base64) {
            try { photoUri = await restorePhoto(c.photo_base64, `container_${c.id}.jpg`); } catch {}
          }
          await db.runAsync(
            `${insertOrIgnore} INTO containers (id, name, space_id, photo_uri, created_at) VALUES (?, ?, ?, ?, ?)`,
            [c.id, c.name, c.space_id, photoUri, c.created_at || new Date().toISOString()]
          );
          counts.containers++;
        }
      }

      // Items
      if (Array.isArray(data.items)) {
        for (const i of data.items) {
          if (!i.id || !i.name || !i.space_id) continue;
          let photoUri: string | null = null;
          if (i.photo_base64) {
            try { photoUri = await restorePhoto(i.photo_base64, `${i.id}.jpg`); } catch {}
          }
          await db.runAsync(
            `${insertOrIgnore} INTO items (id, name, space_id, container_id, description, quantity, photo_uri, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [i.id, i.name, i.space_id, i.container_id || null, i.description || null, i.quantity ?? 1, photoUri, i.created_at || new Date().toISOString()]
          );
          counts.items++;
        }
      }

      // Lendings
      if (Array.isArray(data.lendings)) {
        for (const l of data.lendings) {
          if (!l.id || !l.item_id || !l.borrower_name) continue;
          await db.runAsync(
            `${insertOrIgnore} INTO lendings (id, item_id, borrower_name, note, lent_at, returned_at, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [l.id, l.item_id, l.borrower_name, l.note || null, l.lent_at, l.returned_at || null, l.status || 'ACTIVE', l.created_at, l.updated_at]
          );
          counts.lendings++;
        }
      }

      // Outside Sessions
      if (Array.isArray(data.outsideSessions)) {
        for (const s of data.outsideSessions) {
          if (!s.id || !s.title) continue;
          await db.runAsync(
            `${insertOrIgnore} INTO outside_sessions (id, title, status, created_at, completed_at) VALUES (?, ?, ?, ?, ?)`,
            [s.id, s.title, s.status || 'COMPLETED', s.created_at, s.completed_at || null]
          );
          counts.outsideSessions++;
        }
      }

      // Outside Session Items
      if (Array.isArray(data.outsideSessionItems)) {
        for (const si of data.outsideSessionItems) {
          if (!si.id || !si.session_id || !si.item_id) continue;
          await db.runAsync(
            `${insertOrIgnore} INTO outside_session_items (id, session_id, item_id, is_checked, checked_at) VALUES (?, ?, ?, ?, ?)`,
            [si.id, si.session_id, si.item_id, si.is_checked ?? 0, si.checked_at || null]
          );
          counts.outsideSessionItems++;
        }
      }
    });

    return counts;
  },
};
