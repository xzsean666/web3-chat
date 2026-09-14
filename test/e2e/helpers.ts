import {
  StorageEngine,
  ConversationRepository,
  MessageRepository,
  SyncCheckpointRepository,
} from '../../src/services/storage';
import { KeyStoreService, type KeyStoreStorageAdapter } from '../../src/services/wallet/KeyStoreService';
import { WalletCoreService } from '../../src/services/wallet/WalletCoreService';
import { WorkerApiClient } from '../../src/services/worker/WorkerApiClient';
import { AuthService } from '../../src/services/worker/AuthService';
import { ChatEngineService } from '../../src/features/chat/ChatEngineService';
import { PeriodicSyncService } from '../../src/features/chat/PeriodicSyncService';
import { EvmService } from '../../src/services/evm/EvmService';
import { SocialContractService } from '../../src/features/contacts/SocialContractService';
import { LuckyDropService } from '../../src/features/packet/LuckyDropService';
import type { ChatMessage } from '../../src/types/chat';

export class InMemoryKeyStoreAdapter implements KeyStoreStorageAdapter {
  private map = new Map<string, string>();

  async getItemAsync(key: string): Promise<string | null> {
    return this.map.get(key) ?? null;
  }

  async setItemAsync(key: string, value: string): Promise<void> {
    this.map.set(key, value);
  }

  async deleteItemAsync(key: string): Promise<void> {
    this.map.delete(key);
  }

  clear(): void {
    this.map.clear();
  }
}

export interface StoredServerMessage extends ChatMessage {
  recalled_at?: number;
}

export class MockWorkerBackend {
  public nonces = new Map<string, { nonce: string; message: string; expires_at: number }>();
  public tokens = new Map<string, { address: string; expires_at: number; user_id: string }>();
  public messages: StoredServerMessage[] = [];
  public receipts: Array<{ id: string; message_id: string; status: string; timestamp: number }> = [];
  public recalls: Array<{ id: string; recalled_at: number }> = [];
  public isOnline: boolean = true;
  private currentTimestamp: number = 1700000000;

  reset(): void {
    this.nonces.clear();
    this.tokens.clear();
    this.messages = [];
    this.receipts = [];
    this.recalls = [];
    this.isOnline = true;
    this.currentTimestamp = 1700000000;
  }

  public nextTimestamp(): number {
    const realNow = Math.floor(Date.now() / 1000);
    this.currentTimestamp = Math.max(realNow, this.currentTimestamp + 1);
    return this.currentTimestamp;
  }

  private extractBearerToken(headers?: any): string | null {
    if (!headers) return null;
    let authHeader = '';
    if (typeof headers.get === 'function') {
      authHeader = headers.get('Authorization') || headers.get('authorization') || '';
    } else if (typeof headers === 'object') {
      authHeader = headers['Authorization'] || headers['authorization'] || '';
    }
    if (authHeader.startsWith('Bearer ')) {
      return authHeader.slice(7).trim();
    }
    return null;
  }

  async handleFetch(urlStr: string, init?: RequestInit): Promise<{ ok: boolean; status: number; json: () => Promise<any> }> {
    if (!this.isOnline) {
      throw new Error('Network offline (Simulated)');
    }

    const url = new URL(urlStr);
    const pathname = url.pathname;
    const method = (init?.method || 'GET').toUpperCase();
    const token = this.extractBearerToken(init?.headers);

    // 1. GET /auth/nonce?address=0x...
    if (pathname === '/auth/nonce' && method === 'GET') {
      const address = (url.searchParams.get('address') || '').toLowerCase();
      const nonce = `nonce-${Math.random().toString(36).substring(2, 10)}`;
      const message = `web3-chat login challenge\nAddress: ${address}\nNonce: ${nonce}`;
      const expires_at = this.nextTimestamp() + 300;
      this.nonces.set(address, { nonce, message, expires_at });
      return {
        ok: true,
        status: 200,
        json: async () => ({ nonce, message, expires_at }),
      };
    }

    // 2. POST /auth/verify
    if (pathname === '/auth/verify' && method === 'POST') {
      const body = JSON.parse((init?.body as string) || '{}');
      const address = (body.address || '').toLowerCase();
      const nonceRecord = this.nonces.get(address);

      if (!nonceRecord || nonceRecord.nonce !== body.nonce) {
        return {
          ok: false,
          status: 401,
          json: async () => ({ error: 'Invalid or expired nonce' }),
        };
      }

      const sessionToken = `jwt-${address.slice(2, 8)}-${Date.now()}`;
      const user_id = `user-${address.slice(2, 10)}`;
      const expires_at = this.nextTimestamp() + 86400 * 7;
      this.tokens.set(sessionToken, { address, expires_at, user_id });
      this.nonces.delete(address);

      return {
        ok: true,
        status: 200,
        json: async () => ({
          token: sessionToken,
          expires_at,
          user: {
            id: user_id,
            wallet_address: address,
          },
        }),
      };
    }

    // 3. POST /auth/logout
    if (pathname === '/auth/logout' && method === 'POST') {
      if (token) {
        this.tokens.delete(token);
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({ success: true }),
      };
    }

    // For all subsequent authenticated endpoints, check token
    const session = token ? this.tokens.get(token) : null;
    if (!session) {
      return {
        ok: false,
        status: 401,
        json: async () => ({ error: 'Unauthorized' }),
      };
    }

    // 4. POST /conversations/:id/messages
    const msgMatch = pathname.match(/^\/conversations\/([^/]+)\/messages$/);
    if (msgMatch && method === 'POST') {
      const conversationId = decodeURIComponent(msgMatch[1]);
      const body = JSON.parse((init?.body as string) || '{}');
      const msgTimestamp = this.nextTimestamp();
      const newMsg: StoredServerMessage = {
        id: `server-msg-${Math.random().toString(36).substring(2, 9)}`,
        conversation_id: conversationId,
        sender_id: session.address,
        type: body.type || 'text',
        content: body.content,
        retention: body.retention || 'permanent',
        status: 'sent',
        expires_at: body.expires_at || 0,
        delivered_at: null,
        read_at: null,
        created_at: msgTimestamp,
        metadata: body.metadata,
      };
      this.messages.push(newMsg);
      return {
        ok: true,
        status: 200,
        json: async () => ({ message: newMsg }),
      };
    }

    // 5. GET /sync?since=...&limit=... (or ?cursor=...)
    if (pathname === '/sync' && method === 'GET') {
      const cursor = parseInt(url.searchParams.get('since') || url.searchParams.get('cursor') || '0', 10);
      const limit = parseInt(url.searchParams.get('limit') || '50', 10);

      // Return messages involving user or posted to conversation where user is member
      const userMessages = this.messages.filter(
        (m) => m.created_at > cursor && (m.conversation_id.includes(session.address) || m.sender_id === session.address),
      ).slice(0, limit);

      const userReceipts = this.receipts.filter((r) => r.timestamp > cursor);
      const userRecalls = this.recalls.filter((r) => r.recalled_at > cursor);

      let lastTimestamp = cursor;
      userMessages.forEach((m) => {
        if (m.created_at > lastTimestamp) lastTimestamp = m.created_at;
      });
      userReceipts.forEach((r) => {
        if (r.timestamp > lastTimestamp) lastTimestamp = r.timestamp;
      });
      userRecalls.forEach((r) => {
        if (r.recalled_at > lastTimestamp) lastTimestamp = r.recalled_at;
      });

      return {
        ok: true,
        status: 200,
        json: async () => ({
          messages: userMessages,
          receipts: userReceipts,
          recalls: userRecalls,
          last_timestamp: lastTimestamp,
        }),
      };
    }

    // 6. POST /messages/ack or POST /ack
    if ((pathname === '/messages/ack' || pathname === '/ack') && method === 'POST') {
      const body = JSON.parse((init?.body as string) || '{}');
      const messageIds: string[] = body.message_ids || [];
      const ackTimestamp = this.nextTimestamp();

      messageIds.forEach((msgId) => {
        const target = this.messages.find((m) => m.id === msgId);
        if (target) {
          target.status = 'delivered';
          target.delivered_at = ackTimestamp;
        }
        this.receipts.push({
          id: `rcpt-${Math.random().toString(36).substring(2, 9)}`,
          message_id: msgId,
          status: 'delivered',
          timestamp: ackTimestamp,
        });
      });

      return {
        ok: true,
        status: 200,
        json: async () => ({ success: true }),
      };
    }

    // 7. POST /messages/:id/recall
    const recallMatch = pathname.match(/^\/messages\/([^/]+)\/recall$/);
    if (recallMatch && method === 'POST') {
      const messageId = decodeURIComponent(recallMatch[1]);
      const target = this.messages.find((m) => m.id === messageId);
      const recallTimestamp = this.nextTimestamp();

      if (target) {
        target.status = 'recalled';
        target.content = 'Message recalled';
        target.recalled_at = recallTimestamp;
        this.recalls.push({ id: messageId, recalled_at: recallTimestamp });
      }

      return {
        ok: true,
        status: 200,
        json: async () => ({ success: true }),
      };
    }

    return {
      ok: false,
      status: 404,
      json: async () => ({ error: `Not found: ${pathname}` }),
    };
  }
}

export interface DeviceSandbox {
  name: string;
  storage: StorageEngine;
  convRepo: ConversationRepository;
  msgRepo: MessageRepository;
  syncRepo: SyncCheckpointRepository;
  keyStoreAdapter: InMemoryKeyStoreAdapter;
  keyStore: KeyStoreService;
  walletCore: WalletCoreService;
  workerClient: WorkerApiClient;
  authService: AuthService;
  chatEngine: ChatEngineService;
  syncService: PeriodicSyncService;
  evm: EvmService;
  social: SocialContractService;
  luckyDrop: LuckyDropService;
}

export function createDeviceSandbox(name: string, mockWorker: MockWorkerBackend): DeviceSandbox {
  const storage = new StorageEngine();
  const convRepo = new ConversationRepository(storage);
  const msgRepo = new MessageRepository(storage);
  const syncRepo = new SyncCheckpointRepository(storage);

  const keyStoreAdapter = new InMemoryKeyStoreAdapter();
  const keyStore = new KeyStoreService(keyStoreAdapter);
  const walletCore = new WalletCoreService(keyStore);

  const authService = new AuthService(walletCore, keyStore, 'https://mock.worker');
  const authWorkerClient = authService.getClient();
  (authWorkerClient as any).fetchFn = (url: string, init?: RequestInit) => mockWorker.handleFetch(url, init);

  const workerClient = new WorkerApiClient({
    baseUrl: 'https://mock.worker',
    getToken: async () => (await authService.getSession())?.token ?? null,
    fetchFn: ((input: RequestInfo | URL, init?: RequestInit) => mockWorker.handleFetch(input.toString(), init)) as any,
  });

  const chatEngine = new ChatEngineService(convRepo, msgRepo, workerClient, authService);
  const syncService = new PeriodicSyncService(workerClient, msgRepo, convRepo, syncRepo, authService);

  const evm = new EvmService();
  const social = new SocialContractService(evm, storage);
  const luckyDrop = new LuckyDropService(evm, walletCore);

  return {
    name,
    storage,
    convRepo,
    msgRepo,
    syncRepo,
    keyStoreAdapter,
    keyStore,
    walletCore,
    workerClient,
    authService,
    chatEngine,
    syncService,
    evm,
    social,
    luckyDrop,
  };
}
