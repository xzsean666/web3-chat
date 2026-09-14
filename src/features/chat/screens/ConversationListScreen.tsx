import React from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import { colors } from '../../../theme/colors';
import { Badge } from '../../../components/common/Badge';
import { Icon } from '../../../components/common/Icon';
import type { Conversation } from '../../../types';

export interface ConversationListScreenProps {
  conversations: Conversation[];
  onSelectConversation: (conv: Conversation) => void;
  onRefresh?: () => Promise<void> | void;
  isRefreshing?: boolean;
}

const ListSeparator = () => <View style={styles.separator} />;
const conversationKeyExtractor = (item: Conversation) => item.id;

export const ConversationListScreen: React.FC<ConversationListScreenProps> = ({
  conversations,
  onSelectConversation,
  onRefresh,
  isRefreshing = false,
}) => {
  const formatTime = (timestamp?: number | null): string => {
    if (!timestamp) return '';
    const now = Math.floor(Date.now() / 1000);
    const diff = now - timestamp;
    if (diff < 86400) {
      const d = new Date(timestamp * 1000);
      const hours = d.getHours().toString().padStart(2, '0');
      const minutes = d.getMinutes().toString().padStart(2, '0');
      return `${hours}:${minutes}`;
    } else if (diff < 86400 * 2) {
      return 'Yesterday';
    } else {
      const d = new Date(timestamp * 1000);
      return `${d.getMonth() + 1}/${d.getDate()}`;
    }
  };

  const renderItem = ({ item }: { item: Conversation }) => {
    const isGroup = item.type === 'group';

    return (
      <TouchableOpacity
        style={styles.convItem}
        onPress={() => onSelectConversation(item)}
        testID={`conv-item-${item.id}`}
        activeOpacity={0.7}
      >
        <View style={styles.avatarContainer}>
          <View style={[styles.avatar, isGroup ? styles.avatarGroup : styles.avatarDm]}>
            <Icon
              name={isGroup ? 'contacts' : 'me'}
              size={24}
              color={isGroup ? '#B45309' : '#0284C7'}
              strokeWidth={2}
            />
          </View>
          {item.unread_count > 0 && (
            <Badge count={item.unread_count} style={styles.unreadBadge} />
          )}
        </View>

        <View style={styles.contentContainer}>
          <View style={styles.topRow}>
            <Text style={styles.titleText} numberOfLines={1}>
              {item.title}
            </Text>
            <Text style={styles.timeText}>
              {formatTime(item.last_message_at || item.updated_at)}
            </Text>
          </View>

          <Text style={styles.lastMessageText} numberOfLines={1}>
            {item.last_message || 'No messages yet'}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container} testID="conversation-list-screen">
      <FlatList
        data={conversations}
        keyExtractor={conversationKeyExtractor}
        renderItem={renderItem}
        ItemSeparatorComponent={ListSeparator}
        style={styles.list}
        contentContainerStyle={styles.listContent}
        initialNumToRender={12}
        maxToRenderPerBatch={10}
        windowSize={5}
        removeClippedSubviews={true}
        refreshControl={
          onRefresh ? (
            <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />
          ) : undefined
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer} testID="conv-list-empty">
            <View style={styles.emptyIconCircle}>
              <Icon name="chat" size={36} color={colors.primary} strokeWidth={2} />
            </View>
            <Text style={styles.emptyTitle}>No Conversations</Text>
            <Text style={styles.emptySubtitle}>
              Add friends or join groups to start chatting on Web3
            </Text>
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
  convItem: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  avatarContainer: {
    width: 50,
    height: 50,
    position: 'relative',
    marginRight: 14,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarDm: {
    backgroundColor: '#E0F2FE',
  },
  avatarGroup: {
    backgroundColor: '#FEF3C7',
  },
  unreadBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  contentContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 5,
  },
  titleText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0F172A',
    flex: 1,
    marginRight: 8,
    letterSpacing: -0.2,
  },
  timeText: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '500',
  },
  lastMessageText: {
    fontSize: 14,
    color: '#64748B',
    lineHeight: 18,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(0, 0, 0, 0.06)',
    marginLeft: 78,
  },
  emptyContainer: {
    paddingTop: 80,
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.primarySubtle,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#0F172A',
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 20,
  },
});
