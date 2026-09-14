import React, { useState } from 'react';
import {
  View,
  Text,
  SectionList,
  TouchableOpacity,
  TextInput,
  StyleSheet,
} from 'react-native';
import { colors } from '../../../theme/colors';
import { Icon } from '../../../components/common/Icon';
import { radii, shadows } from '../../../theme/design';
import { SocialContractService } from '../SocialContractService';
import type { Contact, Group } from '../../../types';

export interface ContactsScreenProps {
  contacts: Contact[];
  groups?: Group[];
  onSelectContact: (contact: Contact) => void;
  onOpenNewFriends?: () => void;
  onOpenGroupChats?: () => void;
}

export const ContactsScreen: React.FC<ContactsScreenProps> = ({
  contacts,
  groups = [],
  onSelectContact,
  onOpenNewFriends,
  onOpenGroupChats,
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredContacts = contacts.filter((c) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    const alias = (c.alias || '').toLowerCase();
    const ens = (c.ensName || '').toLowerCase();
    const addr = c.address.toLowerCase();
    return alias.includes(query) || ens.includes(query) || addr.includes(query);
  });

  const sections = SocialContractService.groupContactsAlphabetical(filteredContacts);

  const renderHeader = () => (
    <View>
      <View style={styles.searchBarContainer}>
        <View style={styles.searchInputWrapper}>
          <Icon name="search" size={16} color="#94A3B8" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search friends, ENS, or 0x address"
            placeholderTextColor="#94A3B8"
            value={searchQuery}
            onChangeText={setSearchQuery}
            testID="contacts-search-input"
          />
        </View>
      </View>

      <View style={styles.quickEntryRow}>
        <TouchableOpacity
          style={styles.quickEntryItem}
          onPress={onOpenNewFriends}
          testID="btn-new-friends"
          activeOpacity={0.7}
        >
          <View style={[styles.quickEntryIcon, { backgroundColor: '#FA9D3B' }]}>
            <Icon name="user-plus" size={22} color="#FFFFFF" strokeWidth={2.3} />
          </View>
          <Text style={styles.quickEntryLabel}>New Friends</Text>
          <Icon name="chevron-right" size={16} color="#CBD5E1" style={styles.chevron} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.quickEntryItem}
          onPress={onOpenGroupChats}
          testID="btn-group-chats"
          activeOpacity={0.7}
        >
          <View style={[styles.quickEntryIcon, { backgroundColor: '#07C160' }]}>
            <Icon name="contacts" size={22} color="#FFFFFF" strokeWidth={2.3} />
          </View>
          <Text style={styles.quickEntryLabel}>Group Chats ({groups.length})</Text>
          <Icon name="chevron-right" size={16} color="#CBD5E1" style={styles.chevron} />
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.container} testID="contacts-screen">
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.address}
        ListHeaderComponent={renderHeader}
        style={styles.list}
        contentContainerStyle={styles.listContent}
        renderSectionHeader={({ section: { title } }) => (
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionHeaderText}>{title}</Text>
          </View>
        )}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.contactItem}
            onPress={() => onSelectContact(item)}
            testID={`contact-item-${item.address}`}
            activeOpacity={0.7}
          >
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {(item.alias || item.address).slice(0, 1).toUpperCase()}
              </Text>
            </View>
            <View style={styles.contactInfo}>
              <Text style={styles.contactName} numberOfLines={1}>
                {item.alias || item.ensName || `${item.address.slice(0, 6)}...${item.address.slice(-4)}`}
              </Text>
              {item.ensName && (
                <Text style={styles.contactSubText}>{item.ensName}</Text>
              )}
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.emptyContainer} testID="contacts-empty">
            <Text style={styles.emptyText}>No contacts found</Text>
          </View>
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  list: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  listContent: {
    flexGrow: 1,
    backgroundColor: '#FFFFFF',
  },
  searchBarContainer: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
  },
  searchInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: radii.md,
    paddingHorizontal: 12,
    height: 38,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#0F172A',
    height: '100%',
  },
  quickEntryRow: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0, 0, 0, 0.06)',
  },
  quickEntryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0, 0, 0, 0.05)',
  },
  quickEntryIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
    ...shadows.subtle,
  },
  quickEntryLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#0F172A',
    flex: 1,
  },
  chevron: {
    marginLeft: 8,
  },
  sectionHeader: {
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 16,
    paddingVertical: 5,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(0, 0, 0, 0.04)',
  },
  sectionHeaderText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 11,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0, 0, 0, 0.05)',
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#E0F2FE',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  avatarText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0284C7',
  },
  contactInfo: {
    flex: 1,
  },
  contactName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#0F172A',
    letterSpacing: -0.2,
  },
  contactSubText: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
  },
  emptyContainer: {
    paddingTop: 60,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#64748B',
  },
});
