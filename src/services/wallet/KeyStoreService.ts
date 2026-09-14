import * as SecureStore from 'expo-secure-store';
import type { WalletAccount } from '../../types';

export interface KeyStoreStorageAdapter {
  getItemAsync(key: string): Promise<string | null>;
  setItemAsync(key: string, value: string): Promise<void>;
  deleteItemAsync(key: string): Promise<void>;
}

class MemoryStorageAdapter implements KeyStoreStorageAdapter {
  private store = new Map<string, string>();

  async getItemAsync(key: string): Promise<string | null> {
    return this.store.get(key) ?? null;
  }

  async setItemAsync(key: string, value: string): Promise<void> {
    this.store.set(key, value);
  }

  async deleteItemAsync(key: string): Promise<void> {
    this.store.delete(key);
  }
}

export class KeyStoreService {
  private adapter: KeyStoreStorageAdapter;
  private readonly WALLETS_INDEX_KEY = 'web3_chat_wallets_index';
  private readonly ACTIVE_WALLET_KEY = 'web3_chat_active_wallet';
  private readonly SECRET_PREFIX = 'web3_chat_secret_';

  constructor(customAdapter?: KeyStoreStorageAdapter) {
    if (customAdapter) {
      this.adapter = customAdapter;
    } else {
      // Check if expo-secure-store is available in runtime
      try {
        if (SecureStore && typeof SecureStore.getItemAsync === 'function') {
          this.adapter = SecureStore;
        } else {
          this.adapter = new MemoryStorageAdapter();
        }
      } catch {
        this.adapter = new MemoryStorageAdapter();
      }
    }
  }

  private readonly SESSION_PREFIX = 'web3_chat_session_';

  private getSecretKey(address: string): string {
    return `${this.SECRET_PREFIX}${address.toLowerCase()}`;
  }

  /**
   * Save a wallet account metadata and its private secrets
   */
  async saveWallet(account: WalletAccount): Promise<void> {
    if (!account.address || !/^0x[0-9a-fA-F]{40}$/i.test(account.address)) {
      throw new Error(`Invalid wallet address format: ${account.address}`);
    }

    const address = account.address.toLowerCase();

    // 1. Save secret data (private key & mnemonic)
    const secretData = JSON.stringify({
      privateKey: account.privateKey,
      mnemonic: account.mnemonic,
    });
    await this.adapter.setItemAsync(this.getSecretKey(address), secretData);

    // 2. Update wallet index (strictly stripped of any secrets)
    const wallets = await this.listWallets();
    const existingIndex = wallets.findIndex((w) => w.address.toLowerCase() === address);

    const safeMeta: WalletAccount = {
      address: account.address,
      name: account.name || `Account ${wallets.length + 1}`,
      createdAt: account.createdAt || Date.now(),
      isCurrent: true,
    };

    if (existingIndex >= 0) {
      const updated = { ...wallets[existingIndex], ...safeMeta };
      delete (updated as any).privateKey;
      delete (updated as any).mnemonic;
      wallets[existingIndex] = updated;
    } else {
      // Mark other wallets as non-current
      wallets.forEach((w) => {
        w.isCurrent = false;
      });
      wallets.push(safeMeta);
    }

    await this.adapter.setItemAsync(this.WALLETS_INDEX_KEY, JSON.stringify(wallets));
    await this.adapter.setItemAsync(this.ACTIVE_WALLET_KEY, address);
  }

  /**
   * Retrieve list of stored wallet accounts (without secrets)
   */
  async listWallets(): Promise<WalletAccount[]> {
    const data = await this.adapter.getItemAsync(this.WALLETS_INDEX_KEY);
    if (!data) return [];
    try {
      return JSON.parse(data);
    } catch {
      return [];
    }
  }

  /**
   * Get active wallet address
   */
  async getActiveWalletAddress(): Promise<string | null> {
    return this.adapter.getItemAsync(this.ACTIVE_WALLET_KEY);
  }

  /**
   * Set active wallet by address
   */
  async setActiveWallet(address: string): Promise<void> {
    const target = address.toLowerCase();
    const wallets = await this.listWallets();
    let found = false;

    wallets.forEach((w) => {
      if (w.address.toLowerCase() === target) {
        w.isCurrent = true;
        found = true;
      } else {
        w.isCurrent = false;
      }
    });

    if (found) {
      await this.adapter.setItemAsync(this.WALLETS_INDEX_KEY, JSON.stringify(wallets));
      await this.adapter.setItemAsync(this.ACTIVE_WALLET_KEY, target);
    }
  }

  /**
   * Retrieve wallet secrets (private key and mnemonic)
   */
  async getWalletSecret(address: string): Promise<{ privateKey?: string; mnemonic?: string } | null> {
    const data = await this.adapter.getItemAsync(this.getSecretKey(address));
    if (!data) return null;
    try {
      return JSON.parse(data);
    } catch {
      return null;
    }
  }

  /**
   * Delete a wallet and its secrets
   */
  async deleteWallet(address: string): Promise<void> {
    const target = address.toLowerCase();
    await this.adapter.deleteItemAsync(this.getSecretKey(target));

    let wallets = await this.listWallets();
    wallets = wallets.filter((w) => w.address.toLowerCase() !== target);

    const active = await this.getActiveWalletAddress();
    if (active && active.toLowerCase() === target) {
      if (wallets.length > 0) {
        wallets[0].isCurrent = true;
        await this.adapter.setItemAsync(this.ACTIVE_WALLET_KEY, wallets[0].address.toLowerCase());
      } else {
        await this.adapter.deleteItemAsync(this.ACTIVE_WALLET_KEY);
      }
    }

    await this.adapter.setItemAsync(this.WALLETS_INDEX_KEY, JSON.stringify(wallets));
  }

  /**
   * Save user session data securely
   */
  async saveSession(address: string, sessionJson: string): Promise<void> {
    await this.adapter.setItemAsync(`${this.SESSION_PREFIX}${address.toLowerCase()}`, sessionJson);
  }

  /**
   * Retrieve user session data
   */
  async getSession(address: string): Promise<string | null> {
    return this.adapter.getItemAsync(`${this.SESSION_PREFIX}${address.toLowerCase()}`);
  }

  /**
   * Delete user session data
   */
  async deleteSession(address: string): Promise<void> {
    await this.adapter.deleteItemAsync(`${this.SESSION_PREFIX}${address.toLowerCase()}`);
  }
}
