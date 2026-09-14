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
    const avatarEmoji = isGroup ? '👥' : '👤';

    return (
      <TouchableOpacity
        style={styles.convItem}
        onPress={() => onSelectConversation(item)}
        testID={`conv-item-${item.id}`}
      >
        <View style={styles.avatarContainer}>
          <View style={[styles.avatar, isGroup ? styles.avatarGroup : styles.avatarDm]}>
            <Text style={styles.avatarEmoji}>{avatarEmoji}</Text>
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
            <Text style={styles.emptyIcon}>💬</Text>
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
    backgroundColor: colors.surface,
  },
  convItem: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: colors.surface,
  },
  avatarContainer: {
    width: 48,
    height: 48,
    position: 'relative',
    marginRight: 12,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarDm: {
    backgroundColor: '#E6F0FF',
  },
  avatarGroup: {
    backgroundColor: '#FFF2E6',
  },
  avatarEmoji: {
    fontSize: 24,
  },
  unreadBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
  },
  contentContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  titleText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    flex: 1,
    marginRight: 8,
  },
  timeText: {
    fontSize: 12,
    color: colors.textTertiary,
  },
  lastMessageText: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.borderLight,
    marginLeft: 76,
  },
  emptyContainer: {
    paddingTop: 80,
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
  },
});
