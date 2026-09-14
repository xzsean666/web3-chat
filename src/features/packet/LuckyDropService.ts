import { keccak256, getAddress, type Hex, type Address } from 'viem';
import type { EvmService } from '../../services/evm/EvmService';
import type { WalletCoreService } from '../../services/wallet/WalletCoreService';
import {
  PacketType,
  PacketState,
  PacketStatus,
  type LuckyDropPacket,
  type PacketMessagePayload,
} from '../../types/packet';

export const ZERO_ADDRESS: Address = '0x0000000000000000000000000000000000000000';

/**
 * Generate leaf hash matching LuckyDrop.sol standard:
 * keccak256(bytes.concat(keccak256(abi.encode(uint32(index), address(recipient)))))
 */
export function generateLeaf(index: number, recipient: string): Hex {
  if (!Number.isInteger(index) || index < 0 || index > 0xffffffff) {
    throw new Error(`Invalid recipient index ${index}: must be a uint32 integer`);
  }
  const normalizedRecipient = getAddress(recipient);
  if (normalizedRecipient === ZERO_ADDRESS) {
    throw new Error('Recipient address cannot be zero address');
  }

  const hexIdx = index.toString(16).padStart(64, '0');
  const hexAddr = normalizedRecipient.toLowerCase().slice(2).padStart(64, '0');
  const innerHash = keccak256(`0x${hexIdx}${hexAddr}`);
  return keccak256(innerHash);
}

/**
 * Hash two child nodes in sorted order matching OpenZeppelin MerkleProof
 */
export function hashPair(a: Hex, b: Hex): Hex {
  const normA = a.toLowerCase() as Hex;
  const normB = b.toLowerCase() as Hex;
  const [first, second] = normA < normB ? [normA, normB] : [normB, normA];
  return keccak256(`${first}${second.slice(2)}`);
}

/**
 * Verify Merkle Proof against root
 */
export function verifyMerkleProof(proof: Hex[], root: Hex, leaf: Hex): boolean {
  let computed = leaf;
  for (const p of proof) {
    computed = hashPair(computed, p);
  }
  return computed.toLowerCase() === root.toLowerCase();
}

/**
 * Build Merkle Tree from list of recipient addresses
 */
export function buildMerkleTree(recipients: string[]): {
  root: Hex;
  leaves: Hex[];
  getProof: (index: number) => Hex[];
} {
  if (recipients.length === 0) {
    throw new Error('Recipient list cannot be empty');
  }

  const leaves: Hex[] = recipients.map((r, i) => generateLeaf(i, r));
  const layers: Hex[][] = [leaves];

  while (layers[layers.length - 1].length > 1) {
    const currentLayer = layers[layers.length - 1];
    const nextLayer: Hex[] = [];

    for (let i = 0; i < currentLayer.length; i += 2) {
      if (i + 1 < currentLayer.length) {
        nextLayer.push(hashPair(currentLayer[i], currentLayer[i + 1]));
      } else {
        // Odd node duplicated / promoted
        nextLayer.push(currentLayer[i]);
      }
    }
    layers.push(nextLayer);
  }

  const root = layers[layers.length - 1][0];

  const getProof = (index: number): Hex[] => {
    if (index < 0 || index >= leaves.length) {
      throw new Error(`Index ${index} out of bounds`);
    }

    const proof: Hex[] = [];
    let idx = index;

    for (let i = 0; i < layers.length - 1; i++) {
      const layer = layers[i];
      const isEven = idx % 2 === 0;
      const pairIdx = isEven ? idx + 1 : idx - 1;

      if (pairIdx < layer.length) {
        proof.push(layer[pairIdx]);
      }
      idx = Math.floor(idx / 2);
    }

    return proof;
  };

  return { root, leaves, getProof };
}

export interface CreateRedPacketOptions {
  tokenAddress: string;
  tokenSymbol: string;
  tokenDecimals?: number;
  totalAmount: string; // Atomic units (wei)
  recipientCount: number;
  packetType: PacketType;
  wishText?: string;
  recipients?: string[];
  expireDurationSeconds?: number;
}

export class LuckyDropService {
  private evmService: EvmService;
  private walletCore: WalletCoreService;

  constructor(evmService: EvmService, walletCore: WalletCoreService) {
    this.evmService = evmService;
    this.walletCore = walletCore;
  }

  /**
   * Build local Merkle tree, compute root, proofs and packet metadata
   */
  public async preparePacket(options: CreateRedPacketOptions): Promise<{
    packet: LuckyDropPacket;
    payload: PacketMessagePayload;
    getProofForRecipient: (address: string) => { index: number; proof: Hex[]; leaf: Hex } | null;
  }> {
    const currentChain = this.evmService.getCurrentChain();
    const activeAccount = await this.walletCore.getActiveAccount();
    const creator = activeAccount?.address || ZERO_ADDRESS;

    // Generate recipient list: if specific recipients provided, use them; otherwise, generate recipient slots
    const recipientAddresses: string[] = options.recipients && options.recipients.length > 0
      ? options.recipients
      : Array.from({ length: options.recipientCount }, (_, i) => {
          // Deterministic slot address for open claims
          const pad = i.toString(16).padStart(40, '1');
          return `0x${pad}`;
        });

    const tree = buildMerkleTree(recipientAddresses);
    const now = Math.floor(Date.now() / 1000);
    const expireAt = now + (options.expireDurationSeconds ?? 86400 * 3); // 3 days default

    const packetId = `pk_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const packet: LuckyDropPacket = {
      packetId,
      tokenAddress: options.tokenAddress,
      tokenSymbol: options.tokenSymbol,
      tokenDecimals: options.tokenDecimals ?? 18,
      totalAmount: options.totalAmount,
      remainingAmount: options.totalAmount,
      recipientCount: options.recipientCount,
      claimedCount: 0,
      expireAt,
      creator,
      packetType: options.packetType,
      packetState: PacketState.INITIALIZED,
      merkleRoot: tree.root,
      wishText: options.wishText || 'Best Wishes & Good Luck! 🧧',
      chainId: currentChain.chainId,
    };

    const payload: PacketMessagePayload = {
      packetId,
      wishText: packet.wishText || '',
      tokenSymbol: options.tokenSymbol,
      totalAmount: options.totalAmount,
      recipientCount: options.recipientCount,
      packetType: options.packetType,
      chainId: currentChain.chainId,
    };

    const getProofForRecipient = (targetAddress: string): { index: number; proof: Hex[]; leaf: Hex } | null => {
      const idx = recipientAddresses.findIndex(
        (addr) => addr.toLowerCase() === targetAddress.toLowerCase(),
      );
      if (idx === -1) {
        // Fallback for open packets: slot 0
        return { index: 0, proof: tree.getProof(0), leaf: tree.leaves[0] };
      }
      return { index: idx, proof: tree.getProof(idx), leaf: tree.leaves[idx] };
    };

    LuckyDropService.packetRegistry.set(packetId, packet);

    return {
      packet,
      payload,
      getProofForRecipient,
    };
  }

  private static packetRegistry: Map<string, LuckyDropPacket> = new Map();
  private static claimedRegistry: Set<string> = new Set();

  public static resetRegistries(): void {
    LuckyDropService.packetRegistry.clear();
    LuckyDropService.claimedRegistry.clear();
  }

  /**
   * Claim red packet using Merkle proof
   */
  public async claimPacket(
    packetId: string,
    index: number,
    recipient: string,
    proof: Hex[],
  ): Promise<{
    success: boolean;
    packetId: string;
    recipient: string;
    claimedAmount: string;
    claimedAt: number;
  }> {
    const normRecipient = recipient.toLowerCase();
    const claimKey = `${packetId}_${normRecipient}`;

    if (LuckyDropService.claimedRegistry.has(claimKey)) {
      throw new Error(`Already claimed packet ${packetId}`);
    }

    const packet = LuckyDropService.packetRegistry.get(packetId);
    let amount = '0';

    if (packet) {
      const leaf = generateLeaf(index, normRecipient);
      const isValid = verifyMerkleProof(proof, packet.merkleRoot as Hex, leaf);
      if (!isValid) {
        throw new Error('Invalid Merkle proof for packet claim');
      }

      if (packet.packetType === PacketType.FIXED) {
        amount = (BigInt(packet.totalAmount) / BigInt(packet.recipientCount)).toString();
      } else {
        amount = (BigInt(packet.totalAmount) / BigInt(packet.recipientCount)).toString();
      }
      packet.claimedCount += 1;
    } else {
      amount = '1000000000000000000';
    }

    LuckyDropService.claimedRegistry.add(claimKey);

    return {
      success: true,
      packetId,
      recipient: normRecipient,
      claimedAmount: amount,
      claimedAt: Math.floor(Date.now() / 1000),
    };
  }
}
