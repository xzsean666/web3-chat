import type { WalletCoreService } from '../wallet/WalletCoreService';
import type { KeyStoreService } from '../wallet/KeyStoreService';
import { WorkerApiClient, type VerifyResponse } from './WorkerApiClient';

export interface SessionInfo {
  token: string;
  expires_at: number;
  wallet_address: string;
  user_id: string;
}

export class AuthService {
  private walletCore: WalletCoreService;
  private keyStore: KeyStoreService;
  private client: WorkerApiClient;
  private activeSession: SessionInfo | null = null;
  private readonly SESSION_KEY_PREFIX = 'web3_chat_session_';

  constructor(
    walletCore: WalletCoreService,
    keyStore: KeyStoreService,
    workerUrl?: string,
  ) {
    this.walletCore = walletCore;
    this.keyStore = keyStore;
    this.client = new WorkerApiClient({
      baseUrl: workerUrl,
      getToken: async () => (await this.getSession())?.token ?? null,
    });
  }

  public getClient(): WorkerApiClient {
    return this.client;
  }

  private getSessionKey(address: string): string {
    return `${this.SESSION_KEY_PREFIX}${address.toLowerCase()}`;
  }

  /**
   * Complete SIWE authentication flow:
   * 1. GET /auth/nonce?address=0x...
   * 2. walletCore.signMessage(challenge.message)
   * 3. POST /auth/verify { address, signature, nonce }
   * 4. Persist Bearer session token
   */
  async login(walletAddress?: string): Promise<SessionInfo> {
    let address = walletAddress;
    if (!address) {
      const active = await this.walletCore.getActiveAccount();
      if (!active) {
        throw new Error('No active wallet found to authenticate.');
      }
      address = active.address;
    }

    const normalizedAddress = address.toLowerCase();

    // 1. Fetch challenge nonce
    const challenge = await this.client.getNonce(normalizedAddress);

    // 2. Sign message using local wallet private key
    const signature = await this.walletCore.signMessage(challenge.message, normalizedAddress);

    // 3. Verify signature on Worker
    const result: VerifyResponse = await this.client.verifySignature(
      normalizedAddress,
      signature,
      challenge.nonce,
    );

    const session: SessionInfo = {
      token: result.token,
      expires_at: result.expires_at,
      wallet_address: normalizedAddress,
      user_id: result.user.id,
    };

    this.activeSession = session;

    // Save session in storage
    await this.keyStore.saveSession(normalizedAddress, JSON.stringify(session));

    return session;
  }

  /**
   * Get active session info
   */
  async getSession(address?: string): Promise<SessionInfo | null> {
    if (this.activeSession) {
      const now = Math.floor(Date.now() / 1000);
      if (this.activeSession.expires_at > now) {
        return this.activeSession;
      }
      this.activeSession = null;
    }

    let target = address;
    if (!target) {
      const active = await this.walletCore.getActiveAccount();
      if (!active) return null;
      target = active.address;
    }

    const raw = await this.keyStore.getSession(target.toLowerCase());
    if (!raw) return null;

    try {
      const parsed = JSON.parse(raw) as SessionInfo;
      const now = Math.floor(Date.now() / 1000);
      if (parsed.expires_at > now) {
        this.activeSession = parsed;
        return parsed;
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Check if current session is active and valid
   */
  async isAuthenticated(): Promise<boolean> {
    const session = await this.getSession();
    return session !== null;
  }

  /**
   * Invalidate session locally and remotely
   */
  async logout(): Promise<void> {
    try {
      await this.client.logout();
    } catch {
      // Ignore network errors on logout
    }

    if (this.activeSession) {
      await this.keyStore.deleteSession(this.activeSession.wallet_address);
      this.activeSession = null;
    }
  }
}
