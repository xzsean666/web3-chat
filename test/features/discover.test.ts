import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import {
  createEip1193InpageScript,
  handleEip1193Request,
  type BridgeContext,
} from '../../src/features/discover/bridge/eip1193Bridge';
import { SignApprovalSheet } from '../../src/features/discover/components/SignApprovalSheet';
import { DiscoverScreen } from '../../src/features/discover/screens/DiscoverScreen';
import { DAppBrowserScreen } from '../../src/features/discover/screens/DAppBrowserScreen';
import { EvmService } from '../../src/services/evm/EvmService';
import { WalletCoreService, KeyStoreService } from '../../src/services/wallet';
import { resetMockStore } from '../mocks/expo-secure-store';

describe('Discover Screen & DApp Browser WebView with EIP-1193 Bridge (TASK-013)', () => {
  let evm: EvmService;
  let keyStore: KeyStoreService;
  let walletCore: WalletCoreService;

  const TEST_PK = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
  const TEST_ADDR = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'.toLowerCase();

  beforeEach(async () => {
    resetMockStore();
    evm = new EvmService();
    keyStore = new KeyStoreService();
    walletCore = new WalletCoreService(keyStore);
    await walletCore.importFromPrivateKey(TEST_PK, 'Deployer');
  });

  describe('EIP-1193 In-Page Script Generator', () => {
    it('should generate valid JS snippet declaring window.ethereum and EIP-1193 methods', () => {
      const script = createEip1193InpageScript('0x61', TEST_ADDR);
      expect(script).toContain('window.ethereum');
      expect(script).toContain('isMetaMask: true');
      expect(script).toContain("currentChainId = '0x61'");
      expect(script).toContain(`currentSelectedAddress = '${TEST_ADDR}'`);
      expect(script).toContain('request: function(args)');
    });
  });

  describe('EIP-1193 RPC Dispatcher & Security Approvals', () => {
    it('should respond to eth_requestAccounts with wallet address without prompt', async () => {
      const approvalFn = vi.fn().mockResolvedValue(true);
      const ctx: BridgeContext = {
        walletAddress: TEST_ADDR,
        chainId: 97,
        walletCore,
        evmService: evm,
        requestUserApproval: approvalFn,
      };

      const res = await handleEip1193Request({ id: 1, method: 'eth_requestAccounts' }, ctx);
      expect(res.result).toEqual([TEST_ADDR]);
      expect(approvalFn).not.toHaveBeenCalled();
    });

    it('should respond to eth_chainId and net_version', async () => {
      const ctx: BridgeContext = {
        walletAddress: TEST_ADDR,
        chainId: 97,
        walletCore,
        evmService: evm,
        requestUserApproval: vi.fn(),
      };

      const chainRes = await handleEip1193Request({ id: 2, method: 'eth_chainId' }, ctx);
      expect(chainRes.result).toBe('0x61');

      const netRes = await handleEip1193Request({ id: 3, method: 'net_version' }, ctx);
      expect(netRes.result).toBe('97');
    });

    it('should prompt user for personal_sign and sign if approved', async () => {
      const approvalFn = vi.fn().mockResolvedValue(true);
      const ctx: BridgeContext = {
        walletAddress: TEST_ADDR,
        chainId: 97,
        walletCore,
        evmService: evm,
        origin: 'https://app.uniswap.org',
        requestUserApproval: approvalFn,
      };

      const msg = 'Welcome to Uniswap';
      const msgHex = `0x${Buffer.from(msg, 'utf8').toString('hex')}`;

      const res = await handleEip1193Request(
        { id: 4, method: 'personal_sign', params: [msgHex, TEST_ADDR] },
        ctx,
      );

      expect(approvalFn).toHaveBeenCalledWith('personal_sign', [msgHex, TEST_ADDR], 'https://app.uniswap.org');
      expect(res.result?.startsWith('0x')).toBe(true);
      expect(res.result?.length).toBe(132);
    });

    it('should reject with 4001 error code if user rejects personal_sign', async () => {
      const rejectFn = vi.fn().mockResolvedValue(false);
      const ctx: BridgeContext = {
        walletAddress: TEST_ADDR,
        chainId: 97,
        walletCore,
        evmService: evm,
        requestUserApproval: rejectFn,
      };

      const res = await handleEip1193Request(
        { id: 5, method: 'personal_sign', params: ['0x1234', TEST_ADDR] },
        ctx,
      );

      expect(res.error).toBeDefined();
      expect(res.error?.code).toBe(4001);
      expect(res.error?.message).toContain('rejected');
    });
  });

  describe('UI Component Sanity', () => {
    it('should create valid ReactElement with SignApprovalSheet', () => {
      const element = React.createElement(SignApprovalSheet, {
        visible: true,
        method: 'personal_sign',
        origin: 'https://dapp.test',
        params: ['0x123'],
        onApprove: vi.fn(),
        onReject: vi.fn(),
      });
      expect(React.isValidElement(element)).toBe(true);
      expect(element.type).toBe(SignApprovalSheet);
    });

    it('should create valid ReactElement with DiscoverScreen', () => {
      const element = React.createElement(DiscoverScreen, {
        onOpenUrl: vi.fn(),
      });
      expect(React.isValidElement(element)).toBe(true);
      expect(element.type).toBe(DiscoverScreen);
    });

    it('should create valid ReactElement with DAppBrowserScreen', () => {
      const element = React.createElement(DAppBrowserScreen, {
        url: 'https://pancakeswap.finance',
        walletAddress: TEST_ADDR,
        chainId: 97,
        walletCore,
        evmService: evm,
        onClose: vi.fn(),
      });
      expect(React.isValidElement(element)).toBe(true);
      expect(element.type).toBe(DAppBrowserScreen);
    });
  });
});
