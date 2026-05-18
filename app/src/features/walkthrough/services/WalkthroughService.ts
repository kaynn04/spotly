import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@synop/walkthrough_done';
const SPACES_STORAGE_KEY = '@synop/spaces_walkthrough_done';

export class WalkthroughService {
  static async isDone(): Promise<boolean> {
    const value = await AsyncStorage.getItem(STORAGE_KEY);
    return value === 'true';
  }

  static async markDone(): Promise<void> {
    await AsyncStorage.setItem(STORAGE_KEY, 'true');
  }

  static async reset(): Promise<void> {
    await AsyncStorage.removeItem(STORAGE_KEY);
  }

  static async isSpacesDone(): Promise<boolean> {
    const value = await AsyncStorage.getItem(SPACES_STORAGE_KEY);
    return value === 'true';
  }

  static async markSpacesDone(): Promise<void> {
    await AsyncStorage.setItem(SPACES_STORAGE_KEY, 'true');
  }

  static async resetSpaces(): Promise<void> {
    await AsyncStorage.removeItem(SPACES_STORAGE_KEY);
  }
}
