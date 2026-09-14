import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BSC_TESTNET, ETHEREUM_SEPOLIA, LOCAL_DEV_CHAIN, getChainConfig } from '../../src/constants/chains';
import { EvmService } from '../../src/services/evm/EvmService';

describe('BSC Testnet & Multi-Chain evm-call Integration Service (TASK-003)', () => {
  let service: EvmService;

  beforeEach(() => {
    service = new EvmService({
      initialChainId: BSC_TESTNET.chainId,
    });
  });

  afterEach(() => {
    service.close();
  });

  describe('Chain Configurations', () => {
    it('should have BSC Testnet as the primary target with chainId 97', () => {
      expect(BSC_TESTNET.chainId).toBe(97);
      expect(BSC_TESTNET.network).toBe('bsc-testnet');
      expect(BSC_TESTNET.nativeCurrency.symbol).toBe('tBNB');
      expect(BSC_TESTNET.contracts.factory).toBe('0x9fe46736679d2d9a65f0992f2272de9f3c7fa6e0');
      expect(BSC_TESTNET.contracts.luckyDrop).toBe('0xc798a7Fb648164415596086B05C3069a1502013B');
      expect(BSC_TESTNET.contracts.multicall3).toBe('0xcA11bde05977b3631167028862bE2a173976CA11');
      expect(BSC_TESTNET.rpcUrls.length).toBeGreaterThan(0);
    });

    it('should retrieve proper chain configuration via getChainConfig', () => {
      expect(getChainConfig(97).chainId).toBe(97);
      expect(getChainConfig(11155111).chainId).toBe(11155111);
      expect(getChainConfig(31337).chainId).toBe(31337);
      // Unknown chain fallback to BSC Testnet
      expect(getChainConfig(999999).chainId).toBe(97);
    });
  });

  describe('EvmService Initialization & Chain Switching', () => {
    it('should initialize with BSC Testnet by default', () => {
      const current = service.getCurrentChain();
      expect(current.chainId).toBe(97);
      expect(current.name).toBe('BNB Smart Chain Testnet');
      expect(service.getClient()).toBeDefined();
    });

    it('should support switching chains dynamically', () => {
      service.switchChain(11155111);
      expect(service.getCurrentChain().chainId).toBe(11155111);
      expect(service.getCurrentChain().name).toBe('Ethereum Sepolia');

      // Switch back
      service.switchChain(97);
      expect(service.getCurrentChain().chainId).toBe(97);
    });
  });

  describe('RPC Call Abstractions with Mocked Client', () => {
    it('should format native balance from hex to string decimal wei', async () => {
      const client = service.getClient();
      vi.spyOn(client, 'call').mockResolvedValueOnce('0x1bc16d674ec80000'); // 2 * 10^18

      const balance = await service.getNativeBalance('0x0000000000000000000000000000000000000001');
      expect(balance).toBe('2000000000000000000');
    });

    it('should handle batch native balance requests', async () => {
      const client = service.getClient();
      const addr1 = '0x1111111111111111111111111111111111111111';
      const addr2 = '0x2222222222222222222222222222222222222222';

      vi.spyOn(client, 'batch').mockResolvedValueOnce([
        { id: 1, success: true, result: '0xde0b6b3a7640000' } as any, // 1 ether
        { id: 2, success: true, result: '0x1bc16d674ec80000' } as any, // 2 ether
      ]);

      const balances = await service.getBatchNativeBalances([addr1, addr2]);
      expect(balances[addr1]).toBe('1000000000000000000');
      expect(balances[addr2]).toBe('2000000000000000000');
    });

    it('should execute eth_call and parse gas estimation', async () => {
      const client = service.getClient();
      vi.spyOn(client, 'call').mockImplementation(async (req: any) => {
        if (req.method === 'eth_call') {
          return '0x0000000000000000000000000000000000000000000000000000000000000001';
        }
        if (req.method === 'eth_estimateGas') {
          return '0x5208'; // 21000
        }
        return null;
      });

      const callRes = await service.call({
        to: '0x1234567890123456789012345678901234567890',
        data: '0x',
      });
      expect(callRes).toBe('0x0000000000000000000000000000000000000000000000000000000000000001');

      const gas = await service.estimateGas({
        to: '0x1234567890123456789012345678901234567890',
      });
      expect(gas).toBe(21000n);
    });
  });
});
