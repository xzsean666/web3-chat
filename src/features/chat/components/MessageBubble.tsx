import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, type StyleProp, type ViewStyle } from 'react-native';
import { colors } from '../../../theme/colors';
import type { ChatMessage } from '../../../types';

export interface MessageBubbleProps {
  message: ChatMessage;
  isSelf: boolean;
  onLongPress?: (message: ChatMessage) => void;
  onPressPacket?: (packetPayload: any) => void;
  style?: StyleProp<ViewStyle>;
}

export function canRecallMessage(message: ChatMessage, nowSeconds: number = Math.floor(Date.now() / 1000)): boolean {
  if (message.status === 'recalled') return false;
  const elapsed = nowSeconds - message.created_at;
  return elapsed <= 30;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  isSelf,
  onLongPress,
  onPressPacket,
  style,
}) => {
  if (message.status === 'recalled') {
    return (
      <View style={styles.recalledContainer} testID="message-recalled">
        <Text style={styles.recalledText}>
          {isSelf ? 'You recalled a message' : 'Message was recalled'}
        </Text>
      </View>
    );
  }

  const formatTime = (ts: number): string => {
    const d = new Date(ts * 1000);
    const hours = d.getHours().toString().padStart(2, '0');
    const minutes = d.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  };

  const renderStatus = () => {
    if (!isSelf) return null;
    switch (message.status) {
      case 'pending':
        return <Text style={styles.statusPending} testID="status-pending">⏳</Text>;
      case 'sent':
        return <Text style={styles.statusSent} testID="status-sent">✓</Text>;
      case 'delivered':
        return <Text style={styles.statusDelivered} testID="status-delivered">✓✓</Text>;
      case 'read':
        return <Text style={styles.statusRead} testID="status-read">✓✓</Text>;
      default:
        return null;
    }
  };

  const isPacket = message.type === 'packet';

  return (
    <View
      style={[
        styles.rowContainer,
        isSelf ? styles.rowSelf : styles.rowOther,
        style,
      ]}
      testID="message-bubble-row"
    >
      <TouchableOpacity
        activeOpacity={0.8}
        onLongPress={() => onLongPress?.(message)}
        onPress={() => {
          if (isPacket && onPressPacket) {
            onPressPacket(message.metadata?.packet || null);
          }
        }}
        style={[
          styles.bubble,
          isSelf ? styles.bubbleSelf : styles.bubbleOther,
          isPacket && styles.bubblePacket,
        ]}
        testID="message-bubble"
      >
        {isPacket ? (
          <View style={styles.packetCard}>
            <View style={styles.packetHeader}>
              <Text style={styles.packetIcon}>🧧</Text>
              <View style={styles.packetInfo}>
                <Text style={styles.packetWishText} numberOfLines={1}>
                  {message.metadata?.packet?.wishText || message.content || 'Lucky Red Packet'}
                </Text>
                <Text style={styles.packetTokenText}>
                  {message.metadata?.packet?.tokenSymbol || 'tBNB'} Red Packet
                </Text>
              </View>
            </View>
            <View style={styles.packetFooter}>
              <Text style={styles.packetFooterText}>LuckyDrop Web3</Text>
            </View>
          </View>
        ) : (
          <Text
            style={[
              styles.messageText,
              isSelf ? styles.messageTextSelf : styles.messageTextOther,
            ]}
          >
            {message.content}
          </Text>
        )}

        <View style={styles.metaRow}>
          <Text style={styles.timeText}>{formatTime(message.created_at)}</Text>
          {renderStatus()}
        </View>
      </TouchableOpacity>
    </View>
  );
};

export const MemoMessageBubble = React.memo(MessageBubble);

const styles = StyleSheet.create({
  rowContainer: {
    marginVertical: 4,
    paddingHorizontal: 12,
    flexDirection: 'row',
  },
  rowSelf: {
    justifyContent: 'flex-end',
  },
  rowOther: {
    justifyContent: 'flex-start',
  },
  bubble: {
    maxWidth: '75%',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 6,
  },
  bubbleSelf: {
    backgroundColor: colors.bubbleSelf,
  },
  bubbleOther: {
    backgroundColor: colors.bubbleOther,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderLight,
  },
  bubblePacket: {
    backgroundColor: colors.redPacketBg,
    paddingHorizontal: 0,
    paddingTop: 0,
    borderRadius: 10,
    minWidth: 220,
    overflow: 'hidden',
  },
  messageText: {
    fontSize: 16,
    lineHeight: 22,
  },
  messageTextSelf: {
    color: colors.textPrimary,
  },
  messageTextOther: {
    color: colors.textPrimary,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 4,
  },
  timeText: {
    fontSize: 10,
    color: colors.textTertiary,
    marginRight: 4,
  },
  statusPending: {
    fontSize: 10,
    color: colors.warning,
  },
  statusSent: {
    fontSize: 10,
    color: colors.textTertiary,
  },
  statusDelivered: {
    fontSize: 10,
    color: colors.textSecondary,
  },
  statusRead: {
    fontSize: 10,
    color: colors.info,
    fontWeight: '700',
  },
  recalledContainer: {
    alignItems: 'center',
    marginVertical: 8,
  },
  recalledText: {
    fontSize: 12,
    color: colors.textTertiary,
    backgroundColor: 'rgba(0,0,0,0.05)',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 4,
  },
  packetCard: {
    width: '100%',
  },
  packetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
  packetIcon: {
    fontSize: 34,
    marginRight: 10,
  },
  packetInfo: {
    flex: 1,
  },
  packetWishText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.redPacketGold,
  },
  packetTokenText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
  packetFooter: {
    backgroundColor: colors.redPacketDark,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  packetFooterText: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.6)',
  },
});
