// SPDX-License-Identifier: MIT
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  createWalletClient,
  http,
  keccak256,
  toBytes,
  encodePacked,
  encodeFunctionData,
  decodeFunctionResult,
  type Address,
  type Hex,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import {
  ChatSDK,
  JoinMode,
  Role,
  ChatStorageFactoryABI,
  GroupImplementationABI,
} from '@web3-chat/sdk';
import {
  LuckyDropClient,
  PacketType as LuckyPacketType,
  generateLeaf,
  verifyProof,
  luckyDropAbi,
} from '@luckydrop/sdk';
import {
  deployAllProtocolsToAnvil,
  startAnvil,
  anvilChain,
  createUserDevice,
  sleep,
  runSweeperOnWorker,
  type AnvilInstance,
  type DeployedAllProtocols,
  type TestUserDevice,
} from './deployAllProtocols';
import type { ChainConfig, ChatMessage } from '../src/types';

describe('Advanced & High-Complexity Multi-Repo Joint Verification Suite', () => {
  let anvil: AnvilInstance;
  let deployed: DeployedAllProtocols;
  let localChainConfig: ChainConfig;

  // Real Anvil accounts
  const ALICE_PK: Hex = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
  const BOB_PK: Hex = '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d';
  const CHARLIE_PK: Hex = '0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a';
  const DAVE_PK: Hex = '0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6';

  let aliceDevice: TestUserDevice;
  let bobDevice: TestUserDevice;
  let charlieDevice: TestUserDevice;
  let daveDevice: TestUserDevice;

  let sdkAlice: ChatSDK;
  let sdkBob: ChatSDK;
  let sdkCharlie: ChatSDK;
  let sdkDave: ChatSDK;

  let luckyDropAlice: LuckyDropClient;
  let luckyDropBob: LuckyDropClient;
  let luckyDropCharlie: LuckyDropClient;
  let luckyDropDave: LuckyDropClient;

  beforeAll(async () => {
    anvil = await startAnvil(8548);
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

    aliceDevice = createUserDevice('Alice', ALICE_PK, deployed, localChainConfig);
    bobDevice = createUserDevice('Bob', BOB_PK, deployed, localChainConfig);
    charlieDevice = createUserDevice('Charlie', CHARLIE_PK, deployed, localChainConfig);
    daveDevice = createUserDevice('Dave', DAVE_PK, deployed, localChainConfig);

    await aliceDevice.walletCore.importFromPrivateKey(ALICE_PK, 'Alice');
    await bobDevice.walletCore.importFromPrivateKey(BOB_PK, 'Bob');
    await charlieDevice.walletCore.importFromPrivateKey(CHARLIE_PK, 'Charlie');
    await daveDevice.walletCore.importFromPrivateKey(DAVE_PK, 'Dave');

    const aliceWallet = createWalletClient({
      account: privateKeyToAccount(ALICE_PK),
      chain: anvilChain,
      transport: http(anvil.rpcUrl),
    });
    const bobWallet = createWalletClient({
      account: privateKeyToAccount(BOB_PK),
      chain: anvilChain,
      transport: http(anvil.rpcUrl),
    });
    const charlieWallet = createWalletClient({
      account: privateKeyToAccount(CHARLIE_PK),
      chain: anvilChain,
      transport: http(anvil.rpcUrl),
    });
    const daveWallet = createWalletClient({
      account: privateKeyToAccount(DAVE_PK),
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
    sdkCharlie = new ChatSDK({
      factoryAddress: deployed.factory,
      chain: anvilChain,
      publicClient: deployed.publicClient,
      walletClient: charlieWallet,
    });
    sdkDave = new ChatSDK({
      factoryAddress: deployed.factory,
      chain: anvilChain,
      publicClient: deployed.publicClient,
      walletClient: daveWallet,
    });

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
    luckyDropCharlie = new LuckyDropClient({
      contractAddress: deployed.luckyDropProxy,
      publicClient: deployed.publicClient,
      walletClient: charlieWallet,
    });
    luckyDropDave = new LuckyDropClient({
      contractAddress: deployed.luckyDropProxy,
      publicClient: deployed.publicClient,
      walletClient: daveWallet,
    });

    // Authenticate all users
    await aliceDevice.authService.login(aliceDevice.address);
    await bobDevice.authService.login(bobDevice.address);
    await charlieDevice.authService.login(charlieDevice.address);
    await daveDevice.authService.login(daveDevice.address);
  }, 45000);

  afterAll(async () => {
    aliceDevice?.evmService?.close();
    bobDevice?.evmService?.close();
    charlieDevice?.evmService?.close();
    daveDevice?.evmService?.close();
    deployed?.evmCallClient?.close();
    if (anvil) {
      await anvil.stop();
    }
  });

  // =========================================================================
  // COMPLEX CASE 1: Ephemeral "Burn-On-Read" Lifecycle & Dual-Storage Physical Purge
  // =========================================================================
  it('Complex Case 1: Ephemeral "Burn-On-Read" Lifecycle & Sweeper Dual-Storage Physical Purge', async () => {
    await sleep(1050);
    const convId = `dm:${bobDevice.address.toLowerCase()}:${aliceDevice.address.toLowerCase()}`;
    const aliceToken = (await aliceDevice.authService.getSession())!.token;
    const bobToken = (await bobDevice.authService.getSession())!.token;

    // 1. Alice uploads an ephemeral voice note with burn_after_seconds = 2
    const audioPayload = new Uint8Array([0xAA, 0xBB, 0xCC, 0xDD, 0xEE]);
    const formData = new FormData();
    formData.append('file', new Blob([audioPayload]), 'ephemeral.opus');
    formData.append('conversation_id', convId);
    formData.append('retention', 'on_read');
    formData.append('burn_after_seconds', '2');

    const uploadRes = await deployed.workerFetch('http://local-worker.internal/voice/upload', {
      method: 'POST',
      headers: { Authorization: `Bearer ${aliceToken}` },
      body: formData,
    });
    expect(uploadRes.status).toBe(201);
    const uploadJson = await uploadRes.json() as any;
    const ephMsgId = uploadJson.message.id;
    expect(ephMsgId).toBeDefined();

    // 2. Bob syncs and verifies initial status is delivered, expires_at is 0 (burn not yet started)
    const bobSync1 = await bobDevice.syncService.syncOnce();
    const bobMsg1 = bobSync1?.messages.find((m) => m.id === ephMsgId);
    expect(bobMsg1).toBeDefined();
    expect(bobMsg1?.expires_at).toBe(0);

    // 3. Verify media can be streamed before reading
    const streamBefore = await deployed.workerFetch(`http://local-worker.internal/voice/${ephMsgId}`);
    expect(streamBefore.status).toBe(200);

    // 4. Sender Alice reads her own message -> verify it does NOT activate the burn timer!
    const aliceReadRes = await deployed.workerFetch(`http://local-worker.internal/messages/${ephMsgId}/read`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${aliceToken}` },
    });
    expect(aliceReadRes.status).toBe(200);
    const aliceReadJson = await aliceReadRes.json() as any;
    expect(aliceReadJson.message.expires_at).toBe(0);

    // 5. Recipient Bob reads the message -> Worker activates the 2-second burn countdown
    const bobReadRes = await deployed.workerFetch(`http://local-worker.internal/messages/${ephMsgId}/read`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${bobToken}` },
    });
    expect(bobReadRes.status).toBe(200);
    const bobReadJson = await bobReadRes.json() as any;
    expect(bobReadJson.message.expires_at).toBeGreaterThan(0);
    const expiresAt = bobReadJson.message.expires_at;

    // 6. Wait 2.2 seconds for the message to expire
    await sleep(2200);

    // 7. Verify /sync filters out the expired ephemeral message
    const bobSyncAfterBurn = await deployed.workerFetch('http://local-worker.internal/sync?since=0', {
      headers: { Authorization: `Bearer ${bobToken}` },
    });
    const syncJson = await bobSyncAfterBurn.json() as any;
    expect(syncJson.messages.some((m: any) => m.id === ephMsgId)).toBe(false);

    // 8. Verify media access returns 410 Gone
    const streamAfter = await deployed.workerFetch(`http://local-worker.internal/voice/${ephMsgId}`);
    expect(streamAfter.status).toBe(410);

    // 9. Run SweeperService to physically erase D1 row and R2 binary
    const report = await runSweeperOnWorker(deployed.workerEnv);
    expect(report.purged_messages_count).toBeGreaterThanOrEqual(1);

    // Verify row is physically purged from DB
    const dbRow = await deployed.workerEnv.DB.prepare('SELECT * FROM messages WHERE id = ?')
      .bind(ephMsgId)
      .first();
    expect(dbRow).toBeNull();
  });

  // =========================================================================
  // COMPLEX CASE 2: Deep Group Governance: Role Hierarchy, Inverted Moderation Defense & Two-Step Ownership Transfer
  // =========================================================================
  it('Complex Case 2: Deep Group Governance: Role Hierarchy, Inverted Moderation Defense & Two-Step Ownership Transfer', async () => {
    // 1. Alice creates group "Web3 Protocol Guild"
    const txGroup = await sdkAlice.createGroup(
      {
        name: 'Web3 Protocol Guild',
        description: 'Elite Web3 Builders Group',
        announcement: 'Decentralized governance in action',
      },
      [],
      JoinMode.PUBLIC,
      50n,
    );
    await deployed.publicClient.waitForTransactionReceipt({ hash: txGroup });

    const groupId = 1n;
    const groupAlice = await sdkAlice.group(groupId);
    const groupBob = await sdkBob.group(groupId);
    const groupCharlie = await sdkCharlie.group(groupId);
    const groupDave = await sdkDave.group(groupId);

    // Bob and Charlie join
    await deployed.publicClient.waitForTransactionReceipt({ hash: await groupBob.join() });
    await deployed.publicClient.waitForTransactionReceipt({ hash: await groupCharlie.join() });

    expect(await groupAlice.isMember(bobDevice.address)).toBe(true);
    expect(await groupAlice.isMember(charlieDevice.address)).toBe(true);

    // 2. Alice (Owner) promotes Bob to ADMIN
    const promoteTx = await groupAlice.grantRole(bobDevice.address, Role.ADMIN);
    await deployed.publicClient.waitForTransactionReceipt({ hash: promoteTx });
    expect(await groupAlice.getMemberRole(bobDevice.address)).toBe(Role.ADMIN);

    // 3. Admin Bob mutes Member Charlie for 3600 seconds
    const muteTx = await groupBob.mute(charlieDevice.address, 3600n);
    await deployed.publicClient.waitForTransactionReceipt({ hash: muteTx });

    // Charlie attempts to post to the group -> Worker rejects based on chain state
    const charlieToken = (await charlieDevice.authService.getSession())!.token;
    const charliePost = await deployed.workerFetch('http://local-worker.internal/messages', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${charlieToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        conversation_id: 'group:1',
        content: 'I want to speak!',
        type: 'text',
      }),
    });
    expect(charliePost.status).toBe(400);
    const charlieErr = await charliePost.json() as any;
    expect(charlieErr.reason).toBe('USER_MUTED_IN_GROUP');

    // 4. Inverted Moderation Defense: Admin Bob attempts to mute Owner Alice -> Reverts on chain
    await expect(groupBob.mute(aliceDevice.address, 3600n)).rejects.toThrow();

    // 5. Inverted Moderation Defense: Regular Member Charlie attempts to mute Admin Bob -> Reverts
    await expect(groupCharlie.mute(bobDevice.address, 3600n)).rejects.toThrow();

    // 6. Two-Step Ownership Transfer: Alice transfers ownership to Bob
    const transferTx = await groupAlice.transferOwnership(bobDevice.address);
    await deployed.publicClient.waitForTransactionReceipt({ hash: transferTx });

    // Alice is still owner until Bob accepts
    const ownerContract = await deployed.publicClient.readContract({
      address: await sdkAlice.getGroup(groupId),
      abi: GroupImplementationABI,
      functionName: 'owner',
    });
    expect(ownerContract.toLowerCase()).toBe(aliceDevice.address.toLowerCase());

    // Bob accepts ownership
    const acceptTx = await groupBob.acceptOwnership();
    await deployed.publicClient.waitForTransactionReceipt({ hash: acceptTx });

    // Verify Bob is now the on-chain Owner
    const newOwner = await deployed.publicClient.readContract({
      address: await sdkAlice.getGroup(groupId),
      abi: GroupImplementationABI,
      functionName: 'owner',
    });
    expect(newOwner.toLowerCase()).toBe(bobDevice.address.toLowerCase());

    // 7. Invite-Only Join Protection: Bob switches group to INVITE_ONLY
    const setModeTx = await groupBob.setJoinMode(JoinMode.INVITE_ONLY);
    await deployed.publicClient.waitForTransactionReceipt({ hash: setModeTx });

    // Dave attempts to call join() directly -> Reverts with InviteOnly
    await expect(groupDave.join()).rejects.toThrow();

    // Bob creates on-chain invite code hash
    const inviteSecret = 'web3-secret-invite-key-2026';
    const codeHash = keccak256(toBytes(inviteSecret));
    const now = BigInt(Math.floor(Date.now() / 1000));
    const createInviteTx = await groupBob.createInvite(codeHash, now + 86400n, 10);
    await deployed.publicClient.waitForTransactionReceipt({ hash: createInviteTx });

    // Dave uses the invite code on-chain -> succeeds!
    const useInviteTx = await groupDave.useInvite(codeHash);
    await deployed.publicClient.waitForTransactionReceipt({ hash: useInviteTx });
    expect(await groupBob.isMember(daveDevice.address)).toBe(true);
  });

  // =========================================================================
  // COMPLEX CASE 3: LuckyDrop Multi-Recipient Random Luck, Cryptographic Proof Forgery & Expiry Refund
  // =========================================================================
  it('Complex Case 3: LuckyDrop Multi-Recipient Random Luck, Cryptographic Proof Forgery Defense & Expiration Refund', async () => {
    // 1. Alice creates a 3-recipient Random Red Packet (Bob, Charlie, Dave) with 30 LRPT
    const totalAmount = 30000000000000000000n; // 30 LRPT
    const recipients: Address[] = [bobDevice.address, charlieDevice.address, daveDevice.address];

    const approveTx = await luckyDropAlice.approveToken(deployed.mockToken, totalAmount);
    await deployed.publicClient.waitForTransactionReceipt({ hash: approveTx });

    const createPacketResult = await luckyDropAlice.createPacket({
      token: deployed.mockToken,
      totalAmount,
      recipients,
      packetType: LuckyPacketType.RANDOM,
      durationInSeconds: 3600,
    });
    await deployed.publicClient.waitForTransactionReceipt({ hash: createPacketResult.txHash });
    const nextPacketId1 = await deployed.publicClient.readContract({
      address: deployed.luckyDropProxy,
      abi: luckyDropAbi,
      functionName: 'getNextPacketId',
    });
    const packetId = nextPacketId1 - 1n;

    const merkleTree = createPacketResult.merkleTree!;
    const bobProof = merkleTree.getProof(0); // Index 0 is Bob
    const charlieProof = merkleTree.getProof(1); // Index 1 is Charlie

    // 2. Cryptographic Proof Forgery Defense:
    // Charlie takes Bob's proof and tries to claim index 0 using Charlie's account -> Reverts InvalidProof
    await expect(
      luckyDropCharlie.claim({
        packetId,
        index: 0,
        proof: bobProof,
      }),
    ).rejects.toThrow();

    // 3. Legitimate Claim: Bob claims index 0 with Bob's proof
    const bobClaimTx = await luckyDropBob.claim({
      packetId,
      index: 0,
      proof: bobProof,
    });
    const bobRc = await deployed.publicClient.waitForTransactionReceipt({ hash: bobClaimTx });
    expect(bobRc.status).toBe('success');

    // Double-claim prevention: Bob cannot claim index 0 again
    await expect(
      luckyDropBob.claim({
        packetId,
        index: 0,
        proof: bobProof,
      }),
    ).rejects.toThrow();

    // Charlie legitimately claims index 1
    const charlieClaimTx = await luckyDropCharlie.claim({
      packetId,
      index: 1,
      proof: charlieProof,
    });
    const charlieRc = await deployed.publicClient.waitForTransactionReceipt({ hash: charlieClaimTx });
    expect(charlieRc.status).toBe('success');

    // 4. Packet Expiration & Creator Refund Flow:
    // Alice creates a 1-second packet with 10 LRPT for Dave
    const refundAmount = 10000000000000000000n; // 10 LRPT
    const approveRefundTx = await luckyDropAlice.approveToken(deployed.mockToken, refundAmount);
    await deployed.publicClient.waitForTransactionReceipt({ hash: approveRefundTx });

    const shortPacket = await luckyDropAlice.createPacket({
      token: deployed.mockToken,
      totalAmount: refundAmount,
      recipients: [daveDevice.address],
      packetType: LuckyPacketType.FIXED,
      durationInSeconds: 10,
    });
    await deployed.publicClient.waitForTransactionReceipt({ hash: shortPacket.txHash });
    const nextPacketId2 = await deployed.publicClient.readContract({
      address: deployed.luckyDropProxy,
      abi: luckyDropAbi,
      functionName: 'getNextPacketId',
    });
    const shortPacketId = nextPacketId2 - 1n;

    // Fast-forward Anvil blockchain time by 300 seconds
    await deployed.publicClient.request({
      method: 'evm_increaseTime' as any,
      params: [300] as any,
    });
    await deployed.publicClient.request({
      method: 'evm_mine' as any,
      params: [] as any,
    });

    // Dave attempts to claim after expiration -> Reverts PacketExpired
    const daveProof = shortPacket.merkleTree!.getProof(0);
    await expect(
      luckyDropDave.claim({
        packetId: shortPacketId,
        index: 0,
        proof: daveProof,
      }),
    ).rejects.toThrow();

    // Alice calls refund() on the expired packet
    const aliceBalBefore = await deployed.publicClient.readContract({
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
      args: [aliceDevice.address],
    });

    const refundTx = await luckyDropAlice.refund(shortPacketId);
    await deployed.publicClient.waitForTransactionReceipt({ hash: refundTx });

    const aliceBalAfter = await deployed.publicClient.readContract({
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
      args: [aliceDevice.address],
    });

    // Exactly 10 LRPT returned to Alice
    expect(aliceBalAfter - aliceBalBefore).toBe(refundAmount);
  });

  // =========================================================================
  // COMPLEX CASE 4: High-Concurrency Burst & Sync Pagination Cursor Integrity
  // =========================================================================
  it('Complex Case 4: High-Concurrency Burst & Sync Pagination Cursor Integrity', async () => {
    await sleep(1050);
    const aliceToken = (await aliceDevice.authService.getSession())!.token;
    const bobToken = (await bobDevice.authService.getSession())!.token;
    const convId = 'group:1';

    // 1. Alice sends 3 batches of 4 messages (total 12 messages) across distinct seconds
    const sentMessageIds: string[] = [];
    for (let batch = 1; batch <= 3; batch++) {
      if (batch > 1) {
        await sleep(1050); // Ensure timestamp advances by >=1s for second-based cursor separation
      }
      for (let i = 1; i <= 4; i++) {
        const msgNum = (batch - 1) * 4 + i;
        const res = await deployed.workerFetch('http://local-worker.internal/messages', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${aliceToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            conversation_id: convId,
            content: `Burst Message #${msgNum}`,
            type: 'text',
          }),
        });
        expect(res.status).toBe(201);
        const data = await res.json() as any;
        sentMessageIds.push(data.message.id);
      }
    }
    expect(sentMessageIds.length).toBe(12);

    // 2. Bob syncs page 1 with limit = 4
    const page1Res = await deployed.workerFetch('http://local-worker.internal/sync?since=0&limit=4', {
      headers: { Authorization: `Bearer ${bobToken}` },
    });
    expect(page1Res.status).toBe(200);
    const page1 = await page1Res.json() as any;
    expect(page1.messages.length).toBe(4);
    expect(page1.has_more).toBe(true);
    const cursor1 = page1.sync_timestamp;

    // 3. Bob syncs page 2 with since = cursor1 and limit = 4
    const page2Res = await deployed.workerFetch(`http://local-worker.internal/sync?since=${cursor1}&limit=4`, {
      headers: { Authorization: `Bearer ${bobToken}` },
    });
    expect(page2Res.status).toBe(200);
    const page2 = await page2Res.json() as any;
    expect(page2.messages.length).toBe(4);
    const cursor2 = page2.sync_timestamp;

    // 4. Bob syncs page 3 with since = cursor2 and limit = 4
    const page3Res = await deployed.workerFetch(`http://local-worker.internal/sync?since=${cursor2}&limit=4`, {
      headers: { Authorization: `Bearer ${bobToken}` },
    });
    expect(page3Res.status).toBe(200);
    const page3 = await page3Res.json() as any;
    expect(page3.messages.length).toBe(4);

    // Verify zero duplicates across paginated results
    const allRetrievedIds = [
      ...page1.messages.map((m: any) => m.id),
      ...page2.messages.map((m: any) => m.id),
      ...page3.messages.map((m: any) => m.id),
    ];
    const uniqueIds = new Set(allRetrievedIds);
    expect(uniqueIds.size).toBe(12);
  });

  // =========================================================================
  // COMPLEX CASE 5: Security Adversarial Suite: Replay, Spoofing & Unauthorized Recall
  // =========================================================================
  it('Complex Case 5: Security Adversarial Suite: Replay, Spoofing & Unauthorized Recall', async () => {
    // 1. EIP-191 Replay Defense: Eve intercepts Alice's login signature and attempts to reuse nonce
    const nonceRes = await deployed.workerFetch(`http://local-worker.internal/auth/nonce?address=${aliceDevice.address}`);
    const { nonce, message } = await nonceRes.json() as any;

    const signature = await aliceDevice.walletCore.signMessage(message, aliceDevice.address);

    // First login succeeds
    const firstLogin = await deployed.workerFetch('http://local-worker.internal/auth/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        address: aliceDevice.address,
        nonce,
        signature,
      }),
    });
    expect(firstLogin.status).toBe(200);

    // Replay attempt with the exact same nonce and signature -> Rejected
    const replayLogin = await deployed.workerFetch('http://local-worker.internal/auth/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        address: aliceDevice.address,
        nonce,
        signature,
      }),
    });
    expect(replayLogin.status).toBe(401);

    // 2. Identity Spoofing Defense: Bob signs challenge meant for Alice's address
    const aliceNonceRes = await deployed.workerFetch(`http://local-worker.internal/auth/nonce?address=${aliceDevice.address}`);
    const aliceChallenge = await aliceNonceRes.json() as any;

    // Bob maliciously signs Alice's challenge with Bob's private key
    const bobMaliciousSig = await bobDevice.walletCore.signMessage(aliceChallenge.message, bobDevice.address);

    const spoofAttempt = await deployed.workerFetch('http://local-worker.internal/auth/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        address: aliceDevice.address,
        nonce: aliceChallenge.nonce,
        signature: bobMaliciousSig,
      }),
    });
    expect(spoofAttempt.status).toBe(401);

    // 3. Unauthorized Recall Defense: Bob tries to recall Alice's message
    const aliceToken = (await aliceDevice.authService.getSession())!.token;
    const bobToken = (await bobDevice.authService.getSession())!.token;
    const convId = `dm:${bobDevice.address.toLowerCase()}:${aliceDevice.address.toLowerCase()}`;

    const msgRes = await deployed.workerFetch('http://local-worker.internal/messages', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${aliceToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        conversation_id: convId,
        content: 'Protected message from Alice',
        type: 'text',
      }),
    });
    const msgData = await msgRes.json() as any;
    const aliceMsgId = msgData.message.id;

    // Bob attempts to recall Alice's message using Bob's token -> 403 Unauthorized
    const unauthRecall = await deployed.workerFetch(`http://local-worker.internal/messages/${aliceMsgId}/recall`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${bobToken}` },
    });
    expect(unauthRecall.status).toBe(403);
  });

  // =========================================================================
  // COMPLEX CASE 6: Atomic Multicall3 Batch Aggregation via evm-call
  // =========================================================================
  it('Complex Case 6: Atomic Multicall3 Batch Aggregation via evm-call in 1 Round Trip', async () => {
    // Construct 6 simultaneous contract read calls to be executed in a single atomic Multicall3 batch
    const erc20Abi = [
      { inputs: [{ name: 'account', type: 'address' }], name: 'balanceOf', outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view', type: 'function' },
      { inputs: [], name: 'symbol', outputs: [{ name: '', type: 'string' }], stateMutability: 'view', type: 'function' },
      { inputs: [], name: 'decimals', outputs: [{ name: '', type: 'uint8' }], stateMutability: 'view', type: 'function' },
    ] as const;

    const callBalAlice = encodeFunctionData({
      abi: erc20Abi,
      functionName: 'balanceOf',
      args: [aliceDevice.address],
    });
    const callBalBob = encodeFunctionData({
      abi: erc20Abi,
      functionName: 'balanceOf',
      args: [bobDevice.address],
    });
    const callSymbol = encodeFunctionData({
      abi: erc20Abi,
      functionName: 'symbol',
    });
    const callDecimals = encodeFunctionData({
      abi: erc20Abi,
      functionName: 'decimals',
    });

    const callUserOverviewAlice = encodeFunctionData({
      abi: ChatStorageFactoryABI,
      functionName: 'getUserOverview',
      args: [aliceDevice.address],
    });

    const callGroupMemberCount = encodeFunctionData({
      abi: GroupImplementationABI,
      functionName: 'memberCount',
    });

    const groupAddress = await sdkAlice.getGroup(1n);

    const currentBlock = await deployed.publicClient.getBlockNumber();

    // Execute atomic Multicall3 batch via evmCallClient
    const batchResult = await deployed.evmCallClient.multicall({
      chain: 31337,
      blockNumber: currentBlock,
      calls: [
        { id: 'balAlice', target: deployed.mockToken, callData: callBalAlice, allowFailure: false },
        { id: 'balBob', target: deployed.mockToken, callData: callBalBob, allowFailure: false },
        { id: 'symbol', target: deployed.mockToken, callData: callSymbol, allowFailure: false },
        { id: 'decimals', target: deployed.mockToken, callData: callDecimals, allowFailure: false },
        { id: 'overview', target: deployed.factory, callData: callUserOverviewAlice, allowFailure: false },
        { id: 'memberCount', target: groupAddress, callData: callGroupMemberCount, allowFailure: false },
      ],
    });

    expect(batchResult.results.length).toBe(6);
    expect(batchResult.multicallBatches).toBe(1); // Proves single atomic RPC round-trip

    // Decode & verify all results
    const symbolResult = decodeFunctionResult({
      abi: erc20Abi,
      functionName: 'symbol',
      data: batchResult.results[2].returnData as Hex,
    });
    expect(symbolResult).toBe('LRPT');

    const decimalsResult = decodeFunctionResult({
      abi: erc20Abi,
      functionName: 'decimals',
      data: batchResult.results[3].returnData as Hex,
    });
    expect(decimalsResult).toBe(18);

    const groupCountResult = decodeFunctionResult({
      abi: GroupImplementationABI,
      functionName: 'memberCount',
      data: batchResult.results[5].returnData as Hex,
    });
    expect(groupCountResult).toBeGreaterThanOrEqual(2n);
  });
});
