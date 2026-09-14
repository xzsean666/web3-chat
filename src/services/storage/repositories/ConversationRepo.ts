import type { StorageEngine } from '../StorageEngine';
import type { Conversation } from '../../../types';

export class ConversationRepository {
  private engine: StorageEngine;
  private readonly PREFIX = 'conv:';
  private readonly INDEX_KEY = 'conv_index';

  constructor(engine: StorageEngine) {
    this.engine = engine;
  }

  private getKey(id: string): string {
    return `${this.PREFIX}${id}`;
  }

  private async getIndex(): Promise<string[]> {
    const list = await this.engine.get<string[]>(this.INDEX_KEY);
    return list || [];
  }

  private async saveIndex(index: string[]): Promise<void> {
    await this.engine.set(this.INDEX_KEY, Array.from(new Set(index)));
  }

  async upsertConversation(conversation: Conversation): Promise<void> {
    const key = this.getKey(conversation.id);
    await this.engine.set(key, conversation);

    const index = await this.getIndex();
    if (!index.includes(conversation.id)) {
      index.push(conversation.id);
      await this.saveIndex(index);
    }
  }

  async getConversation(id: string): Promise<Conversation | null> {
    return this.engine.get<Conversation>(this.getKey(id));
  }

  /**
   * List all conversations sorted by latest message timestamp descending
   */
  async listConversations(): Promise<Conversation[]> {
    const index = await this.getIndex();
    if (index.length === 0) return [];

    const rawList = await Promise.all(index.map((id) => this.getConversation(id)));
    const results = rawList.filter((c): c is Conversation => c !== null);

    // Sort descending by last_message_at or updated_at
    results.sort((a, b) => {
      const timeA = a.last_message_at || a.updated_at || 0;
      const timeB = b.last_message_at || b.updated_at || 0;
      return timeB - timeA;
    });

    return results;
  }

  async incrementUnread(id: string): Promise<void> {
    const conv = await this.getConversation(id);
    if (conv) {
      conv.unread_count = (conv.unread_count || 0) + 1;
      conv.updated_at = Date.now();
      await this.upsertConversation(conv);
    }
  }

  async clearUnread(id: string): Promise<void> {
    const conv = await this.getConversation(id);
    if (conv) {
      conv.unread_count = 0;
      conv.updated_at = Date.now();
      await this.upsertConversation(conv);
    }
  }

  async deleteConversation(id: string): Promise<void> {
    await this.engine.remove(this.getKey(id));
    const index = await this.getIndex();
    const nextIndex = index.filter((item) => item !== id);
    await this.saveIndex(nextIndex);
  }
}
