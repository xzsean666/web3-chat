// SPDX-License-Identifier: MIT
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  type Address,
  type Hex,
  createWalletClient,
  http,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import {
  ChatSDK,
  JoinMode,
} from '@web3-chat/sdk';
import {
  LuckyDropClient,
  PacketType as LuckyPacketType,
  verifyProof,
  generateLeaf,
} from '@luckydrop/sdk';
import {
  startAnvil,
  deployAllProtocolsToAnvil,
  anvilChain,
  type AnvilInstance,
  type DeployedAllProtocols,
} from './deployAllProtocols';

// Client App Modules from web3-chat
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
import {
  handleEip1193Request,
  createEip1193InpageScript,
  type BridgeContext,
} from '../src/features/discover/bridge/eip1193Bridge';
import type { ChainConfig, ChatMessage } from '../src/types';

interface TestUserDevice {
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

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function createUserDevice(
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

describe('Comprehensive Multi-Repo Joint Integration & Local Verification Suite', () => {
  let anvil: AnvilInstance;
  let deployed: DeployedAllProtocols;
  let localChainConfig: ChainConfig;

  // Real Anvil accounts
  const ALICE_PK: Hex = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
  const BOB_PK: Hex = '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d';
  const CHARLIE_PK: Hex = '0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a';

  let aliceDevice: TestUserDevice;
  let bobDevice: TestUserDevice;
  let charlieDevice: TestUserDevice;

  let sdkAlice: ChatSDK;
  let sdkBob: ChatSDK;
  let luckyDropAlice: LuckyDropClient;
  let luckyDropBob: LuckyDropClient;

  beforeAll(async () => {
    // 1. Launch local Anvil sandbox node
    anvil = await startAnvil(8548);

    // 2. Deploy all smart contract protocols across repositories to Anvil
    deployed = await deployAllProtocolsToAnvil(anvil.rpcUrl);

    localChainConfig = {
      chainId: 31337,
      name: 'Anvil Localhost',
      network: 'anvil',
      nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
      rpcUrls: [anvil.rpcUrl],
      blockExplorerUrls: [],
      contracts: {
        factory: deployed.factory,
        luckyDrop: deployed.luckyDropProxy,
        multicall3: '0xcA11bde05977b3631167028862bE2a173976CA11',
        usdt: deployed.mockToken,
      },
    };

    // 3. Initialize simulated mobile client devices for Alice, Bob, and Charlie
    aliceDevice = createUserDevice('Alice', ALICE_PK, deployed, localChainConfig);
    bobDevice = createUserDevice('Bob', BOB_PK, deployed, localChainConfig);
    charlieDevice = createUserDevice('Charlie', CHARLIE_PK, deployed, localChainConfig);

    // Pre-seed KeyStore with private key accounts
    await aliceDevice.walletCore.importFromPrivateKey(ALICE_PK, 'Alice Master Wallet');
    await bobDevice.walletCore.importFromPrivateKey(BOB_PK, 'Bob Master Wallet');
    await charlieDevice.walletCore.importFromPrivateKey(CHARLIE_PK, 'Charlie Master Wallet');

    // 4. Initialize @web3-chat/sdk clients
    const aliceAccount = privateKeyToAccount(ALICE_PK);
    const bobAccount = privateKeyToAccount(BOB_PK);

    const aliceWallet = createWalletClient({
      account: aliceAccount,
      chain: anvilChain,
      transport: http(anvil.rpcUrl),
    });

    const bobWallet = createWalletClient({
      account: bobAccount,
      chain: anvilChain,
      transport: http(anvil.rpcUrl),
    });

    sdkAlice = new ChatSDK({
      factoryAddress: deployed.factory,
      chain: anvilChain,
      publicClient: deployed.publicClient,
      walletClient: aliceWallet,
    });

    sdkBob = new ChatSDK({
      factoryAddress: deployed.factory,
      chain: anvilChain,
      publicClient: deployed.publicClient,
      walletClient: bobWallet,
    });

    // 5. Initialize @luckydrop/sdk clients
    luckyDropAlice = new LuckyDropClient({
      contractAddress: deployed.luckyDropProxy,
      publicClient: deployed.publicClient,
      walletClient: aliceWallet,
    });

    luckyDropBob = new LuckyDropClient({
      contractAddress: deployed.luckyDropProxy,
      publicClient: deployed.publicClient,
      walletClient: bobWallet,
    });
  }, 45000);

  afterAll(async () => {
    aliceDevice?.syncService?.stopPolling();
    bobDevice?.syncService?.stopPolling();
    charlieDevice?.syncService?.stopPolling();

    aliceDevice?.evmService?.close();
    bobDevice?.evmService?.close();
    charlieDevice?.evmService?.close();

    deployed?.evmCallClient?.close();

    if (anvil) {
      await anvil.stop();
    }
  });

  // =========================================================================
  // STAGE 1: Multi-Repo Infrastructure & Contract Deployment Verification
  // =========================================================================
  it('Stage 1: Multi-Repo Infrastructure, EVM RPC Pool, Contracts & Data SDK Verification', async () => {
    // 1. Check Anvil node connectivity and chain ID
    const chainId = await deployed.publicClient.getChainId();
    expect(chainId).toBe(31337);

    const blockNum = await deployed.publicClient.getBlockNumber();
    expect(blockNum).toBeGreaterThan(0n);

    // 2. Verify web3-chat-contract deployment addresses
    expect(deployed.factory.startsWith('0x')).toBe(true);
    expect(deployed.factory.length).toBe(42);
    expect(deployed.relMgr.startsWith('0x')).toBe(true);
    expect(deployed.userImpl.startsWith('0x')).toBe(true);
    expect(deployed.groupImpl.startsWith('0x')).toBe(true);

    // 3. Verify LuckyDrop deployment addresses
    expect(deployed.luckyDropProxy.startsWith('0x')).toBe(true);
    expect(deployed.luckyDropImpl.startsWith('0x')).toBe(true);
    expect(deployed.mockToken.startsWith('0x')).toBe(true);

    // 4. Verify evm-call RPC pool connectivity
    const latestBlockInfo = await deployed.evmCallClient.findLatestBlockNumber();
    expect(BigInt(latestBlockInfo.blockNumber)).toBeGreaterThanOrEqual(1n);

    const feeHistory = await deployed.evmCallClient.getFeeHistory(4, 'latest', [25, 75]);
    expect(feeHistory).toBeDefined();
    expect(feeHistory.baseFeePerGas.length).toBeGreaterThan(0);
  });

  // =========================================================================
  // STAGE 2: Decentralized Identity Creation & On-Chain Profile Cloning
  // =========================================================================
  it('Stage 2: On-Chain Sovereign Identity Deployment & Profile Synchronization', async () => {
    // 1. Alice creates sovereign user contract on-chain via @web3-chat/sdk
    const txA = await sdkAlice.createUser();
    await deployed.publicClient.waitForTransactionReceipt({ hash: txA });

    const aliceUserAddr = await sdkAlice.getUserContract(aliceDevice.address);
    expect(aliceUserAddr.startsWith('0x')).toBe(true);

    // Set on-chain profile metadata
    const userAlice = await sdkAlice.user();
    const metaTx = await userAlice.setMetadata({
      displayName: 'Alice Sovereign',
      bio: 'Web3 Core Protocol Lead',
      handle: '@alice',
    });
    await deployed.publicClient.waitForTransactionReceipt({ hash: metaTx });

    // 2. Bob creates sovereign user contract
    const txB = await sdkBob.createUser();
    await deployed.publicClient.waitForTransactionReceipt({ hash: txB });

    const bobUserAddr = await sdkBob.getUserContract(bobDevice.address);
    expect(bobUserAddr.startsWith('0x')).toBe(true);

    const userBob = await sdkBob.user();
    const bobMetaTx = await userBob.setMetadata({
      displayName: 'Bob Builder',
      bio: 'Decentralized Messaging Dev',
      handle: '@bob',
    });
    await deployed.publicClient.waitForTransactionReceipt({ hash: bobMetaTx });

    // 3. Query on-chain user overview
    const aliceMeta = await userAlice.getMetadata() as any;
    expect(aliceMeta.displayName).toBe('Alice Sovereign');
    expect(aliceMeta.bio).toBe('Web3 Core Protocol Lead');
    expect(await userAlice.friendCount()).toBe(0n);
  });

  // =========================================================================
  // STAGE 3: EIP-191 SIWE Authentication & Worker Integration
  // =========================================================================
  it('Stage 3: EIP-191 SIWE Challenge-Response Authentication & Unified Profile Query', async () => {
    // 1. Alice authenticates against the web3-chat-worker node
    expect(await aliceDevice.authService.isAuthenticated()).toBe(false);

    const aliceSession = await aliceDevice.authService.login(aliceDevice.address);
    expect(aliceSession.token).toBeDefined();
    expect(aliceSession.token.length).toBeGreaterThan(20);
    expect(aliceSession.wallet_address.toLowerCase()).toBe(aliceDevice.address.toLowerCase());
    expect(await aliceDevice.authService.isAuthenticated()).toBe(true);

    // 2. Bob authenticates against the worker
    expect(await bobDevice.authService.isAuthenticated()).toBe(false);
    const bobSession = await bobDevice.authService.login(bobDevice.address);
    expect(bobSession.token).toBeDefined();
    expect(bobSession.token.length).toBeGreaterThan(20);
    expect(bobSession.wallet_address.toLowerCase()).toBe(bobDevice.address.toLowerCase());
    expect(await bobDevice.authService.isAuthenticated()).toBe(true);

    // 3. Worker queries on-chain user info: GET /users/:address
    const res = await deployed.workerFetch(`http://local-worker.internal/users/${aliceDevice.address}`);
    expect(res.status).toBe(200);
    const userJson = await res.json() as any;
    expect(userJson.user.address.toLowerCase()).toBe(aliceDevice.address.toLowerCase());
    expect(userJson.user.metadata.displayName).toBe('Alice Sovereign');
    expect(userJson.user.friendCount).toBe('0');
    const expectedContract = await sdkAlice.getUserContract(aliceDevice.address);
    expect(expectedContract.startsWith('0x')).toBe(true);
    expect(expectedContract.length).toBe(42);
  });

  // =========================================================================
  // STAGE 4: On-Chain Social Graph & Friendship Handshake & Blacklist
  // =========================================================================
  it('Stage 4: On-Chain Social Graph: Friendship Handshake & Blacklist Interception', async () => {
    const relAlice = await sdkAlice.relationship();
    const relBob = await sdkBob.relationship();

    // 1. Alice sends friend request to Bob on-chain
    const reqTx = await relAlice.sendRequest(bobDevice.address);
    await deployed.publicClient.waitForTransactionReceipt({ hash: reqTx });

    // 2. Bob accepts friend request on-chain
    const acceptTx = await relBob.acceptRequest(aliceDevice.address);
    await deployed.publicClient.waitForTransactionReceipt({ hash: acceptTx });

    // 3. Worker queries friends list for Alice: GET /social/friends
    const aliceToken = (await aliceDevice.authService.getSession())!.token;
    const friendsRes = await deployed.workerFetch('http://local-worker.internal/social/friends', {
      headers: { Authorization: `Bearer ${aliceToken}` },
    });
    expect(friendsRes.status).toBe(200);
    const friendsJson = await friendsRes.json() as any;
    expect(friendsJson.friends).toBeDefined();
    expect(friendsJson.friends.some((f: string) => f.toLowerCase() === bobDevice.address.toLowerCase())).toBe(true);

    // 4. Alice blocks Charlie on-chain
    const userAlice = await sdkAlice.user();
    const blockTx = await userAlice.blockUser(charlieDevice.address);
    await deployed.publicClient.waitForTransactionReceipt({ hash: blockTx });

    // 5. Worker validates blacklist query: GET /social/blacklist/:charlie
    const blRes = await deployed.workerFetch(
      `http://local-worker.internal/social/blacklist/${charlieDevice.address}`,
      { headers: { Authorization: `Bearer ${aliceToken}` } },
    );
    expect(blRes.status).toBe(200);
    const blJson = await blRes.json() as any;
    expect(blJson.is_blocked).toBe(true);

    // 6. Charlie authenticates and attempts to send direct message to Alice
    const charlieSession = await charlieDevice.authService.login(charlieDevice.address);
    const dmRes = await deployed.workerFetch('http://local-worker.internal/messages', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${charlieSession.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        conversation_id: `dm:${charlieDevice.address.toLowerCase()}:${aliceDevice.address.toLowerCase()}`,
        recipient_id: aliceDevice.address,
        content: 'Spam from Charlie!',
        type: 'text',
      }),
    });
    // Worker blocks sending because Alice has Charlie on chain blacklist
    expect(dmRes.status).toBe(400);
    const dmErr = await dmRes.json() as any;
    expect(dmErr.code || dmErr.error).toContain('BLOCKED_BY_RECIPIENT');

    // 7. Alice unblocks Charlie
    const unblockTx = await userAlice.unblockUser(charlieDevice.address);
    await deployed.publicClient.waitForTransactionReceipt({ hash: unblockTx });
  });

  // =========================================================================
  // STAGE 5: Local-First Messaging: Offline Queue, Reconnect & ACK Sync Flow
  // =========================================================================
  it('Stage 5: Local-First Messaging: Offline Queuing, Network Sync, ACK & Delivery Receipts', async () => {
    const convId = `dm:${aliceDevice.address.toLowerCase()}:${bobDevice.address.toLowerCase()}`;

    // 1. Send message from Alice to Bob
    const aliceMsg = await aliceDevice.chatEngine.sendMessage(convId, 'Hey Bob, check out Web3 Chat!');
    expect(aliceMsg.status).toBe('sent');
    expect(aliceMsg.content).toBe('Hey Bob, check out Web3 Chat!');

    // 2. Bob syncs incoming message via /sync
    const bobSync = await bobDevice.syncService.syncOnce();
    expect(bobSync).toBeDefined();
    expect(bobSync!.messages.length).toBeGreaterThanOrEqual(1);

    const received = bobSync!.messages.find((m: ChatMessage) => m.id === aliceMsg.id);
    expect(received).toBeDefined();
    expect(received?.content).toBe('Hey Bob, check out Web3 Chat!');

    // 3. Bob marks message as read
    await bobDevice.chatEngine.markMessageAsRead(aliceMsg.id);

    // 4. Alice pulls receipt status via /sync
    const aliceReceiptSync = await aliceDevice.syncService.syncOnce();
    expect(aliceReceiptSync?.receipts.length).toBeGreaterThan(0);

    // Local message status updated to read
    const aliceLocalMsg = await aliceDevice.msgRepo.getMessage(aliceMsg.id);
    expect(aliceLocalMsg?.status).toBe('read');
  });

  // =========================================================================
  // STAGE 6: 30-Second Message Recall & R2 Object Physical Destruction
  // =========================================================================
  it('Stage 6: 30-Second Message Recall & Immediate Physical R2 Data Purge', async () => {
    await sleep(1050);
    const convId = `dm:${aliceDevice.address.toLowerCase()}:${bobDevice.address.toLowerCase()}`;
    const aliceToken = (await aliceDevice.authService.getSession())!.token;

    // 1. Upload audio byte payload to Worker R2 with conversation_id
    const audioPayload = new Uint8Array([0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08]);
    const formData = new FormData();
    formData.append('file', new Blob([audioPayload]), 'voice-note.opus');
    formData.append('duration', '3.5');
    formData.append('conversation_id', convId);

    const uploadRes = await deployed.workerFetch('http://local-worker.internal/voice/upload', {
      method: 'POST',
      headers: { Authorization: `Bearer ${aliceToken}` },
      body: formData,
    });
    expect(uploadRes.status).toBe(201);
    const uploadJson = await uploadRes.json() as any;
    const mediaMessageId = uploadJson.message.id;
    expect(mediaMessageId).toBeDefined();

    // 2. Verify media can be streamed before recall
    const mediaGetBefore = await deployed.workerFetch(`http://local-worker.internal/voice/${mediaMessageId}`);
    expect(mediaGetBefore.status).toBe(200);

    // 2b. Bob first syncs to receive the incoming voice message
    const bobInitialSync = await bobDevice.syncService.syncOnce();
    expect(bobInitialSync?.messages.some((m) => m.id === mediaMessageId)).toBe(true);

    // Sleep before recall so recalled_at strictly advances past Bob's sync cursor
    await sleep(1050);

    // 3. Alice recalls the message within the 30-second window
    await aliceDevice.chatEngine.recallMessage(mediaMessageId);

    // 4. Verify R2 object has been physically purged immediately (returns 410 Gone)
    const mediaGetAfter = await deployed.workerFetch(`http://local-worker.internal/voice/${mediaMessageId}`);
    expect(mediaGetAfter.status).toBe(410);

    // 5. Bob synchronizes and receives recall notice
    const bobRecallSync = await bobDevice.syncService.syncOnce();
    expect(bobRecallSync?.recalls.length).toBeGreaterThan(0);

    const bobLocalMsg = await bobDevice.msgRepo.getMessage(mediaMessageId);
    expect(bobLocalMsg?.status).toBe('recalled');
  });

  // =========================================================================
  // STAGE 7: On-Chain Group Governance & Mute / Ban Real-Time Control
  // =========================================================================
  it('Stage 7: On-Chain Group Governance: Dynamic Discovery & Mute / Ban Enforcement', async () => {
    // 1. Alice creates on-chain group "Web3 Builders Guild"
    const txGroup = await sdkAlice.createGroup(
      {
        name: 'Web3 Builders Guild',
        description: 'Official Web3 Builders Group',
        announcement: 'Welcome to decentralized chat!',
      },
      [],
      JoinMode.PUBLIC,
      50n,
    );
    const groupRc = await deployed.publicClient.waitForTransactionReceipt({ hash: txGroup });
    expect(groupRc.status).toBe('success');

    const groupAlice = await sdkAlice.group(1n);
    expect(await groupAlice.isMember(aliceDevice.address)).toBe(true);

    // 2. Bob joins the group on-chain
    const groupBob = await sdkBob.group(1n);
    const joinTx = await groupBob.join();
    await deployed.publicClient.waitForTransactionReceipt({ hash: joinTx });
    expect(await groupBob.isMember(bobDevice.address)).toBe(true);

    // 3. Worker dynamic group discovery for Bob
    const bobToken = (await bobDevice.authService.getSession())!.token;
    const convsRes = await deployed.workerFetch('http://local-worker.internal/conversations', {
      headers: { Authorization: `Bearer ${bobToken}` },
    });
    expect(convsRes.status).toBe(200);
    const convsJson = await convsRes.json() as any;
    expect(convsJson.conversations.some((c: any) => c.id === 'group:1')).toBe(true);

    // 4. Non-member Charlie attempts to post to the group
    const charlieToken = (await charlieDevice.authService.getSession())!.token;
    const charliePostRes = await deployed.workerFetch('http://local-worker.internal/messages', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${charlieToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        conversation_id: 'group:1',
        content: 'I am not a member!',
        type: 'text',
      }),
    });
    expect(charliePostRes.status).toBe(400);
    const charlieErr = await charliePostRes.json() as any;
    expect(charlieErr.reason).toBe('NOT_GROUP_MEMBER');

    // 5. Alice mutes Bob on-chain for 3600 seconds
    const muteTx = await groupAlice.mute(bobDevice.address, 3600n);
    await deployed.publicClient.waitForTransactionReceipt({ hash: muteTx });

    // 6. Bob attempts to post while muted -> Worker rejects based on chain state
    const bobMutedPost = await deployed.workerFetch('http://local-worker.internal/messages', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${bobToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        conversation_id: 'group:1',
        content: 'Can I talk while muted?',
        type: 'text',
      }),
    });
    expect(bobMutedPost.status).toBe(400);
    const bobMutedErr = await bobMutedPost.json() as any;
    expect(bobMutedErr.reason).toBe('USER_MUTED_IN_GROUP');

    // 7. Alice unmutes Bob on-chain
    const unmuteTx = await groupAlice.unmute(bobDevice.address);
    await deployed.publicClient.waitForTransactionReceipt({ hash: unmuteTx });

    // 8. Bob successfully posts to the group
    const bobPostSuccess = await deployed.workerFetch('http://local-worker.internal/messages', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${bobToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        conversation_id: 'group:1',
        content: 'Thanks for unmuting me!',
        type: 'text',
      }),
    });
    expect(bobPostSuccess.status).toBe(201);
  });

  // =========================================================================
  // STAGE 8: LuckyDrop Merkle Red Packet Protocol Full Lifecycle
  // =========================================================================
  it('Stage 8: LuckyDrop Merkle Red Packet: Creation, Chat Delivery, Proof & Claim', async () => {
    // 1. Check Bob's initial token balance
    const bobInitialBal = await deployed.publicClient.readContract({
      address: deployed.mockToken,
      abi: [
        {
          inputs: [{ name: 'account', type: 'address' }],
          name: 'balanceOf',
          outputs: [{ name: '', type: 'uint256' }],
          stateMutability: 'view',
          type: 'function',
        },
      ],
      functionName: 'balanceOf',
      args: [bobDevice.address],
    });

    // 2. Alice prepares Merkle Tree for 2 recipients: Alice (index 0) and Bob (index 1)
    const recipientAddresses: Address[] = [aliceDevice.address, bobDevice.address];
    const totalPacketAmount = 20000000000000000000n; // 20 LRPT
    const shareAmount = 10000000000000000000n; // 10 LRPT each

    const leafBob = generateLeaf(1, bobDevice.address);

    // 3. Alice approves LRPT allowance to LuckyDropProxy using LuckyDropClient helper
    const approveTx = await luckyDropAlice.approveToken(deployed.mockToken, totalPacketAmount);
    await deployed.publicClient.waitForTransactionReceipt({ hash: approveTx });

    // 4. Alice creates LuckyDrop packet on-chain via @luckydrop/sdk
    const createPacketResult = await luckyDropAlice.createPacket({
      token: deployed.mockToken,
      totalAmount: totalPacketAmount,
      recipients: recipientAddresses,
      packetType: LuckyPacketType.FIXED,
      durationInSeconds: 3600,
    });
    await deployed.publicClient.waitForTransactionReceipt({ hash: createPacketResult.txHash });

    expect(createPacketResult.merkleTree).toBeDefined();
    const merkleRoot = createPacketResult.merkleTree!.root;
    expect(merkleRoot.startsWith('0x')).toBe(true);

    const bobProof = createPacketResult.merkleTree!.getProof(1); // Bob's index is 1
    expect(bobProof).toBeDefined();

    // Sleep before message delivery so created_at strictly advances past Bob's sync cursor
    await sleep(1050);

    // 5. Alice delivers red packet card to group chat
    const convId = 'group:1';
    const packetMsg = await aliceDevice.chatEngine.sendMessage(
      convId,
      '🧧 [Lucky Red Packet] Happy Web3 Year!',
      {
        type: 'packet',
        metadata: {
          packetId: '1',
          tokenAddress: deployed.mockToken,
          totalAmount: totalPacketAmount.toString(),
          recipientCount: 2,
          merkleRoot: merkleRoot,
          proofs: [createPacketResult.merkleTree!.getProof(0), bobProof],
        },
      },
    );
    expect(packetMsg.type).toBe('packet');

    // 6. Bob pulls the red packet message via /sync
    const bobSync = await bobDevice.syncService.syncOnce();
    const receivedPacketMsg = bobSync?.messages.find((m: ChatMessage) => m.id === packetMsg.id);
    expect(receivedPacketMsg).toBeDefined();

    // 7. Bob verifies his cryptographic Merkle proof locally
    const isProofValid = verifyProof(bobProof, merkleRoot, leafBob);
    expect(isProofValid).toBe(true);

    // 8. Bob claims his share of the red packet on-chain via @luckydrop/sdk
    const claimTxHash = await luckyDropBob.claim({
      packetId: 1n,
      index: 1,
      proof: bobProof,
    });
    const claimRc = await deployed.publicClient.waitForTransactionReceipt({ hash: claimTxHash });
    expect(claimRc.status).toBe('success');

    // 9. Verify Bob's ERC-20 token balance increased by exactly 10 LRPT
    const bobFinalBal = await deployed.publicClient.readContract({
      address: deployed.mockToken,
      abi: [
        {
          inputs: [{ name: 'account', type: 'address' }],
          name: 'balanceOf',
          outputs: [{ name: '', type: 'uint256' }],
          stateMutability: 'view',
          type: 'function',
        },
      ],
      functionName: 'balanceOf',
      args: [bobDevice.address],
    });
    expect(bobFinalBal - bobInitialBal).toBe(shareAmount);

    // 10. Double-claim prevention: Bob attempts to claim again -> reverts on-chain
    await expect(
      luckyDropBob.claim({
        packetId: 1n,
        index: 1,
        proof: bobProof,
      }),
    ).rejects.toThrow();
  });

  // =========================================================================
  // STAGE 9: Discover DApp Browser & EIP-1193 Web3 RPC Bridge
  // =========================================================================
  it('Stage 9: Discover DApp Browser: EIP-1193 RPC Bridge & On-Chain Query Tunnel', async () => {
    // 1. Verify in-page injection script generation for DApps
    const inpageScript = createEip1193InpageScript('0x7a69', aliceDevice.address);
    expect(inpageScript).toContain('window.ethereum');
    expect(inpageScript).toContain("currentChainId = '0x7a69'");
    expect(inpageScript.toLowerCase()).toContain(aliceDevice.address.toLowerCase());

    // 2. Setup EIP-1193 Bridge context connected to Anvil
    const bridgeCtx: BridgeContext = {
      walletAddress: aliceDevice.address,
      chainId: 31337,
      walletCore: aliceDevice.walletCore,
      evmService: aliceDevice.evmService,
      origin: 'https://app.uniswap.org',
      requestUserApproval: async (method, params, origin) => true,
    };

    // 3. DApp requests accounts: eth_requestAccounts
    const accountsRes = await handleEip1193Request(
      { id: 1, method: 'eth_requestAccounts' },
      bridgeCtx,
    );
    expect(accountsRes.result).toEqual([aliceDevice.address]);

    // 4. DApp requests personal signature: personal_sign
    const messageToSign = 'Welcome to Uniswap V4 on EVM';
    const hexMessage = `0x${Buffer.from(messageToSign, 'utf8').toString('hex')}`;
    const signRes = await handleEip1193Request(
      { id: 2, method: 'personal_sign', params: [hexMessage, aliceDevice.address] },
      bridgeCtx,
    );
    expect(signRes.result?.startsWith('0x')).toBe(true);
    expect(signRes.result?.length).toBe(132);

    // 5. DApp requests chainId: eth_chainId
    const chainIdRes = await handleEip1193Request(
      { id: 3, method: 'eth_chainId' },
      bridgeCtx,
    );
    expect(chainIdRes.result).toBe('0x7a69'); // 31337 in hex
  });
});
