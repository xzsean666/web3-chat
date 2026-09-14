import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WorkerApiClient, AuthService } from '../../src/services/worker';
import { WalletCoreService, KeyStoreService } from '../../src/services/wallet';
import { resetMockStore } from '../mocks/expo-secure-store';

describe('Web3 Chat Worker Client & SIWE Authentication Service (TASK-006)', () => {
  let keyStore: KeyStoreService;
  let walletCore: WalletCoreService;
  let mockFetch: ReturnType<typeof vi.fn>;

  const TEST_PK = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
  const TEST_ADDR = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'.toLowerCase();

  beforeEach(async () => {
    resetMockStore();
    keyStore = new KeyStoreService();
    walletCore = new WalletCoreService(keyStore);
    await walletCore.importFromPrivateKey(TEST_PK, 'Test Account');

    mockFetch = vi.fn();
  });

  describe('WorkerApiClient Direct Endpoints', () => {
    it('should request challenge nonce with address parameter', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          nonce: 'nonce123',
          message: 'Sign in challenge',
          expires_at: 1700000300,
        }),
      });

      const client = new WorkerApiClient({
        baseUrl: 'https://worker.test',
        fetchFn: mockFetch,
      });

      const nonceRes = await client.getNonce(TEST_ADDR);
      expect(nonceRes.nonce).toBe('nonce123');
      expect(mockFetch).toHaveBeenCalledWith(
        `https://worker.test/auth/nonce?address=${encodeURIComponent(TEST_ADDR)}`,
        expect.objectContaining({ method: 'GET' }),
      );
    });

    it('should send text message and attach Bearer token automatically', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          message: {
            id: 'msg-abc',
            conversation_id: 'dm:0x1:0x2',
            sender_id: TEST_ADDR,
            type: 'text',
            content: 'Hello Worker',
            retention: 'permanent',
            status: 'sent',
            expires_at: 0,
            delivered_at: null,
            read_at: null,
            created_at: 1700000000,
          },
        }),
      });

      const client = new WorkerApiClient({
        baseUrl: 'https://worker.test',
        getToken: async () => 'test-bearer-token',
        fetchFn: mockFetch,
      });

      const msg = await client.sendMessage('dm:0x1:0x2', {
        content: 'Hello Worker',
        retention: 'permanent',
      });

      expect(msg.id).toBe('msg-abc');
      expect(msg.content).toBe('Hello Worker');
      expect(mockFetch).toHaveBeenCalledWith(
        'https://worker.test/conversations/dm%3A0x1%3A0x2/messages',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer test-bearer-token',
          }),
        }),
      );
    });

    it('should send ACK, read, and recall requests', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true }),
      });

      const client = new WorkerApiClient({
        baseUrl: 'https://worker.test',
        getToken: async () => 'token-123',
        fetchFn: mockFetch,
      });

      await client.ackMessage('msg-1');
      await client.readMessage('msg-1');
      await client.recallMessage('msg-1');
      await client.ackMessagesBatch(['msg-1', 'msg-2']);
      await client.readMessagesBatch(['msg-1', 'msg-2']);

      expect(mockFetch).toHaveBeenCalledTimes(5);
    });

    it('should parse sync result with messages, receipts, and recalls', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          messages: [
            {
              id: 'msg-synced',
              conversation_id: 'dm:0x1:0x2',
              sender_id: '0x2',
              type: 'text',
              content: 'Sync msg',
              status: 'delivered',
              created_at: 1700000050,
            },
          ],
          receipts: [{ id: 'r1', message_id: 'msg-synced', status: 'delivered', timestamp: 1700000060 }],
          recalls: [{ id: 'msg-old', recalled_at: 1700000070 }],
          last_timestamp: 1700000070,
        }),
      });

      const client = new WorkerApiClient({
        baseUrl: 'https://worker.test',
        getToken: async () => 'sync-token',
        fetchFn: mockFetch,
      });

      const res = await client.sync(1700000000, 50);
      expect(res.messages.length).toBe(1);
      expect(res.messages[0].id).toBe('msg-synced');
      expect(res.receipts.length).toBe(1);
      expect(res.recalls.length).toBe(1);
      expect(res.last_timestamp).toBe(1700000070);
    });
  });

  describe('AuthService SIWE Authentication Flow', () => {
    it('should complete SIWE login flow with wallet signature and obtain session', async () => {
      // 1. Nonce response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          nonce: 'test-nonce-456',
          message: `web3-chat login challenge\nAddress: ${TEST_ADDR}\nNonce: test-nonce-456`,
          expires_at: Math.floor(Date.now() / 1000) + 300,
        }),
      });

      // 2. Verify response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          token: 'jwt-session-token-xyz',
          expires_at: Math.floor(Date.now() / 1000) + 86400 * 7,
          user: {
            id: 'user-uuid-1',
            wallet_address: TEST_ADDR,
          },
        }),
      });

      const auth = new AuthService(walletCore, keyStore, 'https://worker.test');
      (auth.getClient() as any).fetchFn = mockFetch;

      expect(await auth.isAuthenticated()).toBe(false);

      const session = await auth.login(TEST_ADDR);
      expect(session.token).toBe('jwt-session-token-xyz');
      expect(session.wallet_address).toBe(TEST_ADDR);

      expect(await auth.isAuthenticated()).toBe(true);

      const cachedSession = await auth.getSession();
      expect(cachedSession?.token).toBe('jwt-session-token-xyz');

      // Logout
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });
      await auth.logout();
      expect(await auth.isAuthenticated()).toBe(false);
    });
  });
});
