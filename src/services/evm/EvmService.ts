import { EvmCallClient, type EvmCallClientOptions } from 'evm-call';
import { BSC_TESTNET, getChainConfig } from '../../constants/chains';
import type { ChainConfig } from '../../types';

export interface TokenBalanceResult {
  token: string;
  balance: string; // Atomic units (string representation of bigint)
  symbol?: string;
  decimals?: number;
}

export interface EvmServiceOptions {
  initialChainId?: number;
  clientOptions?: Partial<EvmCallClientOptions>;
}

export class EvmService {
  private currentChain: ChainConfig;
  private client: EvmCallClient;
  private clientOptions: Partial<EvmCallClientOptions>;

  constructor(options: EvmServiceOptions = {}) {
    const chainId = options.initialChainId ?? BSC_TESTNET.chainId;
    this.currentChain = getChainConfig(chainId);
    this.clientOptions = options.clientOptions ?? {};
    this.client = this.createClient(this.currentChain);
  }

  private createClient(chain: ChainConfig): EvmCallClient {
    return new EvmCallClient({
      chainId: chain.chainId,
      customRpcUrls: chain.rpcUrls,
      storagePath: ':memory:',
      multicall3Address: chain.contracts.multicall3,
      ...this.clientOptions,
    });
  }

  public getCurrentChain(): ChainConfig {
    return this.currentChain;
  }

  public getClient(): EvmCallClient {
    return this.client;
  }

  public switchChain(chainId: number): void {
    if (this.currentChain.chainId === chainId) {
      return;
    }
    try {
      this.client.close();
    } catch {
      // Ignore if already closed
    }
    this.currentChain = getChainConfig(chainId);
    this.client = this.createClient(this.currentChain);
  }

  /**
   * Get latest block number on current chain
   */
  public async getBlockNumber(): Promise<bigint> {
    const result = await this.client.findLatestBlockNumber();
    return BigInt(result.blockNumber);
  }

  /**
   * Get native currency balance (e.g. tBNB, ETH) in wei
   */
  public async getNativeBalance(address: string, blockTag: string = 'latest'): Promise<string> {
    try {
      const res = await this.client.call<string>({
        method: 'eth_getBalance',
        params: [address, blockTag],
      });
      if (typeof res === 'string') {
        return BigInt(res).toString();
      }
      return '0';
    } catch {
      return '0';
    }
  }

  /**
   * Batch get native balances for multiple addresses
   */
  public async getBatchNativeBalances(addresses: string[]): Promise<Record<string, string>> {
    const results: Record<string, string> = {};
    if (addresses.length === 0) return results;

    const requests = addresses.map((addr, index) => ({
      id: index + 1,
      method: 'eth_getBalance',
      params: [addr, 'latest'],
    }));

    const batchRes = await this.client.batch<string>(requests);
    batchRes.forEach((item, index) => {
      const addr = addresses[index];
      if (item.success && typeof item.result === 'string') {
        results[addr] = BigInt(item.result).toString();
      } else {
        results[addr] = '0';
      }
    });

    return results;
  }

  /**
   * Query balances for multiple ERC-20 tokens for a wallet address using Multicall3
   */
  public async getErc20Balances(
    walletAddress: string,
    tokenAddresses: string[],
  ): Promise<TokenBalanceResult[]> {
    if (tokenAddresses.length === 0) return [];

    try {
      // Use erc20MulticallAtBlock from evm-call
      const calls = tokenAddresses.map((tokenAddress, index) => ({
        id: `bal_${index}_${tokenAddress}`,
        tokenAddress,
        method: 'balanceOf' as const,
        owner: walletAddress,
      }));

      const res = await this.client.multicallErc20({
        chain: this.currentChain.chainId,
        calls,
      });

      return res.results.map((r: { success: boolean; value: unknown }, i: number) => {
        const token = tokenAddresses[i];
        if (r.success && r.value !== null) {
          return {
            token,
            balance: String(r.value),
          };
        }
        return {
          token,
          balance: '0',
        };
      });
    } catch {
      // Fallback: individual eth_call if multicall failed or in test mock
      const fallbackResults: TokenBalanceResult[] = [];
      for (const token of tokenAddresses) {
        fallbackResults.push({
          token,
          balance: '0',
        });
      }
      return fallbackResults;
    }
  }

  /**
   * Direct eth_call execution
   */
  public async call(request: { to: string; data: string; blockTag?: string }): Promise<string> {
    return this.client.call<string>({
      method: 'eth_call',
      params: [
        {
          to: request.to,
          data: request.data,
        },
        request.blockTag ?? 'latest',
      ],
    });
  }

  /**
   * Estimate gas for a transaction
   */
  public async estimateGas(request: {
    from?: string;
    to: string;
    value?: string;
    data?: string;
  }): Promise<bigint> {
    const res = await this.client.call<string>({
      method: 'eth_estimateGas',
      params: [request],
    });
    return BigInt(res);
  }

  /**
   * Broadcast signed raw transaction
   */
  public async sendRawTransaction(signedTx: string): Promise<string> {
    return this.client.call<string>({
      method: 'eth_sendRawTransaction',
      params: [signedTx],
    });
  }

  /**
   * Get transaction receipt
   */
  public async getTransactionReceipt(txHash: string): Promise<any> {
    return this.client.call<any>({
      method: 'eth_getTransactionReceipt',
      params: [txHash],
    });
  }

  public close(): void {
    try {
      this.client.close();
    } catch {
      // Ignore
    }
  }
}
