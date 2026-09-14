/**
 * Token Red Packet Domain Models
 * Aligned with LuckyDrop smart contracts and SDK (@luckydrop/sdk)
 */

export enum PacketType {
  FIXED = 0,
  RANDOM = 1,
}

export enum PacketState {
  INITIALIZED = 0,
  REFUNDED = 1,
  CANCELLED = 2,
}

export enum PacketStatus {
  ACTIVE = 0,
  COMPLETED = 1,
  EXPIRED = 2,
  REFUNDED = 3,
  CANCELLED = 4,
}

export interface LuckyDropPacket {
  packetId: string;
  tokenAddress: string;
  tokenSymbol: string;
  tokenDecimals: number;
  totalAmount: string; // BigInt formatted string (wei/atomic units)
  remainingAmount: string;
  recipientCount: number;
  claimedCount: number;
  expireAt: number;
  creator: string;
  packetType: PacketType;
  packetState: PacketState;
  merkleRoot: string;
  wishText?: string;
  chainId: number;
  txHash?: string;
}

export interface PacketClaimRecord {
  packetId: string;
  recipientAddress: string;
  index: number;
  amount: string;
  claimedAt: number;
  txHash?: string;
}

export interface PacketMessagePayload {
  packetId: string;
  wishText: string;
  tokenSymbol: string;
  totalAmount: string;
  recipientCount: number;
  packetType: PacketType;
  chainId: number;
}
