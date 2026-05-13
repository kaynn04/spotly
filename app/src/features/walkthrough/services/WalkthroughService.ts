import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@synop/walkthrough_done';

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
}
