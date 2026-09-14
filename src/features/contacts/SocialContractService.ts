import type { EvmService } from '../../services/evm/EvmService';
import type { StorageEngine } from '../../services/storage/StorageEngine';
import type { Contact, Group } from '../../types';
import { FriendStatus, GroupStatus, JoinMode } from '../../types/contact';

export class SocialContractService {
  private evmService: EvmService;
  private storage: StorageEngine;
  private readonly CONTACTS_CACHE_KEY = 'contacts_cache_list';
  private readonly GROUPS_CACHE_KEY = 'groups_cache_list';

  constructor(evmService: EvmService, storage: StorageEngine) {
    this.evmService = evmService;
    this.storage = storage;
  }

  /**
   * Get cached contacts list
   */
  async getCachedContacts(): Promise<Contact[]> {
    const list = await this.storage.get<Contact[]>(this.CONTACTS_CACHE_KEY);
    return list || [];
  }

  /**
   * Save contacts to local cache
   */
  async saveCachedContacts(contacts: Contact[]): Promise<void> {
    await this.storage.set(this.CONTACTS_CACHE_KEY, contacts);
  }

  /**
   * Get cached groups list
   */
  async getCachedGroups(): Promise<Group[]> {
    const list = await this.storage.get<Group[]>(this.GROUPS_CACHE_KEY);
    return list || [];
  }

  /**
   * Save groups to local cache
   */
  async saveCachedGroups(groups: Group[]): Promise<void> {
    await this.storage.set(this.GROUPS_CACHE_KEY, groups);
  }

  /**
   * Fetch contacts from on-chain / service with fallback to local cache
   */
  async fetchContacts(walletAddress: string): Promise<Contact[]> {
    try {
      // In production, queries ChatStorageFactory / RelationshipManager via evm-call
      // For now, retrieve from cache or return cached items
      const cached = await this.getCachedContacts();
      if (cached.length > 0) {
        return cached;
      }

      // Default seed contacts for initial experience
      const defaultContacts: Contact[] = [
        {
          address: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8'.toLowerCase(),
          alias: 'Alice (Web3 Dev)',
          ensName: 'alice.eth',
          status: FriendStatus.FRIEND,
          friendSince: Math.floor(Date.now() / 1000) - 86400 * 30,
        },
        {
          address: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC'.toLowerCase(),
          alias: 'Bob (Smart Contract)',
          ensName: 'bob.eth',
          status: FriendStatus.FRIEND,
          friendSince: Math.floor(Date.now() / 1000) - 86400 * 14,
        },
      ];

      await this.saveCachedContacts(defaultContacts);
      return defaultContacts;
    } catch {
      return this.getCachedContacts();
    }
  }

  /**
   * Fetch joined groups
   */
  async fetchGroups(walletAddress: string): Promise<Group[]> {
    try {
      const cached = await this.getCachedGroups();
      if (cached.length > 0) {
        return cached;
      }

      const defaultGroups: Group[] = [
        {
          id: '1',
          address: '0xe7f1725e7734ce288f8367e1bb143e90bb3f0512',
          name: 'BSC Web3 Builders',
          description: 'Official community of BSC Web3 Chat and LuckyDrop builders',
          owner: '0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266',
          status: GroupStatus.ACTIVE,
          joinMode: JoinMode.PUBLIC,
          memberCount: 42,
          maxMembers: 500,
        },
      ];

      await this.saveCachedGroups(defaultGroups);
      return defaultGroups;
    } catch {
      return this.getCachedGroups();
    }
  }

  /**
   * Send a friend request to a target address
   */
  async sendFriendRequest(targetAddress: string, alias?: string): Promise<Contact> {
    const normalized = targetAddress.toLowerCase();
    const contacts = await this.getCachedContacts();

    const existingIndex = contacts.findIndex((c) => c.address.toLowerCase() === normalized);
    const newContact: Contact = {
      address: normalized,
      alias: alias || `${normalized.slice(0, 6)}...${normalized.slice(-4)}`,
      status: FriendStatus.PENDING_OUT,
      friendSince: Math.floor(Date.now() / 1000),
    };

    if (existingIndex >= 0) {
      contacts[existingIndex] = newContact;
    } else {
      contacts.push(newContact);
    }

    await this.saveCachedContacts(contacts);
    return newContact;
  }

  /**
   * Accept an incoming friend request
   */
  async acceptFriendRequest(requesterAddress: string): Promise<Contact> {
    const normalized = requesterAddress.toLowerCase();
    const contacts = await this.getCachedContacts();

    let target = contacts.find((c) => c.address.toLowerCase() === normalized);
    if (!target) {
      target = {
        address: normalized,
        alias: `${normalized.slice(0, 6)}...${normalized.slice(-4)}`,
        status: FriendStatus.FRIEND,
        friendSince: Math.floor(Date.now() / 1000),
      };
      contacts.push(target);
    } else {
      target.status = FriendStatus.FRIEND;
      target.friendSince = Math.floor(Date.now() / 1000);
    }

    await this.saveCachedContacts(contacts);
    return target;
  }

  /**
   * Group and sort contacts into alphabetical sections (A-Z, #)
   */
  static groupContactsAlphabetical(contacts: Contact[]): Array<{ title: string; data: Contact[] }> {
    const activeFriends = contacts.filter((c) => c.status === FriendStatus.FRIEND);
    const groupsMap = new Map<string, Contact[]>();

    activeFriends.forEach((contact) => {
      const name = (contact.alias || contact.ensName || contact.address).trim();
      const firstChar = name.charAt(0).toUpperCase();
      const letter = /^[A-Z]$/.test(firstChar) ? firstChar : '#';

      if (!groupsMap.has(letter)) {
        groupsMap.set(letter, []);
      }
      groupsMap.get(letter)!.push(contact);
    });

    const sortedLetters = Array.from(groupsMap.keys()).sort((a, b) => {
      if (a === '#') return 1;
      if (b === '#') return -1;
      return a.localeCompare(b);
    });

    return sortedLetters.map((letter) => ({
      title: letter,
      data: groupsMap.get(letter)!.sort((a, b) => {
        const nameA = a.alias || a.address;
        const nameB = b.alias || b.address;
        return nameA.localeCompare(nameB);
      }),
    }));
  }
}
