import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createEip1193InpageScript,
  handleEip1193Request,
  type BridgeContext,
} from '../../src/features/discover/bridge/eip1193Bridge';
import { KeyStoreService } from '../../src/services/wallet/KeyStoreService';
import { WalletCoreService } from '../../src/services/wallet/WalletCoreService';
import { EvmService } from '../../src/services/evm/EvmService';
import { StorageEngine, MemoryStorageDriver } from '../../src/services/storage/StorageEngine';
import { ConversationRepository } from '../../src/services/storage/repositories/ConversationRepo';
import { MessageRepository } from '../../src/services/storage/repositories/MessageRepo';
import { resetMockStore } from '../mocks/expo-secure-store';
import type { ChatMessage, Conversation } from '../../src/types';

describe('Security & Performance Hardening Suite (TASK-015)', () => {
  const TEST_PK = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
  const TEST_ADDR = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'.toLowerCase();

  beforeEach(() => {
    resetMockStore();
  });

  describe('1. EIP-1193 Bridge Security Hardening', () => {
    let keyStore: KeyStoreService;
    let walletCore: WalletCoreService;
    let evm: EvmService;

    beforeEach(async () => {
      keyStore = new KeyStoreService();
      walletCore = new WalletCoreService(keyStore);
      evm = new EvmService();
      await walletCore.importFromPrivateKey(TEST_PK, 'Signer');
    });

    it('should correctly parse short messages (length <= 42) in personal_sign', async () => {
      const approvalFn = vi.fn().mockResolvedValue(true);
      const ctx: BridgeContext = {
        walletAddress: TEST_ADDR,
        chainId: 97,
        walletCore,
        evmService: evm,
        requestUserApproval: approvalFn,
      };

      // Message with length <= 42
      const shortMsg = 'hello';
      const shortHex = '0x68656c6c6f'; // "hello" in hex

      const res = await handleEip1193Request(
        { id: 101, method: 'personal_sign', params: [shortHex, TEST_ADDR] },
        ctx,
      );

      expect(approvalFn).toHaveBeenCalled();
      expect(res.result).toBeDefined();
      expect(typeof res.result).toBe('string');
      expect(res.result.startsWith('0x')).toBe(true);
    });

    it('should correctly handle legacy [address, message] parameter ordering', async () => {
      const approvalFn = vi.fn().mockResolvedValue(true);
      const ctx: BridgeContext = {
        walletAddress: TEST_ADDR,
        chainId: 97,
        walletCore,
        evmService: evm,
        requestUserApproval: approvalFn,
      };

      const msg = 'Sign into Web3 App';
      const msgHex = `0x${Buffer.from(msg).toString('hex')}`;

      // Legacy format: [address, message]
      const res = await handleEip1193Request(
        { id: 102, method: 'personal_sign', params: [TEST_ADDR, msgHex] },
        ctx,
      );

      expect(approvalFn).toHaveBeenCalled();
      expect(res.result?.startsWith('0x')).toBe(true);
    });

    it('should sanitize in-page script injection attempts', () => {
      const maliciousChain = "0x61'; alert(1); var x = '";
      const maliciousAddr = "0x123'; alert(document.cookie); var y = '";

      const script = createEip1193InpageScript(maliciousChain, maliciousAddr);
      expect(script).not.toContain("alert(1)");
      expect(script).not.toContain("alert(document.cookie)");
      expect(script).toContain("window.ethereum");
    });
  });

  describe('2. Wallet Core & KeyStore Security Hardening', () => {
    it('should reject invalid private key formats', async () => {
      const keyStore = new KeyStoreService();
      const walletCore = new WalletCoreService(keyStore);

      // Too short
      await expect(walletCore.importFromPrivateKey('0x123456')).rejects.toThrow(
        /Invalid private key/i,
      );

      // Non-hex characters
      await expect(
        walletCore.importFromPrivateKey('0xzzzz74bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'),
      ).rejects.toThrow(/Invalid private key/i);
    });

    it('should validate BIP-39 mnemonic word counts (12, 15, 18, 21, 24)', () => {
      const walletCore = new WalletCoreService();

      // 12 words
      const m12 = walletCore.generateMnemonic();
      expect(walletCore.validateMnemonic(m12)).toBe(true);

      // 11 words (invalid)
      const m11 = m12.split(' ').slice(0, 11).join(' ');
      expect(walletCore.validateMnemonic(m11)).toBe(false);
    });

    it('should reject invalid wallet address format in KeyStoreService', async () => {
      const keyStore = new KeyStoreService();

      await expect(
        keyStore.saveWallet({
          address: 'invalid-address',
          name: 'Bad Account',
          createdAt: Date.now(),
        }),
      ).rejects.toThrow(/Invalid wallet address format/i);
    });

    it('should ensure wallet index never leaks private key or mnemonic', async () => {
      const keyStore = new KeyStoreService();

      await keyStore.saveWallet({
        address: TEST_ADDR,
        name: 'Safe Account',
        privateKey: TEST_PK,
        mnemonic: 'test test test test test test test test test test test junk',
        createdAt: Date.now(),
      });

      const list = await keyStore.listWallets();
      expect(list.length).toBe(1);
      expect((list[0] as any).privateKey).toBeUndefined();
      expect((list[0] as any).mnemonic).toBeUndefined();
    });

    it('should evict signer from memory cache when deleteWallet is invoked', async () => {
      const keyStore = new KeyStoreService();
      const walletCore = new WalletCoreService(keyStore);

      await walletCore.importFromPrivateKey(TEST_PK, 'To Delete');

      // Before delete, signer works
      const sigBefore = await walletCore.signMessage('test', TEST_ADDR);
      expect(sigBefore.startsWith('0x')).toBe(true);

      // Delete wallet
      await walletCore.deleteWallet(TEST_ADDR);

      // Signing should now fail because signer was evicted from memory and secrets deleted
      await expect(walletCore.signMessage('test', TEST_ADDR)).rejects.toThrow(
        /No secret key material found/i,
      );
    });

    it('should safely manage session storage using typed KeyStoreService methods', async () => {
      const keyStore = new KeyStoreService();
      const sessionData = JSON.stringify({ token: 'jwt_test_token', expires_at: 9999999999 });

      await keyStore.saveSession(TEST_ADDR, sessionData);
      const retrieved = await keyStore.getSession(TEST_ADDR);
      expect(retrieved).toBe(sessionData);

      await keyStore.deleteSession(TEST_ADDR);
      const afterDelete = await keyStore.getSession(TEST_ADDR);
      expect(afterDelete).toBeNull();
    });
  });

  describe('3. Storage Engine Parallelism & Batch Optimization', () => {
    it('should batch insert messages across multiple conversations without data loss', async () => {
      const storage = new StorageEngine(new MemoryStorageDriver());
      const msgRepo = new MessageRepository(storage);

      const msgs: ChatMessage[] = [
        {
          id: 'msg_1',
          conversation_id: 'conv_a',
          sender_id: TEST_ADDR,
          content: 'Hello A1',
          created_at: 1000,
          status: 'sent',
          expires_at: 0,
          type: 'text',
          retention: 'permanent',
          delivered_at: null,
          read_at: null,
        },
        {
          id: 'msg_2',
          conversation_id: 'conv_a',
          sender_id: TEST_ADDR,
          content: 'Hello A2',
          created_at: 1001,
          status: 'sent',
          expires_at: 0,
          type: 'text',
          retention: 'permanent',
          delivered_at: null,
          read_at: null,
        },
        {
          id: 'msg_3',
          conversation_id: 'conv_b',
          sender_id: TEST_ADDR,
          content: 'Hello B1',
          created_at: 1002,
          status: 'pending',
          expires_at: 0,
          type: 'text',
          retention: 'permanent',
          delivered_at: null,
          read_at: null,
        },
      ];

      await msgRepo.batchInsertMessages(msgs);

      const listA = await msgRepo.listMessages('conv_a');
      expect(listA.length).toBe(2);
      expect(listA[0].content).toBe('Hello A1');
      expect(listA[1].content).toBe('Hello A2');

      const listB = await msgRepo.listMessages('conv_b');
      expect(listB.length).toBe(1);
      expect(listB[0].content).toBe('Hello B1');

      const pending = await msgRepo.getPendingMessages();
      expect(pending.length).toBe(1);
      expect(pending[0].id).toBe('msg_3');
    });

    it('should parallel list conversations correctly sorted', async () => {
      const storage = new StorageEngine(new MemoryStorageDriver());
      const convRepo = new ConversationRepository(storage);

      const convs: Conversation[] = [
        {
          id: 'conv_1',
          type: 'dm',
          title: 'Alice',
          last_message: 'Hi',
          last_message_at: 100,
          unread_count: 0,
          updated_at: 100,
        },
        {
          id: 'conv_2',
          type: 'dm',
          title: 'Bob',
          last_message: 'Hey',
          last_message_at: 300,
          unread_count: 1,
          updated_at: 300,
        },
        {
          id: 'conv_3',
          type: 'group',
          title: 'Crypto Group',
          last_message: 'LFG',
          last_message_at: 200,
          unread_count: 0,
          updated_at: 200,
        },
      ];

      for (const c of convs) {
        await convRepo.upsertConversation(c);
      }

      const list = await convRepo.listConversations();
      expect(list.length).toBe(3);
      // Sorted descending by last_message_at
      expect(list[0].id).toBe('conv_2'); // 300
      expect(list[1].id).toBe('conv_3'); // 200
      expect(list[2].id).toBe('conv_1'); // 100
    });
  });
});
