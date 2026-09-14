import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { AssetService } from '../../src/features/assets/AssetService';
import { TokenHoldingItem } from '../../src/features/assets/components/TokenHoldingItem';
import { ChainSwitchModal } from '../../src/features/assets/components/ChainSwitchModal';
import { MeScreen } from '../../src/features/assets/screens/MeScreen';
import { EvmService } from '../../src/services/evm/EvmService';
import { BSC_TESTNET } from '../../src/constants/chains';

describe('Me Screen & Asset Holdings Breakdown (TASK-012)', () => {
  let evm: EvmService;
  let assetService: AssetService;

  beforeEach(() => {
    evm = new EvmService();
    assetService = new AssetService(evm);
  });

  describe('Token Amount Formatting', () => {
    it('should format 18-decimal wei amounts into readable decimal strings', () => {
      expect(assetService.formatTokenAmount('1000000000000000000', 18)).toBe('1');
      expect(assetService.formatTokenAmount('1500000000000000000', 18)).toBe('1.5');
      expect(assetService.formatTokenAmount('1234567890000000000', 18, 2)).toBe('1.23');
    });

    it('should handle zero and invalid inputs gracefully', () => {
      expect(assetService.formatTokenAmount('0', 18)).toBe('0');
      expect(assetService.formatTokenAmount('invalid', 18)).toBe('0');
    });
  });

  describe('Asset Summary Query', () => {
    it('should fetch native balance and ERC-20 balances with estimated total valuation', async () => {
      vi.spyOn(evm, 'getNativeBalance').mockResolvedValueOnce('2000000000000000000'); // 2 tBNB
      vi.spyOn(evm, 'getErc20Balances').mockResolvedValueOnce([
        { token: BSC_TESTNET.contracts.usdt!, balance: '100000000000000000000' }, // 100 USDT
      ]);

      const summary = await assetService.getAssets('0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266');
      expect(summary.assets.length).toBeGreaterThanOrEqual(1);

      // Native asset (tBNB)
      const nativeAsset = summary.assets.find((a) => a.symbol === 'tBNB');
      expect(nativeAsset).toBeDefined();
      expect(nativeAsset?.balance).toBe('2');

      // USDT asset
      const usdtAsset = summary.assets.find((a) => a.symbol === 'USDT');
      expect(usdtAsset).toBeDefined();
      expect(usdtAsset?.balance).toBe('100');

      // Total USD: 2 * 600 + 100 * 1 = 1300
      expect(summary.totalUsd).toBe(1300);
    });
  });

  describe('UI Component Sanity', () => {
    it('should create valid ReactElement with TokenHoldingItem', () => {
      const element = React.createElement(TokenHoldingItem, {
        token: {
          address: '0x0',
          symbol: 'tBNB',
          name: 'Test BNB',
          decimals: 18,
          balance: '2.5',
          usdPrice: 600,
          chainId: 97,
        },
      });
      expect(React.isValidElement(element)).toBe(true);
      expect(element.type).toBe(TokenHoldingItem);
    });

    it('should create valid ReactElement with ChainSwitchModal', () => {
      const element = React.createElement(ChainSwitchModal, {
        visible: true,
        currentChainId: 97,
        onSelectChain: vi.fn(),
        onClose: vi.fn(),
      });
      expect(React.isValidElement(element)).toBe(true);
      expect(element.type).toBe(ChainSwitchModal);
    });

    it('should create valid ReactElement with MeScreen', () => {
      const element = React.createElement(MeScreen, {
        account: {
          address: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
          name: 'Main Wallet',
          createdAt: Date.now(),
        },
        currentChain: BSC_TESTNET,
        assets: [],
        totalUsd: 0,
        onSwitchChain: vi.fn(),
      });
      expect(React.isValidElement(element)).toBe(true);
      expect(element.type).toBe(MeScreen);
    });
  });
});
