import { describe, it, expect } from 'vitest';
import {
  getDirectConversationId,
  parseConversationId,
  isDirectConversationId,
  type ChatMessage,
  type Conversation,
  FriendStatus,
  UserStatus,
  GroupStatus,
  JoinMode,
  Role,
  PacketType,
  PacketState,
  PacketStatus,
  type LuckyDropPacket,
  type ChainConfig,
  type WalletAccount,
} from '../../src/types';

describe('Common Domain Types & Data Models (TASK-002)', () => {
  describe('Direct Conversation ID Generation', () => {
    it('should generate canonical ID with lower address first regardless of argument order', () => {
      const addrA = '0x1111111111111111111111111111111111111111';
      const addrB = '0x2222222222222222222222222222222222222222';

      const id1 = getDirectConversationId(addrA, addrB);
      const id2 = getDirectConversationId(addrB, addrA);

      expect(id1).toBe(`dm:${addrA.toLowerCase()}:${addrB.toLowerCase()}`);
      expect(id2).toBe(id1);
    });

    it('should normalize uppercase addresses', () => {
      const addrUpper = '0xAbCdEf1234567890123456789012345678901234';
      const addrLower = '0xabcdef1234567890123456789012345678901234';
      const other = '0x9999999999999999999999999999999999999999';

      const idUpper = getDirectConversationId(addrUpper, other);
      const idLower = getDirectConversationId(addrLower, other);

      expect(idUpper).toBe(idLower);
    });
  });

  describe('Conversation ID Parsing', () => {
    it('should parse direct conversation ID', () => {
      const addrA = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
      const addrB = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
      const convId = `dm:${addrA}:${addrB}`;

      expect(isDirectConversationId(convId)).toBe(true);
      const parsed = parseConversationId(convId);
      expect(parsed.type).toBe('dm');
      expect(parsed.participants).toEqual([addrA, addrB]);
    });

    it('should parse group conversation ID', () => {
      const convId = 'group:101';

      expect(isDirectConversationId(convId)).toBe(false);
      const parsed = parseConversationId(convId);
      expect(parsed.type).toBe('group');
      expect(parsed.groupId).toBe('101');
    });
  });

  describe('Model Factory Sanity', () => {
    it('should construct valid ChatMessage object', () => {
      const msg: ChatMessage = {
        id: 'msg-1',
        conversation_id: 'dm:0x1:0x2',
        sender_id: '0x1',
        type: 'text',
        content: 'Hello Web3',
        retention: 'permanent',
        status: 'sent',
        expires_at: 0,
        delivered_at: 1700000000,
        read_at: null,
        created_at: 1700000000,
      };

      expect(msg.type).toBe('text');
      expect(msg.status).toBe('sent');
      expect(msg.content).toBe('Hello Web3');
    });

    it('should construct valid Conversation object', () => {
      const conv: Conversation = {
        id: 'dm:0x1:0x2',
        type: 'dm',
        title: 'Alice',
        unread_count: 2,
        updated_at: 1700000000,
        peer_address: '0x2',
      };

      expect(conv.type).toBe('dm');
      expect(conv.unread_count).toBe(2);
    });

    it('should verify contact and role enums', () => {
      expect(FriendStatus.FRIEND).toBe(3);
      expect(FriendStatus.BLOCKED).toBe(4);
      expect(UserStatus.ACTIVE).toBe(0);
      expect(GroupStatus.ACTIVE).toBe(0);
      expect(JoinMode.PUBLIC).toBe(0);
      expect(Role.OWNER).toBe(3);
      expect(Role.ADMIN).toBe(2);
    });

    it('should verify LuckyDrop packet model and enums', () => {
      expect(PacketType.FIXED).toBe(0);
      expect(PacketType.RANDOM).toBe(1);
      expect(PacketStatus.ACTIVE).toBe(0);
      expect(PacketStatus.COMPLETED).toBe(1);

      const packet: LuckyDropPacket = {
        packetId: 'packet-100',
        tokenAddress: '0x55d398326f99059ff775485246999027b3197955',
        tokenSymbol: 'USDT',
        tokenDecimals: 18,
        totalAmount: '100000000000000000000',
        remainingAmount: '50000000000000000000',
        recipientCount: 10,
        claimedCount: 5,
        expireAt: 1700086400,
        creator: '0x1111111111111111111111111111111111111111',
        packetType: PacketType.RANDOM,
        packetState: PacketState.INITIALIZED,
        merkleRoot: '0x1234',
        chainId: 97,
      };

      expect(packet.tokenSymbol).toBe('USDT');
      expect(packet.recipientCount).toBe(10);
      expect(packet.packetType).toBe(PacketType.RANDOM);
    });

    it('should construct valid ChainConfig object', () => {
      const bscTestnet: ChainConfig = {
        chainId: 97,
        name: 'BNB Smart Chain Testnet',
        network: 'bsc-testnet',
        nativeCurrency: {
          name: 'Test BNB',
          symbol: 'tBNB',
          decimals: 18,
        },
        rpcUrls: ['https://data-seed-prebsc-1-s1.binance.org:8545'],
        blockExplorerUrls: ['https://testnet.bscscan.com'],
        contracts: {
          factory: '0x1234567890123456789012345678901234567890',
          luckyDrop: '0x2345678901234567890123456789012345678901',
          multicall3: '0xca11bde05977b3631167028862be2a173976ca11',
        },
      };

      expect(bscTestnet.chainId).toBe(97);
      expect(bscTestnet.nativeCurrency.symbol).toBe('tBNB');
      expect(bscTestnet.contracts.multicall3).toBe('0xca11bde05977b3631167028862be2a173976ca11');
    });
  });
});
