import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  MockWorkerBackend,
  createDeviceSandbox,
  type DeviceSandbox,
} from './helpers';
import { FriendStatus } from '../../src/types/contact';
import { PacketType } from '../../src/types/packet';
import { BSC_TESTNET, ETHEREUM_SEPOLIA } from '../../src/constants/chains';
import { SocialContractService } from '../../src/features/contacts/SocialContractService';
import {
  handleEip1193Request,
  createEip1193InpageScript,
  type BridgeContext,
} from '../../src/features/discover/bridge/eip1193Bridge';
import { verifyMerkleProof } from '../../src/features/packet/LuckyDropService';
import type { Hex } from 'viem';

async function createTestUserWallet(sandbox: DeviceSandbox, name: string) {
  const mnemonic = sandbox.walletCore.generateMnemonic();
  return sandbox.walletCore.createWalletFromMnemonic(mnemonic, name);
}

describe('TASK-014: Full System Joint End-to-End Test Suite', () => {
  let mockWorker: MockWorkerBackend;
  let alice: DeviceSandbox;
  let bob: DeviceSandbox;

  beforeEach(async () => {
    mockWorker = new MockWorkerBackend();
    alice = createDeviceSandbox('Alice-Device', mockWorker);
    bob = createDeviceSandbox('Bob-Device', mockWorker);
  });

  afterEach(() => {
    alice.syncService.stopPolling();
    bob.syncService.stopPolling();
    alice.evm.close();
    bob.evm.close();
  });

  it('Step 1: Multi-Device Wallet Initialization & KeyStore Persistence', async () => {
    // Alice creates mnemonic-based wallet
    const aliceMnemonic = alice.walletCore.generateMnemonic();
    expect(alice.walletCore.validateMnemonic(aliceMnemonic)).toBe(true);

    const aliceAccount = await alice.walletCore.createWalletFromMnemonic(aliceMnemonic, "Alice's Primary Wallet");
    expect(aliceAccount.address.startsWith('0x')).toBe(true);
    expect(aliceAccount.address.length).toBe(42);

    // Verify Alice's credentials persisted in KeyStore
    const aliceActive = await alice.keyStore.getActiveWalletAddress();
    expect(aliceActive?.toLowerCase()).toBe(aliceAccount.address.toLowerCase());
    const aliceSecret = await alice.keyStore.getWalletSecret(aliceAccount.address);
    expect(aliceSecret?.mnemonic).toBe(aliceMnemonic);

    // Bob creates mnemonic-based wallet on Bob's isolated device
    const bobMnemonic = bob.walletCore.generateMnemonic();
    expect(bob.walletCore.validateMnemonic(bobMnemonic)).toBe(true);

    const bobAccount = await bob.walletCore.createWalletFromMnemonic(bobMnemonic, "Bob's Primary Wallet");
    expect(bobAccount.address.startsWith('0x')).toBe(true);
    expect(bobAccount.address.toLowerCase()).not.toBe(aliceAccount.address.toLowerCase());

    // Verify Bob's credentials isolated and stored in Bob's KeyStore
    const bobActive = await bob.keyStore.getActiveWalletAddress();
    expect(bobActive?.toLowerCase()).toBe(bobAccount.address.toLowerCase());
    const bobSecret = await bob.keyStore.getWalletSecret(bobAccount.address);
    expect(bobSecret?.mnemonic).toBe(bobMnemonic);
  });

  it('Step 2: BSC Testnet & Multi-Chain EVM Gateway Connectivity', async () => {
    // Verify default network configuration is BSC Testnet (Chain ID 97)
    const currentChain = alice.evm.getCurrentChain();
    expect(currentChain.chainId).toBe(97);
    expect(currentChain.nativeCurrency.symbol).toBe('tBNB');
    expect(currentChain.contracts.multicall3.startsWith('0x')).toBe(true);
    expect(currentChain.rpcUrls.length).toBeGreaterThan(0);

    // Verify multi-chain switching to Sepolia
    alice.evm.switchChain(ETHEREUM_SEPOLIA.chainId);
    expect(alice.evm.getCurrentChain().chainId).toBe(11155111);
    expect(alice.evm.getCurrentChain().name).toBe('Ethereum Sepolia');

    // Switch back to BSC Testnet
    alice.evm.switchChain(BSC_TESTNET.chainId);
    expect(alice.evm.getCurrentChain().chainId).toBe(97);
  });

  it('Step 3: SIWE Challenge-Response Authentication & Bearer Session Flow', async () => {
    // Setup wallets for Alice and Bob
    const aliceAccount = await createTestUserWallet(alice, "Alice's Account");
    const bobAccount = await createTestUserWallet(bob, "Bob's Account");

    // Alice unauthenticated initially
    expect(await alice.authService.isAuthenticated()).toBe(false);

    // Alice performs SIWE login
    const aliceSession = await alice.authService.login(aliceAccount.address);
    expect(aliceSession.token.startsWith('jwt-')).toBe(true);
    expect(aliceSession.wallet_address.toLowerCase()).toBe(aliceAccount.address.toLowerCase());
    expect(await alice.authService.isAuthenticated()).toBe(true);

    // Bob performs SIWE login
    expect(await bob.authService.isAuthenticated()).toBe(false);
    const bobSession = await bob.authService.login(bobAccount.address);
    expect(bobSession.token.startsWith('jwt-')).toBe(true);
    expect(bobSession.wallet_address.toLowerCase()).toBe(bobAccount.address.toLowerCase());
    expect(await bob.authService.isAuthenticated()).toBe(true);

    // Verify sessions cached in keystore
    const aliceCached = await alice.authService.getSession();
    expect(aliceCached?.token).toBe(aliceSession.token);
  });

  it('Step 4: On-Chain Social Graph & Contacts Synchronization Flow', async () => {
    const aliceAccount = await createTestUserWallet(alice, "Alice");
    const bobAccount = await createTestUserWallet(bob, "Bob");

    // Alice adds Bob as friend
    const req = await alice.social.sendFriendRequest(bobAccount.address, 'Bob Crypto');
    expect(req.status).toBe(FriendStatus.PENDING_OUT);
    expect(req.alias).toBe('Bob Crypto');

    // Alice cached contacts has Bob in pending status
    const aliceContacts = await alice.social.getCachedContacts();
    const bobInAlice = aliceContacts.find((c) => c.address === bobAccount.address.toLowerCase());
    expect(bobInAlice?.status).toBe(FriendStatus.PENDING_OUT);

    // Bob accepts friend request from Alice
    const accepted = await bob.social.acceptFriendRequest(aliceAccount.address);
    expect(accepted.status).toBe(FriendStatus.FRIEND);

    // Alice also accepts/confirms Bob
    await alice.social.acceptFriendRequest(bobAccount.address);
    const updatedAliceContacts = await alice.social.getCachedContacts();
    const confirmedBob = updatedAliceContacts.find((c) => c.address === bobAccount.address.toLowerCase());
    expect(confirmedBob?.status).toBe(FriendStatus.FRIEND);

    // Verify alphabetical contact sorting
    const sections = SocialContractService.groupContactsAlphabetical(updatedAliceContacts);
    expect(sections.some((s) => s.title === 'B')).toBe(true);
  });

  it('Step 5: Local-First Messaging: Offline Queue, Network Sync, ACK, and 30s Recall', async () => {
    // 1. Initialize users and auth
    const aliceAccount = await createTestUserWallet(alice, "Alice");
    const bobAccount = await createTestUserWallet(bob, "Bob");
    await alice.authService.login(aliceAccount.address);
    await bob.authService.login(bobAccount.address);

    const convId = `dm:${aliceAccount.address.toLowerCase()}:${bobAccount.address.toLowerCase()}`;

    // 2. Offline queueing on Device A
    mockWorker.isOnline = false; // Simulate offline network

    const offlineMsg = await alice.chatEngine.sendMessage(convId, 'Hey Bob, sending this while offline!');
    expect(offlineMsg.status).toBe('pending');
    expect(offlineMsg.content).toBe('Hey Bob, sending this while offline!');

    // Verify local persistence on Device A
    const localPending = await alice.msgRepo.getPendingMessages();
    expect(localPending.length).toBe(1);
    expect(localPending[0].id).toBe(offlineMsg.id);

    const convBeforeSync = await alice.convRepo.getConversation(convId);
    expect(convBeforeSync?.last_message).toBe('Hey Bob, sending this while offline!');

    // 3. Network Restored & Auto Retry
    mockWorker.isOnline = true; // Connection restored
    const sentCount = await alice.chatEngine.retryPendingMessages();
    expect(sentCount).toBe(1);

    // Local status transitioned to sent
    const pendingAfterRetry = await alice.msgRepo.getPendingMessages();
    expect(pendingAfterRetry.length).toBe(0);

    // Server mailbox now holds the message
    expect(mockWorker.messages.length).toBe(1);
    const serverMsg = mockWorker.messages[0];
    expect(serverMsg.content).toBe('Hey Bob, sending this while offline!');
    expect(serverMsg.sender_id.toLowerCase()).toBe(aliceAccount.address.toLowerCase());

    // 4. Bob Incremental Pull (/sync) & Delivery ACK
    const bobSyncResult = await bob.syncService.syncOnce();
    expect(bobSyncResult).toBeDefined();
    expect(bobSyncResult?.messages.length).toBe(1);

    // Message saved in Bob's local storage
    const bobReceivedMsg = await bob.msgRepo.getMessage(serverMsg.id);
    expect(bobReceivedMsg?.content).toBe('Hey Bob, sending this while offline!');

    // Bob's conversation unread count incremented
    const bobConv = await bob.convRepo.getConversation(convId);
    expect(bobConv?.unread_count).toBe(1);

    // Worker recorded delivered receipt from Bob's ACK
    expect(mockWorker.receipts.length).toBe(1);
    expect(mockWorker.receipts[0].message_id).toBe(serverMsg.id);
    expect(mockWorker.receipts[0].status).toBe('delivered');

    // 5. Alice pulls delivery receipt
    const aliceReceiptSync = await alice.syncService.syncOnce();
    expect(aliceReceiptSync?.receipts.length).toBe(1);
    const aliceMsgUpdated = await alice.msgRepo.getMessage(serverMsg.id);
    expect(aliceMsgUpdated?.status).toBe('delivered');

    // 6. 30-Second Message Recall by Alice
    await alice.chatEngine.recallMessage(serverMsg.id);

    // Alice's local storage shows recalled
    const aliceRecalledMsg = await alice.msgRepo.getMessage(serverMsg.id);
    expect(aliceRecalledMsg?.status).toBe('recalled');
    expect(aliceRecalledMsg?.content).toBe('Message recalled');

    // Bob runs sync and receives the recall notice
    const bobRecallSync = await bob.syncService.syncOnce();
    expect(bobRecallSync?.recalls.length).toBe(1);

    // Bob's local storage is updated to recalled
    const bobRecalledMsg = await bob.msgRepo.getMessage(serverMsg.id);
    expect(bobRecalledMsg?.status).toBe('recalled');
    expect(bobRecalledMsg?.content).toBe('Message recalled');
  });

  it('Step 6: LuckyDrop Merkle Red Packet: Creation, Chat Delivery, Proof & Claim', async () => {
    const aliceAccount = await createTestUserWallet(alice, "Alice");
    const bobAccount = await createTestUserWallet(bob, "Bob");
    await alice.authService.login(aliceAccount.address);
    await bob.authService.login(bobAccount.address);

    const convId = `dm:${aliceAccount.address.toLowerCase()}:${bobAccount.address.toLowerCase()}`;

    // 1. Alice creates LuckyDrop Merkle Red Packet with 2 recipients
    const packetPrep = await alice.luckyDrop.preparePacket({
      tokenAddress: '0x337610d27c682E347C9cD60BD4b3b107C9d34dDd', // USDT on BSC Testnet
      tokenSymbol: 'USDT',
      totalAmount: '20000000000000000000', // 20 USDT
      recipientCount: 2,
      packetType: PacketType.FIXED,
      wishText: 'Happy Web3 Year! 🧧',
      recipients: [aliceAccount.address, bobAccount.address],
    });

    expect(packetPrep.packet.merkleRoot.startsWith('0x')).toBe(true);
    expect(packetPrep.packet.totalAmount).toBe('20000000000000000000');
    expect(packetPrep.packet.recipientCount).toBe(2);

    // 2. Alice sends red packet card message to the chat
    const sentMsg = await alice.chatEngine.sendMessage(
      convId,
      `[Red Packet] ${packetPrep.payload.wishText}`,
      {
        type: 'packet',
        metadata: packetPrep.payload,
      },
    );
    expect(sentMsg.type).toBe('packet');
    expect(sentMsg.metadata?.packetId).toBe(packetPrep.payload.packetId);

    // 3. Bob pulls the message via sync
    const bobSync = await bob.syncService.syncOnce();
    expect(bobSync?.messages.length).toBe(1);
    const packetMsg = bobSync!.messages[0];
    expect(packetMsg.type).toBe('packet');

    // 4. Bob extracts Merkle proof and verifies locally
    const bobProofInfo = packetPrep.getProofForRecipient(bobAccount.address);
    expect(bobProofInfo).toBeDefined();

    const isProofValid = verifyMerkleProof(
      bobProofInfo!.proof,
      packetPrep.packet.merkleRoot as Hex,
      bobProofInfo!.leaf,
    );
    expect(isProofValid).toBe(true);

    // 5. Bob claims the packet
    const claimResult = await bob.luckyDrop.claimPacket(
      packetPrep.payload.packetId,
      bobProofInfo!.index,
      bobAccount.address,
      bobProofInfo!.proof,
    );
    expect(claimResult.success).toBe(true);
    expect(claimResult.claimedAmount).toBe('10000000000000000000'); // Half of 20 USDT

    // 6. Double claim prevention
    await expect(
      bob.luckyDrop.claimPacket(
        packetPrep.payload.packetId,
        bobProofInfo!.index,
        bobAccount.address,
        bobProofInfo!.proof,
      ),
    ).rejects.toThrow(/already claimed/i);
  });

  it('Step 7: Discover DApp Browser & EIP-1193 Web3 RPC Bridge Integration', async () => {
    const aliceAccount = await createTestUserWallet(alice, "Alice");

    // 1. Verify in-page injection script generation
    const script = createEip1193InpageScript('0x61', aliceAccount.address);
    expect(script).toContain('window.ethereum');
    expect(script).toContain("currentChainId = '0x61'");
    expect(script.toLowerCase()).toContain(aliceAccount.address.toLowerCase());

    // 2. DApp requests accounts: eth_requestAccounts
    const userApprovalMock = vi.fn().mockResolvedValue(true);
    const bridgeCtx: BridgeContext = {
      walletAddress: aliceAccount.address,
      chainId: 97,
      walletCore: alice.walletCore,
      evmService: alice.evm,
      origin: 'https://pancakeswap.finance',
      requestUserApproval: userApprovalMock,
    };

    const reqAccountsRes = await handleEip1193Request(
      { id: 101, method: 'eth_requestAccounts' },
      bridgeCtx,
    );
    expect(reqAccountsRes.result).toEqual([aliceAccount.address]);

    // 3. DApp requests signature: personal_sign (User Approves)
    const signMsg = 'Sign in to PancakeSwap BSC';
    const signMsgHex = `0x${Buffer.from(signMsg, 'utf8').toString('hex')}`;

    const signRes = await handleEip1193Request(
      { id: 102, method: 'personal_sign', params: [signMsgHex, aliceAccount.address] },
      bridgeCtx,
    );

    expect(userApprovalMock).toHaveBeenCalledWith(
      'personal_sign',
      [signMsgHex, aliceAccount.address],
      'https://pancakeswap.finance',
    );
    expect(signRes.result?.startsWith('0x')).toBe(true);
    expect(signRes.result?.length).toBe(132);

    // 4. DApp requests signature: personal_sign (User Rejects)
    const rejectApprovalMock = vi.fn().mockResolvedValue(false);
    const rejectBridgeCtx: BridgeContext = {
      ...bridgeCtx,
      requestUserApproval: rejectApprovalMock,
    };

    const rejectRes = await handleEip1193Request(
      { id: 103, method: 'personal_sign', params: [signMsgHex, aliceAccount.address] },
      rejectBridgeCtx,
    );

    expect(rejectRes.error).toBeDefined();
    expect(rejectRes.error?.code).toBe(4001); // Standard EIP-1193 User Rejected
    expect(rejectRes.error?.message).toContain('User rejected');
  });
});
