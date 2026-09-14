import { StorageEngine } from './StorageEngine';
import { ConversationRepository } from './repositories/ConversationRepo';
import { MessageRepository } from './repositories/MessageRepo';

export * from './StorageEngine';
export * from './repositories/ConversationRepo';
export * from './repositories/MessageRepo';

export class SyncCheckpointRepository {
  private engine: StorageEngine;
  private readonly CHECKPOINT_KEY = 'sync_last_timestamp';

  constructor(engine: StorageEngine) {
    this.engine = engine;
  }

  async getLastSyncTimestamp(): Promise<number> {
    const ts = await this.engine.get<number>(this.CHECKPOINT_KEY);
    return ts ?? 0;
  }

  async setLastSyncTimestamp(timestamp: number): Promise<void> {
    await this.engine.set(this.CHECKPOINT_KEY, timestamp);
  }

  async reset(): Promise<void> {
    await this.engine.remove(this.CHECKPOINT_KEY);
  }
}

// Default Singleton instances
export const storageEngine = new StorageEngine();
export const conversationRepo = new ConversationRepository(storageEngine);
export const messageRepo = new MessageRepository(storageEngine);
export const syncCheckpointRepo = new SyncCheckpointRepository(storageEngine);
