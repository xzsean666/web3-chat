import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, type StyleProp, type ViewStyle } from 'react-native';
import { colors } from '../../../theme/colors';
import { Icon } from '../../../components/common/Icon';
import { shadows, radii } from '../../../theme/design';
import { RedPacketCard } from '../../packet/components/RedPacketCard';
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
  const isBurn = message.retention === 'on_read';

  return (
    <View
      style={[
        styles.rowContainer,
        isSelf ? styles.rowSelf : styles.rowOther,
        style,
      ]}
      testID="message-bubble-row"
    >
      {isPacket ? (
        <RedPacketCard
          payload={message.metadata?.packet || {
            packetId: '0xpacket',
            chainId: 97,
            tokenSymbol: 'LUCKY',
            totalAmount: '10',
            recipientCount: 1,
            wishText: message.content,
          }}
          onPress={() => onPressPacket?.(message.metadata?.packet)}
        />
      ) : (
        <TouchableOpacity
          activeOpacity={0.8}
          onLongPress={() => onLongPress?.(message)}
          style={[
            styles.bubble,
            isSelf ? styles.bubbleSelf : styles.bubbleOther,
          ]}
          testID="message-bubble"
        >
          {isBurn && (
            <View style={styles.burnHeader}>
              <Icon name="flame" size={14} color="#EF4444" strokeWidth={2.4} />
              <Text style={styles.burnHeaderText}>Burn on read</Text>
            </View>
          )}

          <Text
            style={[
              styles.messageText,
              isSelf ? styles.messageTextSelf : styles.messageTextOther,
            ]}
          >
            {message.content}
          </Text>

          <View style={styles.metaRow}>
            <Text style={[styles.timeText, isSelf && styles.timeTextSelf]}>
              {formatTime(message.created_at)}
            </Text>
            {renderStatus()}
          </View>
        </TouchableOpacity>
      )}
    </View>
  );
};

export const MemoMessageBubble = React.memo(MessageBubble);

const styles = StyleSheet.create({
  rowContainer: {
    marginVertical: 4,
    paddingHorizontal: 14,
    flexDirection: 'row',
  },
  rowSelf: {
    justifyContent: 'flex-end',
  },
  rowOther: {
    justifyContent: 'flex-start',
  },
  bubble: {
    maxWidth: '78%',
    borderRadius: radii.md,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 8,
    ...shadows.subtle,
  },
  bubbleSelf: {
    backgroundColor: '#95EC69',
    borderTopRightRadius: 4,
  },
  bubbleOther: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 4,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0, 0, 0, 0.06)',
  },
  burnHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    gap: 4,
  },
  burnHeaderText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#EF4444',
    marginLeft: 3,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 22,
  },
  messageTextSelf: {
    color: '#0F172A',
  },
  messageTextOther: {
    color: '#0F172A',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 4,
  },
  timeText: {
    fontSize: 10,
    color: '#94A3B8',
    marginRight: 4,
  },
  timeTextSelf: {
    color: 'rgba(15, 23, 42, 0.55)',
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
    marginVertical: 10,
  },
  recalledText: {
    fontSize: 12,
    color: '#64748B',
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: radii.full,
    fontWeight: '500',
  },
});
