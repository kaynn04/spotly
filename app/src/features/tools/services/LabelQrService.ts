import { getDatabase } from '@/src/db/client';

export type LabelTargetKind = 'space' | 'container' | 'item';

export interface LabelTarget {
  id: string;
  kind: LabelTargetKind;
  name: string;
  subtitle: string;
  location: string;
  countLabel?: string;
}

interface SynopQrPayload {
  app?: string;
  version?: number;
  type?: LabelTargetKind;
  id?: string;
}

function formatCount(count: number, singular: string, plural: string) {
  return `${count} ${count === 1 ? singular : plural}`;
}

export class LabelQrService {
  static buildPayload(target: LabelTarget): string {
    return JSON.stringify({
      app: 'synop',
      version: 1,
      type: target.kind,
      id: target.id,
    });
  }

  static buildCode(target: LabelTarget): string {
    return `SYNOP-${target.kind.toUpperCase()}-${target.id.slice(0, 8).toUpperCase()}`;
  }

  static parsePayload(data: string): SynopQrPayload | null {
    try {
      const parsed = JSON.parse(data) as SynopQrPayload;
      if (parsed.app !== 'synop') return null;
      if (!parsed.id || !parsed.type) return null;
      if (!['space', 'container', 'item'].includes(parsed.type)) return null;
      return parsed;
    } catch {
      return null;
    }
  }

  static async resolveScannedData(data: string): Promise<LabelTarget | null> {
    const payload = LabelQrService.parsePayload(data);
    if (!payload?.id || !payload.type) return null;

    const targets = await LabelQrService.getTargets();
    return targets.find((target) => target.id === payload.id && target.kind === payload.type) ?? null;
  }

  static async getTargets(): Promise<LabelTarget[]> {
    const db = getDatabase();

    const [spaceRows, containerRows, itemRows] = await Promise.all([
      db.getAllAsync<any>(`
        SELECT
          s.id,
          s.name,
          (SELECT COUNT(*) FROM containers c WHERE c.space_id = s.id) AS container_count,
          (SELECT COUNT(*) FROM items i WHERE i.space_id = s.id) AS item_count
        FROM spaces s
        ORDER BY s.name COLLATE NOCASE ASC
      `),
      db.getAllAsync<any>(`
        SELECT
          c.id,
          c.name,
          s.name AS space_name,
          (SELECT COUNT(*) FROM items i WHERE i.container_id = c.id) AS item_count
        FROM containers c
        LEFT JOIN spaces s ON s.id = c.space_id
        ORDER BY c.name COLLATE NOCASE ASC
      `),
      db.getAllAsync<any>(`
        SELECT
          i.id,
          i.name,
          i.quantity,
          s.name AS space_name,
          c.name AS container_name
        FROM items i
        LEFT JOIN spaces s ON s.id = i.space_id
        LEFT JOIN containers c ON c.id = i.container_id
        ORDER BY i.name COLLATE NOCASE ASC
      `),
    ]);

    const spaces: LabelTarget[] = spaceRows.map((row) => ({
      id: String(row.id),
      kind: 'space',
      name: row.name,
      subtitle: 'Space label',
      location: 'Root location',
      countLabel: `${formatCount(row.container_count ?? 0, 'container', 'containers')} / ${formatCount(row.item_count ?? 0, 'item', 'items')}`,
    }));

    const containers: LabelTarget[] = containerRows.map((row) => ({
      id: String(row.id),
      kind: 'container',
      name: row.name,
      subtitle: 'Container label',
      location: row.space_name ? `In ${row.space_name}` : 'No space',
      countLabel: formatCount(row.item_count ?? 0, 'item', 'items'),
    }));

    const items: LabelTarget[] = itemRows.map((row) => ({
      id: String(row.id),
      kind: 'item',
      name: row.name,
      subtitle: 'Item label',
      location: row.container_name
        ? `${row.space_name ?? 'No space'} / ${row.container_name}`
        : row.space_name ?? 'No space',
      countLabel: formatCount(row.quantity ?? 1, 'unit', 'units'),
    }));

    return [...spaces, ...containers, ...items];
  }
}
