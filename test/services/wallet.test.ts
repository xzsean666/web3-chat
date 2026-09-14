import { describe, it, expect, beforeEach } from 'vitest';
import { verifyMessage } from 'viem';
import { KeyStoreService, WalletCoreService } from '../../src/services/wallet';
import { resetMockStore } from '../mocks/expo-secure-store';

describe('Local Secure KeyStore & Wallet Core Service (TASK-004)', () => {
  let keyStore: KeyStoreService;
  let walletCore: WalletCoreService;

  beforeEach(() => {
    resetMockStore();
    keyStore = new KeyStoreService();
    walletCore = new WalletCoreService(keyStore);
  });

  describe('BIP-39 Mnemonic Management', () => {
    it('should generate a 12-word valid English mnemonic', () => {
      const mnemonic = walletCore.generateMnemonic();
      const words = mnemonic.split(' ');
      expect(words.length).toBe(12);
      expect(walletCore.validateMnemonic(mnemonic)).toBe(true);
    });

    it('should reject invalid mnemonic string', () => {
      expect(walletCore.validateMnemonic('invalid mnemonic with fewer words')).toBe(false);
      expect(walletCore.validateMnemonic('')).toBe(false);
    });

    it('should derive deterministic address from standard test mnemonic vector', async () => {
      // Standard 12-word test vector
      const testMnemonic = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
      const expectedAddress = '0x9858EfFD232B4033E47d90003D41EC34EcaEda94'.toLowerCase();

      const account = await walletCore.createWalletFromMnemonic(testMnemonic, 'Test Account');
      expect(account.address.toLowerCase()).toBe(expectedAddress);
      expect(account.name).toBe('Test Account');

      const active = await walletCore.getActiveAccount();
      expect(active?.address.toLowerCase()).toBe(expectedAddress);
    });
  });

  describe('Private Key Import', () => {
    it('should import wallet from hex private key and derive correct address', async () => {
      // Anvil / Hardhat Account #0
      const testPk = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
      const expectedAddress = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'.toLowerCase();

      const account = await walletCore.importFromPrivateKey(testPk, 'Hardhat Deployer');
      expect(account.address.toLowerCase()).toBe(expectedAddress);

      const secret = await keyStore.getWalletSecret(account.address);
      expect(secret?.privateKey).toBe(testPk);
    });
  });

  describe('EIP-191 Personal Sign & SIWE Verification', () => {
    it('should produce a valid EIP-191 signature verifiable by Viem verifyMessage', async () => {
      const testPk = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
      const account = await walletCore.importFromPrivateKey(testPk, 'Signer');

      const message = 'web3-chat.app wants you to sign in with your Ethereum account:\n0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266\n\nNonce: 94827510\nIssued At: 2026-09-14T10:00:00.000Z';

      const signature = await walletCore.signMessage(message);
      expect(signature.startsWith('0x')).toBe(true);
      expect(signature.length).toBe(132); // 65 bytes in hex + 0x prefix

      // Verify EIP-191 signature validity
      const isValid = await verifyMessage({
        address: account.address as `0x${string}`,
        message,
        signature: signature as `0x${string}`,
      });
      expect(isValid).toBe(true);
    });
  });

  describe('KeyStore Multi-Account Management & Deletion', () => {
    it('should manage multiple accounts, switch active account, and delete safely', async () => {
      const pk1 = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
      const pk2 = '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d';

      const acc1 = await walletCore.importFromPrivateKey(pk1, 'Account 1');
      const acc2 = await walletCore.importFromPrivateKey(pk2, 'Account 2');

      let wallets = await keyStore.listWallets();
      expect(wallets.length).toBe(2);

      // Latest imported is current
      let active = await keyStore.getActiveWalletAddress();
      expect(active?.toLowerCase()).toBe(acc2.address.toLowerCase());

      // Switch to Account 1
      await keyStore.setActiveWallet(acc1.address);
      active = await keyStore.getActiveWalletAddress();
      expect(active?.toLowerCase()).toBe(acc1.address.toLowerCase());

      // Delete Account 1 -> Account 2 should become active
      await keyStore.deleteWallet(acc1.address);
      wallets = await keyStore.listWallets();
      expect(wallets.length).toBe(1);
      expect(wallets[0].address.toLowerCase()).toBe(acc2.address.toLowerCase());

      const activeAfterDelete = await keyStore.getActiveWalletAddress();
      expect(activeAfterDelete?.toLowerCase()).toBe(acc2.address.toLowerCase());
    });
  });
});
