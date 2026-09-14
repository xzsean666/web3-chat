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
        <TextInput
          style={styles.searchInput}
          placeholder="Search friends, ENS, or 0x address"
          placeholderTextColor={colors.textTertiary}
          value={searchQuery}
          onChangeText={setSearchQuery}
          testID="contacts-search-input"
        />
      </View>

      <View style={styles.quickEntryRow}>
        <TouchableOpacity
          style={styles.quickEntryItem}
          onPress={onOpenNewFriends}
          testID="btn-new-friends"
        >
          <View style={[styles.quickEntryIcon, { backgroundColor: '#FA9D3B' }]}>
            <Text style={styles.quickEntryEmoji}>👋</Text>
          </View>
          <Text style={styles.quickEntryLabel}>New Friends</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.quickEntryItem}
          onPress={onOpenGroupChats}
          testID="btn-group-chats"
        >
          <View style={[styles.quickEntryIcon, { backgroundColor: '#07C160' }]}>
            <Text style={styles.quickEntryEmoji}>👥</Text>
          </View>
          <Text style={styles.quickEntryLabel}>Group Chats ({groups.length})</Text>
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
    backgroundColor: colors.surface,
  },
  searchBarContainer: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: colors.backgroundLight,
  },
  searchInput: {
    backgroundColor: colors.surface,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 14,
    color: colors.textPrimary,
  },
  quickEntryRow: {
    backgroundColor: colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderLight,
  },
  quickEntryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderLight,
  },
  quickEntryIcon: {
    width: 40,
    height: 40,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  quickEntryEmoji: {
    fontSize: 20,
  },
  quickEntryLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.textPrimary,
  },
  sectionHeader: {
    backgroundColor: colors.background,
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  sectionHeaderText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderLight,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 6,
    backgroundColor: '#E6F4EA',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.primary,
  },
  contactInfo: {
    flex: 1,
  },
  contactName: {
    fontSize: 16,
    color: colors.textPrimary,
  },
  contactSubText: {
    fontSize: 12,
    color: colors.textTertiary,
    marginTop: 2,
  },
  emptyContainer: {
    paddingTop: 60,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
});
