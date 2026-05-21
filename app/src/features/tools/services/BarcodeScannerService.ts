import { getDatabase } from '@/src/db/client';

export interface BarcodeDestination {
  key: string;
  kind: 'space' | 'container';
  id: string;
  name: string;
  subtitle: string;
  spaceId: string;
  containerId: string | null;
}

export interface ScannedBarcode {
  type: string;
  data: string;
}

export interface BarcodeMatch {
  id: string;
  name: string;
  description: string | null;
  quantity: number;
  photoUri: string | null;
  warrantyExpiry: string | null;
  spaceId: string;
  containerId: string | null;
  spaceName: string;
  containerName: string | null;
  barcodeType: string | null;
  barcodeData: string;
}

export class BarcodeScannerService {
  private static ensureBarcodeColumnsPromise: Promise<void> | null = null;

  private static normalizeData(data: string) {
    return data.trim();
  }

  private static getDataVariants(data: string) {
    const normalized = BarcodeScannerService.normalizeData(data);
    const variants = new Set([normalized]);
    const digitsOnly = normalized.replace(/\D/g, '');

    if (/^\d{13}$/.test(normalized) && normalized.startsWith('0')) {
      variants.add(normalized.slice(1));
    }

    if (/^\d{12}$/.test(normalized)) {
      variants.add(`0${normalized}`);
    }

    if (digitsOnly && digitsOnly !== normalized) {
      variants.add(digitsOnly);
      if (/^\d{13}$/.test(digitsOnly) && digitsOnly.startsWith('0')) {
        variants.add(digitsOnly.slice(1));
      }
      if (/^\d{12}$/.test(digitsOnly)) {
        variants.add(`0${digitsOnly}`);
      }
    }

    return [...variants];
  }

  private static normalizeType(type: string) {
    return type.trim().toLowerCase();
  }

  static async ensureBarcodeColumns() {
    if (!BarcodeScannerService.ensureBarcodeColumnsPromise) {
      BarcodeScannerService.ensureBarcodeColumnsPromise = (async () => {
        const db = getDatabase();
        const columns = await db.getAllAsync<any>('PRAGMA table_info(items);');
        const hasColumn = (name: string) => columns.some((column: any) => column.name === name);

        if (!hasColumn('barcode_type')) {
          await db.execAsync('ALTER TABLE items ADD COLUMN barcode_type TEXT;');
        }

        if (!hasColumn('barcode_data')) {
          await db.execAsync('ALTER TABLE items ADD COLUMN barcode_data TEXT;');
        }

        await db.execAsync(`
          CREATE INDEX IF NOT EXISTS idx_items_barcode_data
          ON items(barcode_data);
        `);
      })().finally(() => {
        BarcodeScannerService.ensureBarcodeColumnsPromise = null;
      });
    }

    await BarcodeScannerService.ensureBarcodeColumnsPromise;
  }

  static buildDescription(barcode: ScannedBarcode) {
    return `Barcode (${barcode.type}): ${barcode.data}`;
  }

  static buildDefaultName(barcode: ScannedBarcode) {
    return `Barcode ${barcode.data}`;
  }

  static appendBarcodeDescription(currentDescription: string, barcode: ScannedBarcode) {
    const barcodeLine = BarcodeScannerService.buildDescription(barcode);
    const trimmed = currentDescription.trim();
    if (!trimmed) return barcodeLine;
    if (trimmed.includes(barcodeLine)) return trimmed;
    return `${trimmed}\n${barcodeLine}`;
  }

  static async findItemByBarcode(barcode: ScannedBarcode): Promise<BarcodeMatch | null> {
    await BarcodeScannerService.ensureBarcodeColumns();

    const db = getDatabase();
    const dataVariants = BarcodeScannerService.getDataVariants(barcode.data);
    const placeholders = dataVariants.map(() => '?').join(', ');
    const normalizedData = dataVariants[0];
    const legacyDescription = BarcodeScannerService.buildDescription(barcode);

    const row = await db.getFirstAsync<any>(
      `
        SELECT
          i.id,
          i.name,
          i.description,
          i.quantity,
          i.photo_uri,
          i.warranty_expiry,
          i.space_id,
          i.container_id,
          i.barcode_type,
          i.barcode_data,
          s.name AS space_name,
          c.name AS container_name
        FROM items i
        JOIN spaces s ON s.id = i.space_id
        LEFT JOIN containers c ON c.id = i.container_id
        WHERE
          i.barcode_data IN (${placeholders})
          OR i.description LIKE ?
        ORDER BY i.updated_at DESC, i.created_at DESC
        LIMIT 1
      `,
      [...dataVariants, `%${legacyDescription}%`]
    );

    if (!row) return null;

    return {
      id: String(row.id),
      name: row.name,
      description: row.description ?? null,
      quantity: row.quantity ?? 1,
      photoUri: row.photo_uri ?? null,
      warrantyExpiry: row.warranty_expiry ?? null,
      spaceId: String(row.space_id),
      containerId: row.container_id ?? null,
      spaceName: row.space_name,
      containerName: row.container_name ?? null,
      barcodeType: row.barcode_type ?? null,
      barcodeData: row.barcode_data ?? normalizedData,
    };
  }

  static async linkItemToBarcode(itemId: string, barcode: ScannedBarcode): Promise<void> {
    await BarcodeScannerService.ensureBarcodeColumns();

    const db = getDatabase();
    const now = new Date().toISOString();
    await db.runAsync(
      'UPDATE items SET barcode_type = ?, barcode_data = ?, updated_at = ? WHERE id = ?',
      [
        BarcodeScannerService.normalizeType(barcode.type),
        BarcodeScannerService.normalizeData(barcode.data),
        now,
        itemId,
      ]
    );
  }

  static async getDestinations(): Promise<BarcodeDestination[]> {
    await BarcodeScannerService.ensureBarcodeColumns();

    const db = getDatabase();
    const [spaceRows, containerRows] = await Promise.all([
      db.getAllAsync<any>(`
        SELECT id, name
        FROM spaces
        ORDER BY name COLLATE NOCASE ASC
      `),
      db.getAllAsync<any>(`
        SELECT c.id, c.name, c.space_id, s.name AS space_name
        FROM containers c
        LEFT JOIN spaces s ON s.id = c.space_id
        ORDER BY c.name COLLATE NOCASE ASC
      `),
    ]);

    const spaces: BarcodeDestination[] = spaceRows.map((row) => ({
      key: `space-${row.id}`,
      kind: 'space',
      id: String(row.id),
      name: row.name,
      subtitle: 'Space',
      spaceId: String(row.id),
      containerId: null,
    }));

    const containers: BarcodeDestination[] = containerRows.map((row) => ({
      key: `container-${row.id}`,
      kind: 'container',
      id: String(row.id),
      name: row.name,
      subtitle: row.space_name ? `Container in ${row.space_name}` : 'Container',
      spaceId: String(row.space_id),
      containerId: String(row.id),
    }));

    return [...spaces, ...containers];
  }
}
