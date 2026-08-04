export class StorageService {
  static async save(key: string, value: string) {
    console.log("Save:", key, value);
  }

  static async get(key: string) {
    console.log("Get:", key);
    return null;
  }

  static async remove(key: string) {
    console.log("Remove:", key);
  }
}
