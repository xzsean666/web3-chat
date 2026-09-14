import type { ChainConfig } from '../types';

export const BSC_TESTNET: ChainConfig = {
  chainId: 97,
  name: 'BNB Smart Chain Testnet',
  network: 'bsc-testnet',
  nativeCurrency: {
    name: 'Test BNB',
    symbol: 'tBNB',
    decimals: 18,
  },
  rpcUrls: [
    'https://data-seed-prebsc-1-s1.binance.org:8545',
    'https://data-seed-prebsc-2-s1.binance.org:8545',
    'https://bsc-testnet.public.blastapi.io',
  ],
  blockExplorerUrls: ['https://testnet.bscscan.com'],
  contracts: {
    factory: '0x9fe46736679d2d9a65f0992f2272de9f3c7fa6e0',
    luckyDrop: '0xc798a7Fb648164415596086B05C3069a1502013B',
    multicall3: '0xcA11bde05977b3631167028862bE2a173976CA11',
    usdt: '0x337610d27c682E347C9cD60BD4b3b107C9d34dDd',
  },
};

export const LOCAL_DEV_CHAIN: ChainConfig = {
  chainId: 31337,
  name: 'Hardhat Localhost',
  network: 'hardhat',
  nativeCurrency: {
    name: 'Ether',
    symbol: 'ETH',
    decimals: 18,
  },
  rpcUrls: ['http://127.0.0.1:8545'],
  blockExplorerUrls: [],
  contracts: {
    factory: '0x9fe46736679d2d9a65f0992f2272de9f3c7fa6e0',
    luckyDrop: '0xc798a7Fb648164415596086B05C3069a1502013B',
    multicall3: '0xcA11bde05977b3631167028862bE2a173976CA11',
    usdt: '0x337610d27c682E347C9cD60BD4b3b107C9d34dDd',
  },
};

export const ETHEREUM_SEPOLIA: ChainConfig = {
  chainId: 11155111,
  name: 'Ethereum Sepolia',
  network: 'sepolia',
  nativeCurrency: {
    name: 'Sepolia Ether',
    symbol: 'ETH',
    decimals: 18,
  },
  rpcUrls: [
    'https://rpc.sepolia.org',
    'https://ethereum-sepolia.publicnode.com',
  ],
  blockExplorerUrls: ['https://sepolia.etherscan.io'],
  contracts: {
    factory: '0x0000000000000000000000000000000000000000',
    luckyDrop: '0x0000000000000000000000000000000000000000',
    multicall3: '0xcA11bde05977b3631167028862bE2a173976CA11',
  },
};

export const DEFAULT_CHAIN_ID = 97;

export const SUPPORTED_CHAINS: Record<number, ChainConfig> = {
  [BSC_TESTNET.chainId]: BSC_TESTNET,
  [LOCAL_DEV_CHAIN.chainId]: LOCAL_DEV_CHAIN,
  [ETHEREUM_SEPOLIA.chainId]: ETHEREUM_SEPOLIA,
};

export function getChainConfig(chainId: number): ChainConfig {
  const chain = SUPPORTED_CHAINS[chainId];
  if (!chain) {
    return BSC_TESTNET;
  }
  return chain;
}
