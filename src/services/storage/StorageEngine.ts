export interface IStorageDriver {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
  clear(): Promise<void>;
  getAllKeys(): Promise<string[]>;
}

export class MemoryStorageDriver implements IStorageDriver {
  private map = new Map<string, string>();

  async getItem(key: string): Promise<string | null> {
    return this.map.get(key) ?? null;
  }

  async setItem(key: string, value: string): Promise<void> {
    this.map.set(key, value);
  }

  async removeItem(key: string): Promise<void> {
    this.map.delete(key);
  }

  async clear(): Promise<void> {
    this.map.clear();
  }

  async getAllKeys(): Promise<string[]> {
    return Array.from(this.map.keys());
  }
}

export class StorageEngine {
  private driver: IStorageDriver;

  constructor(driver?: IStorageDriver) {
    this.driver = driver ?? new MemoryStorageDriver();
  }

  public getDriver(): IStorageDriver {
    return this.driver;
  }

  public setDriver(driver: IStorageDriver): void {
    this.driver = driver;
  }

  async get<T>(key: string): Promise<T | null> {
    const raw = await this.driver.getItem(key);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  async set<T>(key: string, value: T): Promise<void> {
    await this.driver.setItem(key, JSON.stringify(value));
  }

  async remove(key: string): Promise<void> {
    await this.driver.removeItem(key);
  }

  async clear(): Promise<void> {
    await this.driver.clear();
  }

  async listKeys(prefix?: string): Promise<string[]> {
    const all = await this.driver.getAllKeys();
    if (!prefix) return all;
    return all.filter((k) => k.startsWith(prefix));
  }
}
