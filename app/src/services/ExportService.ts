/**
 * ExportService
 *
 * Exports all inventory data (spaces, containers, items, lendings)
 * as a JSON file that can be shared via the system share sheet.
 */

import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { getDatabase } from '../db/client';

const PHOTOS_DIR = `${FileSystem.documentDirectory}photos/`;

/** Read a photo file and return base64, or null if missing */
async function readPhotoBase64(photoUri: string | null | undefined): Promise<string | null> {
  if (!photoUri) return null;
  try {
    const info = await FileSystem.getInfoAsync(photoUri);
    if (!info.exists) return null;
    return await FileSystem.readAsStringAsync(photoUri, { encoding: FileSystem.EncodingType.Base64 });
  } catch {
    return null;
  }
}

export const ExportService = {
  async exportInventory(): Promise<void> {
    const db = getDatabase();

    const safeQuery = async (sql: string) => {
      try { return await db.getAllAsync(sql); }
      catch { return []; }
    };

    const [spaces, containers, items, lendings, outsideSessions, outsideSessionItems] = await Promise.all([
      safeQuery('SELECT * FROM spaces ORDER BY name'),
      safeQuery('SELECT * FROM containers ORDER BY name'),
      safeQuery('SELECT * FROM items ORDER BY name'),
      safeQuery('SELECT * FROM lendings ORDER BY lent_at DESC'),
      safeQuery('SELECT * FROM outside_sessions ORDER BY created_at DESC'),
      safeQuery('SELECT * FROM outside_session_items'),
    ]);

    // Attach base64-encoded photos to each row that has a photo_uri
    const attachPhotos = async (rows: any[]) =>
      Promise.all(rows.map(async (row) => {
        if (!row.photo_uri) return row;
        const photo_base64 = await readPhotoBase64(row.photo_uri);
        return photo_base64 ? { ...row, photo_base64 } : row;
      }));

    const [spacesWithPhotos, containersWithPhotos, itemsWithPhotos] = await Promise.all([
      attachPhotos(spaces as any[]),
      attachPhotos(containers as any[]),
      attachPhotos(items as any[]),
    ]);

    const data = {
      exportedAt: new Date().toISOString(),
      appVersion: '1.0.0',
      spaces: spacesWithPhotos,
      containers: containersWithPhotos,
      items: itemsWithPhotos,
      lendings,
      outsideSessions,
      outsideSessionItems,
    };

    const json = JSON.stringify(data, null, 2);
    const fileName = `synop-export-${new Date().toISOString().slice(0, 10)}.json`;
    const filePath = `${FileSystem.cacheDirectory}${fileName}`;

    await FileSystem.writeAsStringAsync(filePath, json);

    await Sharing.shareAsync(filePath, {
      mimeType: 'application/json',
      dialogTitle: 'Export Synop Data',
    });
  },
};
