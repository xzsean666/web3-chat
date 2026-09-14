import { formatUnits } from 'viem';
import type { EvmService } from '../../services/evm/EvmService';
import type { TokenAsset } from '../../types/wallet';

export interface AssetSummary {
  assets: TokenAsset[];
  totalUsd: number;
}

export class AssetService {
  private evmService: EvmService;

  constructor(evmService: EvmService) {
    this.evmService = evmService;
  }

  /**
   * Format atomic units to human readable decimal string
   */
  public formatTokenAmount(amountWei: string, decimals: number = 18, maxDecimals: number = 4): string {
    try {
      const formatted = formatUnits(BigInt(amountWei), decimals);
      const parts = formatted.split('.');
      if (parts.length === 2 && parts[1].length > maxDecimals) {
        return `${parts[0]}.${parts[1].slice(0, maxDecimals)}`;
      }
      return formatted;
    } catch {
      return '0';
    }
  }

  /**
   * Retrieve all token assets (native + ERC-20s) for a wallet address on current chain
   */
  public async getAssets(walletAddress: string): Promise<AssetSummary> {
    const chain = this.evmService.getCurrentChain();
    const assets: TokenAsset[] = [];

    // 1. Fetch Native Currency Balance
    const nativeWei = await this.evmService.getNativeBalance(walletAddress);
    const nativeFormatted = this.formatTokenAmount(nativeWei, chain.nativeCurrency.decimals);
    const nativePriceUsd = chain.chainId === 97 ? 600.0 : 3200.0; // tBNB / ETH approx reference price
    const nativeUsdVal = parseFloat(nativeFormatted) * nativePriceUsd;

    assets.push({
      address: '0x0000000000000000000000000000000000000000',
      symbol: chain.nativeCurrency.symbol,
      name: chain.nativeCurrency.name,
      decimals: chain.nativeCurrency.decimals,
      balance: nativeFormatted,
      rawBalance: nativeWei,
      usdPrice: nativePriceUsd,
      chainId: chain.chainId,
      icon: '💎',
    });

    // 2. Fetch ERC-20 Tokens configured on chain
    const tokenConfigs: Array<{ address: string; symbol: string; name: string; decimals: number; price: number; icon: string }> = [];

    if (chain.contracts.usdt) {
      tokenConfigs.push({
        address: chain.contracts.usdt,
        symbol: 'USDT',
        name: 'Tether USD',
        decimals: 18,
        price: 1.0,
        icon: '💵',
      });
    }

    if (chain.contracts.wbnb) {
      tokenConfigs.push({
        address: chain.contracts.wbnb,
        symbol: 'WBNB',
        name: 'Wrapped BNB',
        decimals: 18,
        price: 600.0,
        icon: '🪙',
      });
    }

    if (tokenConfigs.length > 0) {
      const tokenAddresses = tokenConfigs.map((t) => t.address);
      const erc20Balances = await this.evmService.getErc20Balances(walletAddress, tokenAddresses);

      tokenConfigs.forEach((cfg, idx) => {
        const balItem = erc20Balances[idx];
        const rawWei = balItem?.balance || '0';
        const formatted = this.formatTokenAmount(rawWei, cfg.decimals);
        const usdVal = parseFloat(formatted) * cfg.price;

        assets.push({
          address: cfg.address,
          symbol: cfg.symbol,
          name: cfg.name,
          decimals: cfg.decimals,
          balance: formatted,
          rawBalance: rawWei,
          usdPrice: cfg.price,
          chainId: chain.chainId,
          icon: cfg.icon,
        });
      });
    }

    const totalUsd = assets.reduce((sum, item) => {
      const val = (parseFloat(item.balance) || 0) * (item.usdPrice || 0);
      return sum + val;
    }, 0);

    return {
      assets,
      totalUsd: Math.round(totalUsd * 100) / 100,
    };
  }
}
