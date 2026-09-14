import {
  generateMnemonic as viemGenerateMnemonic,
  mnemonicToAccount,
  privateKeyToAccount,
  english,
  type PrivateKeyAccount,
  type HDAccount,
} from 'viem/accounts';
import type { Hex } from 'viem';
import { KeyStoreService } from './KeyStoreService';
import type { WalletAccount } from '../../types';

export type WalletSigner = PrivateKeyAccount | HDAccount;

export class WalletCoreService {
  private keyStore: KeyStoreService;
  private activeSignerCache: Map<string, WalletSigner> = new Map();

  constructor(keyStore?: KeyStoreService) {
    this.keyStore = keyStore ?? new KeyStoreService();
  }

  public getKeyStore(): KeyStoreService {
    return this.keyStore;
  }

  /**
   * Generate standard 12-word BIP-39 English mnemonic
   */
  public generateMnemonic(): string {
    return viemGenerateMnemonic(english);
  }

  /**
   * Validate mnemonic phrase format and words
   */
  public validateMnemonic(mnemonic: string): boolean {
    const trimmed = mnemonic.trim();
    const words = trimmed.split(/\s+/);
    if (![12, 15, 18, 21, 24].includes(words.length)) {
      return false;
    }
    try {
      mnemonicToAccount(trimmed);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Create and persist wallet from mnemonic
   */
  public async createWalletFromMnemonic(
    mnemonic: string,
    name?: string,
    path?: `m/44'/60'/${string}`,
  ): Promise<WalletAccount> {
    const trimmed = mnemonic.trim();
    const viemAcc = mnemonicToAccount(trimmed, path ? { path } : undefined);
    const address = viemAcc.address;

    const account: WalletAccount = {
      address,
      name: name || 'Main Account',
      mnemonic: trimmed,
      createdAt: Date.now(),
      isCurrent: true,
    };

    await this.keyStore.saveWallet(account);
    return account;
  }

  /**
   * Import and persist wallet from raw private key
   */
  public async importFromPrivateKey(privateKeyHex: string, name?: string): Promise<WalletAccount> {
    let formattedKey = privateKeyHex.trim();
    if (!formattedKey.startsWith('0x')) {
      formattedKey = `0x${formattedKey}`;
    }

    if (!/^0x[0-9a-fA-F]{64}$/.test(formattedKey)) {
      throw new Error(
        'Invalid private key: must be a 32-byte hex string (64 hex characters with optional 0x prefix)',
      );
    }

    const viemAcc = privateKeyToAccount(formattedKey as Hex);
    const address = viemAcc.address;

    const account: WalletAccount = {
      address,
      name: name || 'Imported Account',
      privateKey: formattedKey,
      createdAt: Date.now(),
      isCurrent: true,
    };

    await this.keyStore.saveWallet(account);
    this.activeSignerCache.set(address.toLowerCase(), viemAcc);
    return account;
  }

  /**
   * Resolve Viem account signer for an address
   */
  private async getSigner(targetAddress?: string): Promise<WalletSigner> {
    let address = targetAddress;
    if (!address) {
      const active = await this.keyStore.getActiveWalletAddress();
      if (!active) {
        throw new Error('No active wallet found. Please create or import a wallet first.');
      }
      address = active;
    }

    const normalized = address.toLowerCase();
    const cached = this.activeSignerCache.get(normalized);
    if (cached) return cached;

    const secrets = await this.keyStore.getWalletSecret(normalized);
    if (!secrets) {
      throw new Error(`No secret key material found for address ${address}`);
    }

    let signer: WalletSigner;
    if (secrets.privateKey) {
      signer = privateKeyToAccount(secrets.privateKey as Hex);
    } else if (secrets.mnemonic) {
      signer = mnemonicToAccount(secrets.mnemonic);
    } else {
      throw new Error(`Invalid secret material for address ${address}`);
    }

    this.activeSignerCache.set(normalized, signer);
    return signer;
  }

  /**
   * Get currently active wallet metadata
   */
  public async getActiveAccount(): Promise<WalletAccount | null> {
    const activeAddress = await this.keyStore.getActiveWalletAddress();
    if (!activeAddress) return null;

    const wallets = await this.keyStore.listWallets();
    const found = wallets.find((w) => w.address.toLowerCase() === activeAddress.toLowerCase());
    return found || null;
  }

  /**
   * EIP-191 Personal Sign (for SIWE, messages)
   */
  public async signMessage(message: string, address?: string): Promise<string> {
    const signer = await this.getSigner(address);
    return signer.signMessage({ message });
  }

  /**
   * Sign typed data (EIP-712)
   */
  public async signTypedData(typedData: any, address?: string): Promise<string> {
    const signer = await this.getSigner(address);
    return signer.signTypedData(typedData);
  }

  /**
   * Sign a raw EVM transaction
   */
  public async signTransaction(tx: any, address?: string): Promise<string> {
    const signer = await this.getSigner(address);
    return signer.signTransaction(tx);
  }

  /**
   * Purge signer instances from in-memory cache to prevent memory retention of secrets
   */
  public clearSignerCache(address?: string): void {
    if (address) {
      this.activeSignerCache.delete(address.toLowerCase());
    } else {
      this.activeSignerCache.clear();
    }
  }

  /**
   * Delete wallet from storage and immediately evict from memory cache
   */
  public async deleteWallet(address: string): Promise<void> {
    const norm = address.toLowerCase();
    this.clearSignerCache(norm);
    await this.keyStore.deleteWallet(norm);
  }
}
