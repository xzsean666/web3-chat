/**
 * Contact and Social Domain Models
 * Aligned with web3-chat-contract (@web3-chat/sdk / ChatStorageFactory.sol)
 */

export enum UserStatus {
  ACTIVE = 0,
  DISABLED = 1,
}

export enum FriendStatus {
  NONE = 0,
  PENDING_IN = 1,
  PENDING_OUT = 2,
  FRIEND = 3,
  BLOCKED = 4,
}

export enum GroupStatus {
  ACTIVE = 0,
  PAUSED = 1,
  CLOSED = 2,
}

export enum JoinMode {
  PUBLIC = 0,
  INVITE_ONLY = 1,
  ADMIN_ONLY = 2,
  CLOSED = 3,
}

export enum MemberStatus {
  NONE = 0,
  MEMBER = 1,
  BANNED = 2,
}

export enum Role {
  MEMBER = 0,
  MODERATOR = 1,
  ADMIN = 2,
  OWNER = 3,
}

export interface Contact {
  address: string;
  alias?: string | null;
  ensName?: string | null;
  avatarUrl?: string | null;
  status: FriendStatus;
  friendSince?: number | null;
  mutedUntil?: number | null;
  metadata?: Record<string, any> | null;
}

export interface Group {
  id: string;
  address: string;
  name: string;
  description?: string | null;
  avatarUrl?: string | null;
  owner: string;
  pendingOwner?: string | null;
  status: GroupStatus;
  joinMode: JoinMode;
  memberCount: number;
  maxMembers: number;
  metadata?: Record<string, any> | null;
}

export interface GroupMember {
  address: string;
  groupId: string;
  role: Role;
  status: MemberStatus;
  joinedAt: number;
  muteUntil: number;
  banUntil: number;
  metadata?: Record<string, any> | null;
}
