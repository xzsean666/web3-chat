import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ChatEngineService } from '../../src/features/chat/ChatEngineService';
import { PeriodicSyncService } from '../../src/features/chat/PeriodicSyncService';
import {
  StorageEngine,
  ConversationRepository,
  MessageRepository,
  SyncCheckpointRepository,
} from '../../src/services/storage';
import { WorkerApiClient } from '../../src/services/worker/WorkerApiClient';
import { AuthService } from '../../src/services/worker/AuthService';
import { WalletCoreService, KeyStoreService } from '../../src/services/wallet';
import { resetMockStore } from '../mocks/expo-secure-store';

describe('Chat Core Engine & Periodic Sync Service (TASK-008)', () => {
  let engine: StorageEngine;
  let convRepo: ConversationRepository;
  let msgRepo: MessageRepository;
  let syncRepo: SyncCheckpointRepository;
  let keyStore: KeyStoreService;
  let walletCore: WalletCoreService;
  let authService: AuthService;
  let workerClient: WorkerApiClient;
  let chatEngine: ChatEngineService;
  let syncService: PeriodicSyncService;

  const TEST_ADDR = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'.toLowerCase();
  const PEER_ADDR = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8'.toLowerCase();
  const CONV_ID = `dm:${TEST_ADDR < PEER_ADDR ? `${TEST_ADDR}:${PEER_ADDR}` : `${PEER_ADDR}:${TEST_ADDR}`}`;

  beforeEach(async () => {
    resetMockStore();
    engine = new StorageEngine();
    convRepo = new ConversationRepository(engine);
    msgRepo = new MessageRepository(engine);
    syncRepo = new SyncCheckpointRepository(engine);

    keyStore = new KeyStoreService();
    walletCore = new WalletCoreService(keyStore);

    workerClient = new WorkerApiClient({ baseUrl: 'https://worker.test' });
    authService = new AuthService(walletCore, keyStore, 'https://worker.test');

    // Simulate logged in user
    vi.spyOn(authService, 'isAuthenticated').mockResolvedValue(true);
    vi.spyOn(authService, 'getSession').mockResolvedValue({
      token: 'mock-jwt-token',
      expires_at: 9999999999,
      wallet_address: TEST_ADDR,
      user_id: 'user-uuid-1',
    });

    chatEngine = new ChatEngineService(convRepo, msgRepo, workerClient, authService);
    syncService = new PeriodicSyncService(workerClient, msgRepo, convRepo, syncRepo, authService);
  });

  afterEach(() => {
    syncService.stopPolling();
  });

  describe('Local-First Send Message Flow', () => {
    it('should save locally as pending when worker call fails (offline)', async () => {
      vi.spyOn(workerClient, 'sendMessage').mockRejectedValueOnce(new Error('Network error'));

      const result = await chatEngine.sendMessage(CONV_ID, 'Hello Offline');
      expect(result.status).toBe('pending');
      expect(result.content).toBe('Hello Offline');

      const saved = await msgRepo.getMessage(result.id);
      expect(saved?.status).toBe('pending');

      const conv = await convRepo.getConversation(CONV_ID);
      expect(conv?.last_message).toBe('Hello Offline');
    });

    it('should update local record to sent on worker success', async () => {
      vi.spyOn(workerClient, 'sendMessage').mockResolvedValueOnce({
        id: 'remote-msg-123',
        conversation_id: CONV_ID,
        sender_id: TEST_ADDR,
        type: 'text',
        content: 'Hello Online',
        retention: 'permanent',
        status: 'sent',
        expires_at: 0,
        delivered_at: null,
        read_at: null,
        created_at: 1700000000,
      });

      const result = await chatEngine.sendMessage(CONV_ID, 'Hello Online');
      expect(result.status).toBe('sent');
      expect(result.id).toBe('remote-msg-123');

      const saved = await msgRepo.getMessage('remote-msg-123');
      expect(saved?.status).toBe('sent');
    });

    it('should retry sending pending messages once online', async () => {
      // 1. Send while offline
      vi.spyOn(workerClient, 'sendMessage').mockRejectedValueOnce(new Error('Offline'));
      await chatEngine.sendMessage(CONV_ID, 'Queued msg');

      let pending = await msgRepo.getPendingMessages();
      expect(pending.length).toBe(1);

      // 2. Worker comes back online
      vi.spyOn(workerClient, 'sendMessage').mockResolvedValueOnce({
        id: 'remote-recovered',
        conversation_id: CONV_ID,
        sender_id: TEST_ADDR,
        type: 'text',
        content: 'Queued msg',
        retention: 'permanent',
        status: 'sent',
        expires_at: 0,
        delivered_at: null,
        read_at: null,
        created_at: 1700000010,
      });

      const sentCount = await chatEngine.retryPendingMessages();
      expect(sentCount).toBe(1);

      pending = await msgRepo.getPendingMessages();
      expect(pending.length).toBe(0);
    });
  });

  describe('Periodic Sync Service', () => {
    it('should pull new incoming messages and increment unread count for peer', async () => {
      vi.spyOn(workerClient, 'sync').mockResolvedValueOnce({
        messages: [
          {
            id: 'peer-msg-1',
            conversation_id: CONV_ID,
            sender_id: PEER_ADDR,
            type: 'text',
            content: 'Hello from peer',
            retention: 'permanent',
            status: 'delivered',
            expires_at: 0,
            delivered_at: null,
            read_at: null,
            created_at: 1700000100,
          },
        ],
        receipts: [],
        recalls: [],
        last_timestamp: 1700000100,
      });

      const ackSpy = vi.spyOn(workerClient, 'ackMessagesBatch').mockResolvedValueOnce(undefined);

      const res = await syncService.syncOnce();
      expect(res?.messages.length).toBe(1);

      // Saved in messageRepo
      const savedMsg = await msgRepo.getMessage('peer-msg-1');
      expect(savedMsg?.content).toBe('Hello from peer');

      // Conversation updated with unread count 1
      const conv = await convRepo.getConversation(CONV_ID);
      expect(conv?.unread_count).toBe(1);
      expect(conv?.last_message).toBe('Hello from peer');

      // Sent ACK to worker
      expect(ackSpy).toHaveBeenCalledWith(['peer-msg-1']);

      // Checkpoint updated
      const checkpoint = await syncRepo.getLastSyncTimestamp();
      expect(checkpoint).toBe(1700000100);
    });

    it('should process message recalls during sync', async () => {
      // First insert an existing message
      await msgRepo.insertMessage({
        id: 'msg-to-recall-later',
        conversation_id: CONV_ID,
        sender_id: PEER_ADDR,
        type: 'text',
        content: 'Original content',
        retention: 'permanent',
        status: 'delivered',
        expires_at: 0,
        delivered_at: null,
        read_at: null,
        created_at: 1700000200,
      });

      vi.spyOn(workerClient, 'sync').mockResolvedValueOnce({
        messages: [],
        receipts: [],
        recalls: [{ id: 'msg-to-recall-later', recalled_at: 1700000215 }],
        last_timestamp: 1700000220,
      });

      await syncService.syncOnce();

      const recalled = await msgRepo.getMessage('msg-to-recall-later');
      expect(recalled?.status).toBe('recalled');
      expect(recalled?.content).toBe('Message recalled');
    });
  });
});
