import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Item } from '@/src/models/Item';
import { ItemService } from '@/src/services/ItemService';

const RECENT_ITEMS_KEY = 'synop:recent-opened-items';
const MAX_RECENT_ITEMS = 8;

export interface RecentOpenedItem {
  id: string;
  name: string;
  spaceName: string;
  containerName: string | null;
}

async function readIds(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(RECENT_ITEMS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((id) => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

async function writeIds(ids: string[]) {
  await AsyncStorage.setItem(RECENT_ITEMS_KEY, JSON.stringify(ids.slice(0, MAX_RECENT_ITEMS)));
}

function toRecentItem(item: Item): RecentOpenedItem {
  return {
    id: item.id,
    name: item.name,
    spaceName: item.space?.name ?? 'Unknown space',
    containerName: item.container?.name ?? null,
  };
}

export class RecentItemService {
  static async recordOpened(itemId: string): Promise<void> {
    const ids = await readIds();
    await writeIds([itemId, ...ids.filter((id) => id !== itemId)]);
  }

  static async getRecentOpened(): Promise<RecentOpenedItem[]> {
    const ids = await readIds();
    if (ids.length === 0) return [];

    const items = await Promise.all(ids.map((id) => ItemService.getItemById(id).catch(() => null)));
    const foundItems = items.filter((item): item is Item => !!item && !item.lostAt);
    const foundIds = new Set(foundItems.map((item) => item.id));
    const nextIds = ids.filter((id) => foundIds.has(id));
    if (nextIds.length !== ids.length) {
      await writeIds(nextIds).catch(() => {});
    }

    return foundItems.map(toRecentItem);
  }
}
