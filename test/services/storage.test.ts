import { describe, it, expect, beforeEach } from 'vitest';
import {
  StorageEngine,
  ConversationRepository,
  MessageRepository,
  SyncCheckpointRepository,
} from '../../src/services/storage';
import type { ChatMessage, Conversation } from '../../src/types';

describe('Local-First Storage Engine (TASK-005)', () => {
  let engine: StorageEngine;
  let convRepo: ConversationRepository;
  let msgRepo: MessageRepository;
  let syncRepo: SyncCheckpointRepository;

  beforeEach(async () => {
    engine = new StorageEngine();
    convRepo = new ConversationRepository(engine);
    msgRepo = new MessageRepository(engine);
    syncRepo = new SyncCheckpointRepository(engine);
  });

  describe('StorageEngine Core', () => {
    it('should set, get, and remove values', async () => {
      await engine.set('user:name', 'Alice');
      const val = await engine.get<string>('user:name');
      expect(val).toBe('Alice');

      await engine.remove('user:name');
      const removed = await engine.get<string>('user:name');
      expect(removed).toBeNull();
    });

    it('should list keys matching prefix', async () => {
      await engine.set('chat:1', 'a');
      await engine.set('chat:2', 'b');
      await engine.set('other:1', 'c');

      const chatKeys = await engine.listKeys('chat:');
      expect(chatKeys.length).toBe(2);
      expect(chatKeys).toContain('chat:1');
      expect(chatKeys).toContain('chat:2');
    });
  });

  describe('ConversationRepository', () => {
    it('should list conversations sorted by latest message timestamp descending', async () => {
      const conv1: Conversation = {
        id: 'dm:0x1:0x2',
        type: 'dm',
        title: 'Alice',
        unread_count: 0,
        updated_at: 1000,
        last_message_at: 1000,
      };

      const conv2: Conversation = {
        id: 'dm:0x1:0x3',
        type: 'dm',
        title: 'Bob',
        unread_count: 0,
        updated_at: 3000,
        last_message_at: 3000,
      };

      const conv3: Conversation = {
        id: 'group:101',
        type: 'group',
        title: 'Crypto Group',
        unread_count: 0,
        updated_at: 2000,
        last_message_at: 2000,
      };

      await convRepo.upsertConversation(conv1);
      await convRepo.upsertConversation(conv2);
      await convRepo.upsertConversation(conv3);

      const list = await convRepo.listConversations();
      expect(list.length).toBe(3);
      expect(list[0].id).toBe('dm:0x1:0x3'); // 3000
      expect(list[1].id).toBe('group:101'); // 2000
      expect(list[2].id).toBe('dm:0x1:0x2'); // 1000
    });

    it('should increment and clear unread counts', async () => {
      const conv: Conversation = {
        id: 'dm:0x1:0x2',
        type: 'dm',
        title: 'Alice',
        unread_count: 0,
        updated_at: 1000,
      };
      await convRepo.upsertConversation(conv);

      await convRepo.incrementUnread('dm:0x1:0x2');
      await convRepo.incrementUnread('dm:0x1:0x2');

      let updated = await convRepo.getConversation('dm:0x1:0x2');
      expect(updated?.unread_count).toBe(2);

      await convRepo.clearUnread('dm:0x1:0x2');
      updated = await convRepo.getConversation('dm:0x1:0x2');
      expect(updated?.unread_count).toBe(0);
    });

    it('should delete a conversation', async () => {
      const conv: Conversation = {
        id: 'dm:0x1:0x2',
        type: 'dm',
        title: 'Alice',
        unread_count: 0,
        updated_at: 1000,
      };
      await convRepo.upsertConversation(conv);
      await convRepo.deleteConversation('dm:0x1:0x2');

      const list = await convRepo.listConversations();
      expect(list.length).toBe(0);
      const fetched = await convRepo.getConversation('dm:0x1:0x2');
      expect(fetched).toBeNull();
    });
  });

  describe('MessageRepository', () => {
    it('should insert, list, and paginate messages in chronological ascending order', async () => {
      const convId = 'dm:0x1:0x2';
      const m1: ChatMessage = {
        id: 'msg-1',
        conversation_id: convId,
        sender_id: '0x1',
        type: 'text',
        content: 'Hi',
        retention: 'permanent',
        status: 'delivered',
        expires_at: 0,
        delivered_at: 1000,
        read_at: null,
        created_at: 1000,
      };

      const m2: ChatMessage = {
        id: 'msg-2',
        conversation_id: convId,
        sender_id: '0x2',
        type: 'text',
        content: 'Hello',
        retention: 'permanent',
        status: 'delivered',
        expires_at: 0,
        delivered_at: 2000,
        read_at: null,
        created_at: 2000,
      };

      const m3: ChatMessage = {
        id: 'msg-3',
        conversation_id: convId,
        sender_id: '0x1',
        type: 'text',
        content: 'How are you?',
        retention: 'permanent',
        status: 'sent',
        expires_at: 0,
        delivered_at: null,
        read_at: null,
        created_at: 3000,
      };

      await msgRepo.batchInsertMessages([m2, m1, m3]);

      const messages = await msgRepo.listMessages(convId);
      expect(messages.length).toBe(3);
      expect(messages[0].id).toBe('msg-1');
      expect(messages[1].id).toBe('msg-2');
      expect(messages[2].id).toBe('msg-3');

      // Pagination with limit
      const paginated = await msgRepo.listMessages(convId, 2);
      expect(paginated.length).toBe(2);
      expect(paginated[0].id).toBe('msg-2');
      expect(paginated[1].id).toBe('msg-3');
    });

    it('should track pending messages and update status', async () => {
      const msg: ChatMessage = {
        id: 'pending-1',
        conversation_id: 'dm:0x1:0x2',
        sender_id: '0x1',
        type: 'text',
        content: 'Pending text',
        retention: 'permanent',
        status: 'pending',
        expires_at: 0,
        delivered_at: null,
        read_at: null,
        created_at: Date.now(),
      };

      await msgRepo.insertMessage(msg);

      let pending = await msgRepo.getPendingMessages();
      expect(pending.length).toBe(1);
      expect(pending[0].id).toBe('pending-1');

      // Update to sent
      await msgRepo.updateMessageStatus('pending-1', 'sent');
      pending = await msgRepo.getPendingMessages();
      expect(pending.length).toBe(0);

      const updated = await msgRepo.getMessage('pending-1');
      expect(updated?.status).toBe('sent');
    });

    it('should mark recalled message within recall window', async () => {
      const msg: ChatMessage = {
        id: 'msg-to-recall',
        conversation_id: 'dm:0x1:0x2',
        sender_id: '0x1',
        type: 'text',
        content: 'Secret message',
        retention: 'permanent',
        status: 'delivered',
        expires_at: 0,
        delivered_at: 1000,
        read_at: null,
        created_at: 1000,
      };
      await msgRepo.insertMessage(msg);

      const recallTime = 1020;
      await msgRepo.recallMessage('msg-to-recall', recallTime);

      const recalled = await msgRepo.getMessage('msg-to-recall');
      expect(recalled?.status).toBe('recalled');
      expect(recalled?.recalled_at).toBe(recallTime);
      expect(recalled?.content).toBe('Message recalled');
    });
  });

  describe('SyncCheckpointRepository', () => {
    it('should initialize at 0 and persist new sync timestamp', async () => {
      const initial = await syncRepo.getLastSyncTimestamp();
      expect(initial).toBe(0);

      const now = 1726300000;
      await syncRepo.setLastSyncTimestamp(now);

      const updated = await syncRepo.getLastSyncTimestamp();
      expect(updated).toBe(now);

      await syncRepo.reset();
      const reset = await syncRepo.getLastSyncTimestamp();
      expect(reset).toBe(0);
    });
  });
});
