/**
 * UserService
 *
 * Persists user name locally using AsyncStorage.
 * No sign-up required -- just a name prompt on first launch.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const USER_NAME_KEY = '@spotly/user_name';

export const UserService = {
  async getName(): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(USER_NAME_KEY);
    } catch {
      return null;
    }
  },

  async setName(name: string): Promise<void> {
    await AsyncStorage.setItem(USER_NAME_KEY, name.trim());
  },

  async hasName(): Promise<boolean> {
    const name = await UserService.getName();
    return name !== null && name.trim().length > 0;
  },
};
