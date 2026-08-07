import AsyncStorage from "@react-native-async-storage/async-storage";

export class StorageService {
  static async save(key: string, value: string): Promise<void> {
    await AsyncStorage.setItem(key, value);
  }

  static async get(key: string): Promise<string | null> {
    return await AsyncStorage.getItem(key);
  }

  static async remove(key: string): Promise<void> {
    await AsyncStorage.removeItem(key);
  }

  static async clear(): Promise<void> {
    await AsyncStorage.clear();
  }
}

export const storage = StorageService;
