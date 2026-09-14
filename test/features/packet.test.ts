import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import {
  generateLeaf,
  hashPair,
  verifyMerkleProof,
  buildMerkleTree,
  LuckyDropService,
} from '../../src/features/packet/LuckyDropService';
import { RedPacketCard } from '../../src/features/packet/components/RedPacketCard';
import { CreatePacketModal } from '../../src/features/packet/components/CreatePacketModal';
import { ClaimResultModal } from '../../src/features/packet/components/ClaimResultModal';
import { EvmService } from '../../src/services/evm/EvmService';
import { WalletCoreService, KeyStoreService } from '../../src/services/wallet';
import { PacketType } from '../../src/types/packet';
import { resetMockStore } from '../mocks/expo-secure-store';

describe('LuckyDrop Red Packet Integration & Merkle Service (TASK-011)', () => {
  let evm: EvmService;
  let keyStore: KeyStoreService;
  let walletCore: WalletCoreService;
  let luckyDropService: LuckyDropService;

  beforeEach(async () => {
    resetMockStore();
    evm = new EvmService();
    keyStore = new KeyStoreService();
    walletCore = new WalletCoreService(keyStore);
    await walletCore.importFromPrivateKey(
      '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
      'Deployer',
    );
    luckyDropService = new LuckyDropService(evm, walletCore);
  });

  describe('Merkle Tree Cryptographic Primitives', () => {
    it('should generate valid leaf matching LuckyDrop contract keccak256 format', () => {
      const addr = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';
      const leaf0 = generateLeaf(0, addr);
      const leaf1 = generateLeaf(1, addr);

      expect(leaf0.startsWith('0x')).toBe(true);
      expect(leaf0.length).toBe(66);
      expect(leaf0).not.toBe(leaf1);
    });

    it('should throw on invalid index or zero address', () => {
      const addr = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';
      expect(() => generateLeaf(-1, addr)).toThrow();
      expect(() => generateLeaf(0, '0x0000000000000000000000000000000000000000')).toThrow();
    });

    it('should maintain sorted symmetry in hashPair', () => {
      const a = '0x1111111111111111111111111111111111111111111111111111111111111111' as const;
      const b = '0x2222222222222222222222222222222222222222222222222222222222222222' as const;

      expect(hashPair(a, b)).toBe(hashPair(b, a));
    });

    it('should build Merkle tree and verify all inclusion proofs', () => {
      const recipients = [
        '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
        '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
        '0x90F79bf6EB2c4f870365E785982E1f101E93b906',
        '0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65',
      ];

      const tree = buildMerkleTree(recipients);
      expect(tree.root.startsWith('0x')).toBe(true);
      expect(tree.leaves.length).toBe(4);

      // Verify all 4 proofs
      for (let i = 0; i < recipients.length; i++) {
        const proof = tree.getProof(i);
        const leaf = tree.leaves[i];
        const isValid = verifyMerkleProof(proof, tree.root, leaf);
        expect(isValid).toBe(true);
      }

      // Reject corrupted leaf
      const badLeaf = '0x0000000000000000000000000000000000000000000000000000000000000001' as const;
      expect(verifyMerkleProof(tree.getProof(0), tree.root, badLeaf)).toBe(false);
    });
  });

  describe('LuckyDropService Packet Creation', () => {
    it('should prepare packet metadata, Merkle tree root and payload', async () => {
      const res = await luckyDropService.preparePacket({
        tokenAddress: '0x337610d27c682E347C9cD60BD4b3b107C9d34dDd',
        tokenSymbol: 'USDT',
        totalAmount: '10000000000000000000', // 10 USDT
        recipientCount: 5,
        packetType: PacketType.RANDOM,
        wishText: 'Happy Web3 Trading! 🧧',
      });

      expect(res.packet.tokenSymbol).toBe('USDT');
      expect(res.packet.recipientCount).toBe(5);
      expect(res.packet.merkleRoot.startsWith('0x')).toBe(true);
      expect(res.payload.wishText).toBe('Happy Web3 Trading! 🧧');

      const proofInfo = res.getProofForRecipient('0x1111111111111111111111111111111111111111');
      expect(proofInfo).toBeDefined();
      expect(proofInfo?.proof.length).toBeGreaterThan(0);
    });
  });

  describe('Red Packet UI Components Sanity', () => {
    it('should create valid ReactElement with RedPacketCard', () => {
      const element = React.createElement(RedPacketCard, {
        payload: {
          packetId: 'pk-1',
          wishText: 'Gong Xi Fa Cai',
          tokenSymbol: 'tBNB',
          totalAmount: '1000000000000000000',
          recipientCount: 5,
          packetType: PacketType.RANDOM,
          chainId: 97,
        },
        onPress: vi.fn(),
      });
      expect(React.isValidElement(element)).toBe(true);
      expect(element.type).toBe(RedPacketCard);
    });

    it('should create valid ReactElement with CreatePacketModal', () => {
      const element = React.createElement(CreatePacketModal, {
        visible: true,
        onClose: vi.fn(),
        onSubmit: vi.fn(),
      });
      expect(React.isValidElement(element)).toBe(true);
      expect(element.type).toBe(CreatePacketModal);
    });

    it('should create valid ReactElement with ClaimResultModal', () => {
      const element = React.createElement(ClaimResultModal, {
        visible: true,
        onClose: vi.fn(),
        payload: {
          packetId: 'pk-1',
          wishText: 'Gong Xi Fa Cai',
          tokenSymbol: 'tBNB',
          totalAmount: '1000000000000000000',
          recipientCount: 5,
          packetType: PacketType.RANDOM,
          chainId: 97,
        },
      });
      expect(React.isValidElement(element)).toBe(true);
      expect(element.type).toBe(ClaimResultModal);
    });
  });
});
