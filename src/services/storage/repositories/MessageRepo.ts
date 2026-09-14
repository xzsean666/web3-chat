import type { StorageEngine } from '../StorageEngine';
import type { ChatMessage, MessageStatus } from '../../../types';

export class MessageRepository {
  private engine: StorageEngine;
  private readonly PREFIX = 'msg:';
  private readonly CONV_MSGS_PREFIX = 'conv_msgs:';
  private readonly PENDING_KEY = 'pending_msgs_index';

  constructor(engine: StorageEngine) {
    this.engine = engine;
  }

  private getMsgKey(id: string): string {
    return `${this.PREFIX}${id}`;
  }

  private getConvIndexKey(conversationId: string): string {
    return `${this.CONV_MSGS_PREFIX}${conversationId}`;
  }

  private async getConvMsgIds(conversationId: string): Promise<string[]> {
    const list = await this.engine.get<string[]>(this.getConvIndexKey(conversationId));
    return list || [];
  }

  private async saveConvMsgIds(conversationId: string, ids: string[]): Promise<void> {
    await this.engine.set(this.getConvIndexKey(conversationId), Array.from(new Set(ids)));
  }

  private async getPendingIds(): Promise<string[]> {
    const list = await this.engine.get<string[]>(this.PENDING_KEY);
    return list || [];
  }

  private async savePendingIds(ids: string[]): Promise<void> {
    await this.engine.set(this.PENDING_KEY, Array.from(new Set(ids)));
  }

  async insertMessage(msg: ChatMessage): Promise<void> {
    await this.engine.set(this.getMsgKey(msg.id), msg);

    // Update conversation message index
    const convIds = await this.getConvMsgIds(msg.conversation_id);
    if (!convIds.includes(msg.id)) {
      convIds.push(msg.id);
      await this.saveConvMsgIds(msg.conversation_id, convIds);
    }

    // If pending, track in pending index
    if (msg.status === 'pending') {
      const pending = await this.getPendingIds();
      if (!pending.includes(msg.id)) {
        pending.push(msg.id);
        await this.savePendingIds(pending);
      }
    }
  }

  async batchInsertMessages(msgs: ChatMessage[]): Promise<void> {
    if (msgs.length === 0) return;

    // 1. Write message entities in parallel
    await Promise.all(msgs.map((msg) => this.engine.set(this.getMsgKey(msg.id), msg)));

    // 2. Group IDs by conversation
    const convMap = new Map<string, string[]>();
    const newPendingIds: string[] = [];

    for (const msg of msgs) {
      if (!convMap.has(msg.conversation_id)) {
        convMap.set(msg.conversation_id, []);
      }
      convMap.get(msg.conversation_id)!.push(msg.id);

      if (msg.status === 'pending') {
        newPendingIds.push(msg.id);
      }
    }

    // 3. Update conversation indexes in parallel
    await Promise.all(
      Array.from(convMap.entries()).map(async ([convId, newIds]) => {
        const existing = await this.getConvMsgIds(convId);
        const merged = Array.from(new Set([...existing, ...newIds]));
        await this.saveConvMsgIds(convId, merged);
      }),
    );

    // 4. Update pending index if needed
    if (newPendingIds.length > 0) {
      const existingPending = await this.getPendingIds();
      const mergedPending = Array.from(new Set([...existingPending, ...newPendingIds]));
      await this.savePendingIds(mergedPending);
    }
  }

  async getMessage(id: string): Promise<ChatMessage | null> {
    return this.engine.get<ChatMessage>(this.getMsgKey(id));
  }

  /**
   * List messages in a conversation with pagination
   * Returns messages sorted chronologically ascending (oldest to newest)
   */
  async listMessages(
    conversationId: string,
    limit: number = 50,
    beforeTimestamp?: number,
  ): Promise<ChatMessage[]> {
    const ids = await this.getConvMsgIds(conversationId);
    if (ids.length === 0) return [];

    const rawList = await Promise.all(ids.map((id) => this.getMessage(id)));
    let messages = rawList.filter((msg): msg is ChatMessage => {
      if (!msg) return false;
      if (beforeTimestamp !== undefined && msg.created_at >= beforeTimestamp) {
        return false;
      }
      return true;
    });

    // Sort ascending by created_at
    messages.sort((a, b) => a.created_at - b.created_at);

    if (messages.length > limit) {
      // Keep the most recent `limit` messages
      messages = messages.slice(messages.length - limit);
    }

    return messages;
  }

  async updateMessageStatus(
    id: string,
    status: MessageStatus,
    timestamps?: { delivered_at?: number; read_at?: number },
  ): Promise<void> {
    const msg = await this.getMessage(id);
    if (!msg) return;

    msg.status = status;
    if (timestamps?.delivered_at) {
      msg.delivered_at = timestamps.delivered_at;
    }
    if (timestamps?.read_at) {
      msg.read_at = timestamps.read_at;
    }

    await this.engine.set(this.getMsgKey(id), msg);

    // Remove from pending if status is no longer pending
    if (status !== 'pending') {
      const pending = await this.getPendingIds();
      if (pending.includes(id)) {
        await this.savePendingIds(pending.filter((pid) => pid !== id));
      }
    }
  }

  async recallMessage(id: string, recalledAt: number): Promise<void> {
    const msg = await this.getMessage(id);
    if (!msg) return;

    msg.status = 'recalled';
    msg.recalled_at = recalledAt;
    msg.content = 'Message recalled';
    await this.engine.set(this.getMsgKey(id), msg);
  }

  async deleteMessage(id: string): Promise<void> {
    const msg = await this.getMessage(id);
    if (!msg) return;

    await this.engine.remove(this.getMsgKey(id));

    const convIds = await this.getConvMsgIds(msg.conversation_id);
    await this.saveConvMsgIds(
      msg.conversation_id,
      convIds.filter((mId) => mId !== id),
    );

    const pending = await this.getPendingIds();
    if (pending.includes(id)) {
      await this.savePendingIds(pending.filter((pid) => pid !== id));
    }
  }

  async getPendingMessages(): Promise<ChatMessage[]> {
    const pendingIds = await this.getPendingIds();
    if (pendingIds.length === 0) return [];

    const rawList = await Promise.all(pendingIds.map((id) => this.getMessage(id)));
    return rawList.filter((msg): msg is ChatMessage => msg !== null && msg.status === 'pending');
  }
}
