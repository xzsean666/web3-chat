import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors } from '../../../theme/colors';
import { Icon } from '../../../components/common/Icon';
import { shadows, radii } from '../../../theme/design';
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
    return `${payload.tokenSymbol} LuckyDrop Red Packet`;
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
          <View style={styles.goldEmblem}>
            <Icon name="gift" size={20} color="#D44A26" strokeWidth={2.4} />
          </View>
        </View>
        <View style={styles.textContainer}>
          <Text style={styles.wishText} numberOfLines={1}>
            {payload.wishText || '恭喜发财 大吉大利 🧧'}
          </Text>
          <Text style={styles.subText}>{getSubStatus()}</Text>
        </View>
      </View>

      <View style={styles.footerRow}>
        <View style={styles.footerLeft}>
          <Icon name="sparkles" size={11} color="rgba(255,255,255,0.7)" strokeWidth={2} />
          <Text style={styles.footerText}>LuckyDrop Web3</Text>
        </View>
        <Icon name="chevron-right" size={12} color="rgba(255,255,255,0.6)" />
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FA4E38',
    borderRadius: radii.md,
    width: 240,
    overflow: 'hidden',
    ...shadows.card,
  },
  cardInactive: {
    opacity: 0.65,
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  iconContainer: {
    marginRight: 12,
  },
  goldEmblem: {
    width: 42,
    height: 42,
    borderRadius: radii.sm,
    backgroundColor: '#FDE49E',
    borderWidth: 1.5,
    borderColor: '#F5CD6D',
    alignItems: 'center',
    justifyContent: 'center',
  },
  textContainer: {
    flex: 1,
  },
  wishText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FDE49E',
    marginBottom: 4,
    letterSpacing: -0.1,
  },
  subText: {
    fontSize: 12,
    color: '#FFFFFF',
    opacity: 0.92,
  },
  footerRow: {
    backgroundColor: '#D33620',
    paddingHorizontal: 14,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  footerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  footerText: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.75)',
    fontWeight: '500',
    marginLeft: 4,
  },
});
