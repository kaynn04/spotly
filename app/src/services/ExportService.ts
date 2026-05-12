/**
 * ExportService
 *
 * Exports all inventory data (spaces, containers, items, lendings)
 * as a JSON file that can be shared via the system share sheet.
 */

import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { getDatabase } from '../db/client';

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

    const data = {
      exportedAt: new Date().toISOString(),
      appVersion: '1.0.0',
      spaces,
      containers,
      items,
      lendings,
      outsideSessions,
      outsideSessionItems,
    };

    const json = JSON.stringify(data, null, 2);
    const fileName = `spotly-export-${new Date().toISOString().slice(0, 10)}.json`;
    const filePath = `${FileSystem.cacheDirectory}${fileName}`;

    await FileSystem.writeAsStringAsync(filePath, json);

    await Sharing.shareAsync(filePath, {
      mimeType: 'application/json',
      dialogTitle: 'Export Spotly Data',
    });
  },
};
