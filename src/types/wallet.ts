/**
 * Wallet and Blockchain Configuration Domain Models
 * Aligned with evm-call client and BSC Testnet defaults.
 */

export interface WalletAccount {
  address: string;
  name: string;
  isCurrent?: boolean;
  mnemonic?: string; // Stored securely, optional when imported via private key
  privateKey?: string; // Stored securely
  createdAt: number;
}

export interface ContractAddresses {
  factory: string; // ChatStorageFactory
  luckyDrop: string; // LuckyDrop red packet contract
  multicall3: string; // Multicall3 contract
  wbnb?: string;
  usdt?: string;
}

export interface ChainConfig {
  chainId: number;
  name: string;
  network: string;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
  rpcUrls: string[];
  blockExplorerUrls: string[];
  contracts: ContractAddresses;
}

export interface TokenAsset {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  balance: string; // Formatted display string or raw atomic unit
  rawBalance?: string; // Atomic units (wei)
  usdPrice?: number;
  icon?: string;
  chainId: number;
}

export interface SendTransactionRequest {
  to: string;
  value?: string;
  data?: string;
  gasLimit?: string;
  gasPrice?: string;
  maxFeePerGas?: string;
  maxPriorityFeePerGas?: string;
}

export interface SignMessageRequest {
  type: 'personal_sign' | 'eth_signTypedData_v4';
  message: string | Record<string, any>;
  raw?: string;
}
