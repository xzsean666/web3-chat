import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { colors } from '../../../theme/colors';
import type { PacketMessagePayload } from '../../../types';

export interface RedPacketCardProps {
  payload: PacketMessagePayload;
  isClaimed?: boolean;
  isExpired?: boolean;
  onPress: () => void;
}

export const RedPacketCard: React.FC<RedPacketCardProps> = ({
  payload,
  isClaimed = false,
  isExpired = false,
  onPress,
}) => {
  const getSubStatus = () => {
    if (isExpired) return 'Expired';
    if (isClaimed) return 'Red packet claimed';
    return `${payload.tokenSymbol} Red Packet`;
  };

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      style={[styles.card, (isClaimed || isExpired) && styles.cardInactive]}
      testID="red-packet-card"
    >
      <View style={styles.contentRow}>
        <View style={styles.iconContainer}>
          <Text style={styles.iconEmoji}>🧧</Text>
        </View>
        <View style={styles.textContainer}>
          <Text style={styles.wishText} numberOfLines={1}>
            {payload.wishText || 'Best Wishes & Good Luck!'}
          </Text>
          <Text style={styles.subText}>{getSubStatus()}</Text>
        </View>
      </View>

      <View style={styles.footerRow}>
        <Text style={styles.footerText}>LuckyDrop Web3</Text>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.redPacketBg,
    borderRadius: 10,
    width: 230,
    overflow: 'hidden',
    ...Platform.select({
      web: { boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.15)' } as any,
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 4,
        elevation: 3,
      },
    }),
  },
  cardInactive: {
    opacity: 0.65,
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
  iconContainer: {
    marginRight: 10,
  },
  iconEmoji: {
    fontSize: 34,
  },
  textContainer: {
    flex: 1,
  },
  wishText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.redPacketGold,
    marginBottom: 3,
  },
  subText: {
    fontSize: 12,
    color: colors.textInverse,
    opacity: 0.9,
  },
  footerRow: {
    backgroundColor: colors.redPacketDark,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  footerText: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.7)',
  },
});
