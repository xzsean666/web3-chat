import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { SocialContractService } from '../../src/features/contacts/SocialContractService';
import { ContactsScreen } from '../../src/features/contacts/screens/ContactsScreen';
import { AddFriendScreen } from '../../src/features/contacts/screens/AddFriendScreen';
import { StorageEngine } from '../../src/services/storage/StorageEngine';
import { EvmService } from '../../src/services/evm/EvmService';
import { FriendStatus } from '../../src/types/contact';
import type { Contact } from '../../src/types';

describe('Contacts Service & Screen (TASK-010)', () => {
  let storage: StorageEngine;
  let evm: EvmService;
  let service: SocialContractService;

  beforeEach(() => {
    storage = new StorageEngine();
    evm = new EvmService();
    service = new SocialContractService(evm, storage);
  });

  describe('SocialContractService Management', () => {
    it('should fetch and cache contacts', async () => {
      const contacts = await service.fetchContacts('0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266');
      expect(contacts.length).toBeGreaterThan(0);
      expect(contacts[0].status).toBe(FriendStatus.FRIEND);

      const cached = await service.getCachedContacts();
      expect(cached.length).toBe(contacts.length);
    });

    it('should fetch and cache groups', async () => {
      const groups = await service.fetchGroups('0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266');
      expect(groups.length).toBeGreaterThan(0);
      expect(groups[0].name).toBe('BSC Web3 Builders');

      const cached = await service.getCachedGroups();
      expect(cached.length).toBe(groups.length);
    });

    it('should handle friend request and acceptance flow', async () => {
      const targetAddr = '0x1111111111111111111111111111111111111111';
      const requested = await service.sendFriendRequest(targetAddr, 'Charlie');
      expect(requested.status).toBe(FriendStatus.PENDING_OUT);
      expect(requested.alias).toBe('Charlie');

      const accepted = await service.acceptFriendRequest(targetAddr);
      expect(accepted.status).toBe(FriendStatus.FRIEND);

      const all = await service.getCachedContacts();
      const found = all.find((c) => c.address === targetAddr.toLowerCase());
      expect(found?.status).toBe(FriendStatus.FRIEND);
    });

    it('should group contacts into alphabetical sections correctly', () => {
      const testContacts: Contact[] = [
        {
          address: '0x1',
          alias: 'Alice',
          status: FriendStatus.FRIEND,
        },
        {
          address: '0x2',
          alias: 'Bob',
          status: FriendStatus.FRIEND,
        },
        {
          address: '0x3',
          alias: '123 Trader',
          status: FriendStatus.FRIEND,
        },
      ];

      const sections = SocialContractService.groupContactsAlphabetical(testContacts);
      expect(sections.length).toBe(3);
      expect(sections[0].title).toBe('A');
      expect(sections[0].data[0].alias).toBe('Alice');
      expect(sections[1].title).toBe('B');
      expect(sections[1].data[0].alias).toBe('Bob');
      expect(sections[2].title).toBe('#');
      expect(sections[2].data[0].alias).toBe('123 Trader');
    });
  });

  describe('UI Component Sanity', () => {
    it('should create valid ReactElement with ContactsScreen', () => {
      const element = React.createElement(ContactsScreen, {
        contacts: [],
        onSelectContact: vi.fn(),
      });
      expect(React.isValidElement(element)).toBe(true);
      expect(element.type).toBe(ContactsScreen);
    });

    it('should create valid ReactElement with AddFriendScreen', () => {
      const element = React.createElement(AddFriendScreen, {
        onBack: vi.fn(),
        onAddFriend: vi.fn(),
      });
      expect(React.isValidElement(element)).toBe(true);
      expect(element.type).toBe(AddFriendScreen);
    });
  });
});
