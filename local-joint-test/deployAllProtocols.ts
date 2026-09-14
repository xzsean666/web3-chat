// SPDX-License-Identifier: MIT
import { spawn, type ChildProcess } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  createPublicClient,
  createWalletClient,
  defineChain,
  encodeFunctionData,
  http,
  type Address,
  type Hex,
  type PublicClient,
  type WalletClient,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import {
  ChatStorageFactoryABI,
  GroupImplementationABI,
  RelationshipManagerABI,
  UserImplementationABI,
} from '@web3-chat/sdk';
import { luckyDropAbi } from '@luckydrop/sdk';
import { EvmCallClient } from 'evm-call';
import {
  StorageEngine,
  ConversationRepository,
  MessageRepository,
  SyncCheckpointRepository,
} from '../src/services/storage';
import { KeyStoreService } from '../src/services/wallet/KeyStoreService';
import { WalletCoreService } from '../src/services/wallet/WalletCoreService';
import { AuthService } from '../src/services/worker/AuthService';
import { WorkerApiClient } from '../src/services/worker/WorkerApiClient';
import { ChatEngineService } from '../src/features/chat/ChatEngineService';
import { PeriodicSyncService } from '../src/features/chat/PeriodicSyncService';
import { EvmService } from '../src/services/evm/EvmService';
import { SocialContractService } from '../src/features/contacts/SocialContractService';
import { LuckyDropService } from '../src/features/packet/LuckyDropService';
import { InMemoryKeyStoreAdapter } from '../test/e2e/helpers';
import type { ChainConfig } from '../src/types';

export interface WorkerEnv {
  DB: any;
  VOICE_BUCKET: any;
  FACTORY_ADDRESS?: string;
  RPC_URLS?: string;
  CHAIN_ID?: string | number;
  MESSAGE_RECALL_WINDOW_SECONDS?: string | number;
  [key: string]: any;
}

export const ANVIL_PORT = 8548;

export const anvilChain = defineChain({
  id: 31337,
  name: 'Anvil Multi-Repo Localhost',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: { http: [`http://127.0.0.1:${ANVIL_PORT}`] },
  },
});

export interface AnvilInstance {
  process: ChildProcess;
  rpcUrl: string;
  port: number;
  stop: () => Promise<void>;
}

export async function startAnvil(port = ANVIL_PORT): Promise<AnvilInstance> {
  const rpcUrl = `http://127.0.0.1:${port}`;
  const anvilProc = spawn('anvil', ['--port', port.toString(), '--silent']);

  let ready = false;
  for (let i = 0; i < 40; i++) {
    try {
      const res = await fetch(rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_blockNumber', params: [] }),
      });
      if (res.ok) {
        ready = true;
        break;
      }
    } catch {
      await new Promise((r) => setTimeout(r, 150));
    }
  }

  if (!ready) {
    anvilProc.kill('SIGKILL');
    throw new Error(`Failed to start local Anvil node on port ${port}`);
  }

  return {
    process: anvilProc,
    rpcUrl,
    port,
    stop: async () => {
      try {
        anvilProc.kill('SIGTERM');
      } catch {
        anvilProc.kill('SIGKILL');
      }
    },
  };
}

export function loadArtifact(contractName: string, possiblePaths: string[]): { abi: any; bytecode: Hex } {
  for (const candidate of possiblePaths) {
    if (existsSync(candidate)) {
      const parsed = JSON.parse(readFileSync(candidate, 'utf8'));
      const rawBytecode = typeof parsed.bytecode === 'string' ? parsed.bytecode : parsed.bytecode?.object;
      if (rawBytecode && rawBytecode.startsWith('0x')) {
        return {
          abi: parsed.abi,
          bytecode: rawBytecode as Hex,
        };
      }
    }
  }
  throw new Error(`Cannot locate bytecode artifact for contract: ${contractName}`);
}

export interface DeployedAllProtocols {
  // web3-chat-contract
  userImpl: Address;
  groupImpl: Address;
  factory: Address;
  relMgr: Address;

  // LuckyDrop
  mockToken: Address;
  luckyDropImpl: Address;
  luckyDropProxy: Address;

  // Multicall3
  multicall3: Address;

  // Clients & Environment
  publicClient: PublicClient;
  deployerWallet: WalletClient;
  rpcUrl: string;
  evmCallClient: EvmCallClient;
  workerEnv: WorkerEnv;
  workerFetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
}

export async function deployAllProtocolsToAnvil(rpcUrl = `http://127.0.0.1:${ANVIL_PORT}`): Promise<DeployedAllProtocols> {
  const deployerAccount = privateKeyToAccount(
    '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
  );

  const transport = http(rpcUrl);
  const publicClient = createPublicClient({ chain: anvilChain, transport });
  const deployerWallet = createWalletClient({
    account: deployerAccount,
    chain: anvilChain,
    transport,
  });

  // --- 1. Load Artifacts ---
  const userArtifact = loadArtifact('UserImplementation', [
    resolve(__dirname, '../../web3-chat-contract/out/UserImplementation.sol/UserImplementation.json'),
    resolve('/ssd0/git/web3-chat-contract/out/UserImplementation.sol/UserImplementation.json'),
    resolve('/ssd0/git/web3-chat-contract/artifacts/contracts/UserImplementation.sol/UserImplementation.json'),
  ]);

  const groupArtifact = loadArtifact('GroupImplementation', [
    resolve(__dirname, '../../web3-chat-contract/out/GroupImplementation.sol/GroupImplementation.json'),
    resolve('/ssd0/git/web3-chat-contract/out/GroupImplementation.sol/GroupImplementation.json'),
    resolve('/ssd0/git/web3-chat-contract/artifacts/contracts/GroupImplementation.sol/GroupImplementation.json'),
  ]);

  const factoryArtifact = loadArtifact('ChatStorageFactory', [
    resolve(__dirname, '../../web3-chat-contract/out/ChatStorageFactory.sol/ChatStorageFactory.json'),
    resolve('/ssd0/git/web3-chat-contract/out/ChatStorageFactory.sol/ChatStorageFactory.json'),
    resolve('/ssd0/git/web3-chat-contract/artifacts/contracts/ChatStorageFactory.sol/ChatStorageFactory.json'),
  ]);

  const relMgrArtifact = loadArtifact('RelationshipManager', [
    resolve(__dirname, '../../web3-chat-contract/out/RelationshipManager.sol/RelationshipManager.json'),
    resolve('/ssd0/git/web3-chat-contract/out/RelationshipManager.sol/RelationshipManager.json'),
    resolve('/ssd0/git/web3-chat-contract/artifacts/contracts/RelationshipManager.sol/RelationshipManager.json'),
  ]);

  const mockTokenArtifact = loadArtifact('MockERC20', [
    resolve('/ssd0/git/LuckyDrop/contracts/artifacts/src/mocks/MockERC20.sol/MockERC20.json'),
    resolve(__dirname, '../../LuckyDrop/contracts/artifacts/src/mocks/MockERC20.sol/MockERC20.json'),
  ]);

  const luckyDropArtifact = loadArtifact('LuckyDrop', [
    resolve('/ssd0/git/LuckyDrop/contracts/artifacts/src/LuckyDrop.sol/LuckyDrop.json'),
    resolve(__dirname, '../../LuckyDrop/contracts/artifacts/src/LuckyDrop.sol/LuckyDrop.json'),
  ]);

  const luckyDropProxyArtifact = loadArtifact('LuckyDropProxy', [
    resolve('/ssd0/git/LuckyDrop/contracts/artifacts/src/mocks/LuckyDropProxy.sol/LuckyDropProxy.json'),
    resolve(__dirname, '../../LuckyDrop/contracts/artifacts/src/mocks/LuckyDropProxy.sol/LuckyDropProxy.json'),
  ]);

  const multicall3Artifact = loadArtifact('Multicall3', [
    resolve('/ssd0/git/web3-chat-contract/out/Multicall3.sol/Multicall3.json'),
    resolve(__dirname, '../../web3-chat-contract/out/Multicall3.sol/Multicall3.json'),
    resolve('/ssd0/git/web3-chat-contract/artifacts/contracts/Multicall3.sol/Multicall3.json'),
  ]);

  // --- 2. Deploy web3-chat-contract ---
  // A. UserImplementation
  const userHash = await deployerWallet.deployContract({
    abi: UserImplementationABI,
    bytecode: userArtifact.bytecode,
  });
  const userRc = await publicClient.waitForTransactionReceipt({ hash: userHash });
  const userImpl = userRc.contractAddress!;

  // B. GroupImplementation
  const groupHash = await deployerWallet.deployContract({
    abi: GroupImplementationABI,
    bytecode: groupArtifact.bytecode,
  });
  const groupRc = await publicClient.waitForTransactionReceipt({ hash: groupHash });
  const groupImpl = groupRc.contractAddress!;

  // C. ChatStorageFactory
  const factoryHash = await deployerWallet.deployContract({
    abi: ChatStorageFactoryABI,
    bytecode: factoryArtifact.bytecode,
    args: [userImpl, groupImpl],
  });
  const factoryRc = await publicClient.waitForTransactionReceipt({ hash: factoryHash });
  const factory = factoryRc.contractAddress!;

  // D. RelationshipManager
  const relMgrHash = await deployerWallet.deployContract({
    abi: RelationshipManagerABI,
    bytecode: relMgrArtifact.bytecode,
    args: [factory],
  });
  const relMgrRc = await publicClient.waitForTransactionReceipt({ hash: relMgrHash });
  const relMgr = relMgrRc.contractAddress!;

  // E. Link RelationshipManager on Factory
  const linkRelTx = await deployerWallet.writeContract({
    address: factory,
    abi: ChatStorageFactoryABI,
    functionName: 'setRelationshipManager',
    args: [relMgr],
  });
  await publicClient.waitForTransactionReceipt({ hash: linkRelTx });

  // --- 3. Deploy LuckyDrop & Mock Token ---
  // A. MockERC20
  const mockTokenHash = await deployerWallet.deployContract({
    abi: mockTokenArtifact.abi,
    bytecode: mockTokenArtifact.bytecode,
    args: ['LuckyDrop RedPacket Token', 'LRPT'],
  });
  const mockTokenRc = await publicClient.waitForTransactionReceipt({ hash: mockTokenHash });
  const mockToken = mockTokenRc.contractAddress!;

  // Fund test accounts with tokens (Alice, Bob, Charlie)
  const bobAddress: Address = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';
  const charlieAddress: Address = '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC';

  const mintAlice = await deployerWallet.writeContract({
    address: mockToken,
    abi: mockTokenArtifact.abi,
    functionName: 'mint',
    args: [deployerAccount.address, 1000000000000000000000000n], // 1M tokens
  });
  await publicClient.waitForTransactionReceipt({ hash: mintAlice });

  const mintBob = await deployerWallet.writeContract({
    address: mockToken,
    abi: mockTokenArtifact.abi,
    functionName: 'mint',
    args: [bobAddress, 500000000000000000000000n], // 500k tokens
  });
  await publicClient.waitForTransactionReceipt({ hash: mintBob });

  const mintCharlie = await deployerWallet.writeContract({
    address: mockToken,
    abi: mockTokenArtifact.abi,
    functionName: 'mint',
    args: [charlieAddress, 100000000000000000000000n], // 100k tokens
  });
  await publicClient.waitForTransactionReceipt({ hash: mintCharlie });

  // B. LuckyDrop Implementation
  const luckyDropImplHash = await deployerWallet.deployContract({
    abi: luckyDropArtifact.abi,
    bytecode: luckyDropArtifact.bytecode,
  });
  const luckyDropImplRc = await publicClient.waitForTransactionReceipt({ hash: luckyDropImplHash });
  const luckyDropImpl = luckyDropImplRc.contractAddress!;

  // C. LuckyDrop UUPS Proxy
  const initData = encodeFunctionData({
    abi: luckyDropArtifact.abi,
    functionName: 'initialize',
    args: [deployerAccount.address],
  });

  const proxyHash = await deployerWallet.deployContract({
    abi: luckyDropProxyArtifact.abi,
    bytecode: luckyDropProxyArtifact.bytecode,
    args: [luckyDropImpl, initData],
  });
  const proxyRc = await publicClient.waitForTransactionReceipt({ hash: proxyHash });
  const luckyDropProxy = proxyRc.contractAddress!;

  // --- 4. Deploy Multicall3 & Seed Canonical Address 0xcA11bde05977b3631167028862bE2a173976CA11 ---
  const multicall3Hash = await deployerWallet.deployContract({
    abi: multicall3Artifact.abi,
    bytecode: multicall3Artifact.bytecode,
  });
  const multicall3Rc = await publicClient.waitForTransactionReceipt({ hash: multicall3Hash });
  const multicall3DeployedAddr = multicall3Rc.contractAddress!;

  const canonicalMulticall3 = '0xcA11bde05977b3631167028862bE2a173976CA11' as Address;
  const deployedMulticallBytecode = await publicClient.getBytecode({ address: multicall3DeployedAddr });
  if (deployedMulticallBytecode) {
    await publicClient.request({
      method: 'anvil_setCode' as any,
      params: [canonicalMulticall3, deployedMulticallBytecode],
    });
  }

  // --- 5. Initialize evm-call Client ---
  const evmCallClient = new EvmCallClient({
    chainId: 31337,
    customRpcUrls: [rpcUrl],
    storagePath: ':memory:',
    multicall3Address: canonicalMulticall3,
  });

  // --- 6. Initialize web3-chat-worker Environment ---
  const workerPath = resolve(__dirname, '../../web3-chat-worker/src/index.ts');
  const dbPath = resolve(__dirname, '../../web3-chat-worker/test/helpers/db.ts');
  const r2Path = resolve(__dirname, '../../web3-chat-worker/test/helpers/r2.ts');

  const workerModule = (await import(workerPath)) as any;
  const dbModule = (await import(dbPath)) as any;
  const r2Module = (await import(r2Path)) as any;

  const d1 = dbModule.createMockD1Database();
  const r2 = r2Module.createMockR2Bucket();

  const workerEnv: WorkerEnv = {
    DB: d1,
    VOICE_BUCKET: r2,
    FACTORY_ADDRESS: factory,
    RPC_URLS: rpcUrl,
    CHAIN_ID: 31337,
    MESSAGE_RECALL_WINDOW_SECONDS: 30,
    RPC_CACHE_TTL_SECONDS: '0',
  };

  const workerFetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    let urlStr: string;
    if (typeof input === 'string') {
      urlStr = input;
    } else if (input instanceof URL) {
      urlStr = input.toString();
    } else {
      urlStr = input.url;
    }
    const path = urlStr.replace(/^https?:\/\/[^/]+/, '');
    return workerModule.app.request(path.startsWith('/') ? path : `/${path}`, init, workerEnv);
  };

  return {
    userImpl,
    groupImpl,
    factory,
    relMgr,
    mockToken,
    luckyDropImpl,
    luckyDropProxy,
    multicall3: canonicalMulticall3,
    publicClient,
    deployerWallet,
    rpcUrl,
    evmCallClient,
    workerEnv,
    workerFetch,
  };
}

export interface TestUserDevice {
  storage: StorageEngine;
  convRepo: ConversationRepository;
  msgRepo: MessageRepository;
  syncRepo: SyncCheckpointRepository;
  keyStore: KeyStoreService;
  walletCore: WalletCoreService;
  authService: AuthService;
  apiClient: WorkerApiClient;
  chatEngine: ChatEngineService;
  syncService: PeriodicSyncService;
  evmService: EvmService;
  social: SocialContractService;
  luckyDrop: LuckyDropService;
  address: Address;
  privateKey: Hex;
}

export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function createUserDevice(
  name: string,
  privateKey: Hex,
  deployed: DeployedAllProtocols,
  localChainConfig: ChainConfig,
): TestUserDevice {
  const storage = new StorageEngine();
  const convRepo = new ConversationRepository(storage);
  const msgRepo = new MessageRepository(storage);
  const syncRepo = new SyncCheckpointRepository(storage);

  const keyStoreAdapter = new InMemoryKeyStoreAdapter();
  const keyStore = new KeyStoreService(keyStoreAdapter);
  const walletCore = new WalletCoreService(keyStore);

  const account = privateKeyToAccount(privateKey);
  const address = account.address;

  const authService = new AuthService(walletCore, keyStore, 'http://local-worker.internal');
  (authService.getClient() as any).fetchFn = deployed.workerFetch;

  const apiClient = new WorkerApiClient({
    baseUrl: 'http://local-worker.internal',
    fetchFn: deployed.workerFetch as any,
    getToken: async () => {
      const session = await authService.getSession();
      return session?.token ?? null;
    },
  });

  const chatEngine = new ChatEngineService(convRepo, msgRepo, apiClient, authService);
  const syncService = new PeriodicSyncService(apiClient, msgRepo, convRepo, syncRepo, authService);

  const evmService = new EvmService({
    initialChainId: 31337,
    clientOptions: {
      customRpcUrls: [deployed.rpcUrl],
    },
  });

  const social = new SocialContractService(evmService, storage);
  const luckyDrop = new LuckyDropService(evmService, walletCore);

  return {
    storage,
    convRepo,
    msgRepo,
    syncRepo,
    keyStore,
    walletCore,
    authService,
    apiClient,
    chatEngine,
    syncService,
    evmService,
    social,
    luckyDrop,
    address,
    privateKey,
  };
}

export async function runSweeperOnWorker(workerEnv: WorkerEnv) {
  const sweeperPath = resolve(__dirname, '../../web3-chat-worker/src/services/sweeper.ts');
  const sweeperModule = (await import(sweeperPath)) as any;
  return sweeperModule.SweeperService.runSweeper(workerEnv);
}

