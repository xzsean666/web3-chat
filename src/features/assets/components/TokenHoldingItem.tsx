import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { colors } from '../../../theme/colors';
import { Icon } from '../../../components/common/Icon';
import type { TokenAsset } from '../../../types';

export interface TokenHoldingItemProps {
  token: TokenAsset;
  onPress?: () => void;
}

export const TokenHoldingItem: React.FC<TokenHoldingItemProps> = ({ token, onPress }) => {
  const usdValue = (parseFloat(token.balance) || 0) * (token.usdPrice || 0);
  const formattedUsd = `$${usdValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const renderTokenBadge = () => {
    const sym = (token.symbol || '').toUpperCase();
    if (sym === 'BNB' || sym === 'TBNB') {
      return (
        <View style={[styles.tokenBadge, { backgroundColor: '#F3BA2F' }]}>
          <Text style={styles.tokenBadgeLetter}>B</Text>
        </View>
      );
    }
    if (sym === 'USDT' || sym === 'USDC') {
      return (
        <View style={[styles.tokenBadge, { backgroundColor: '#26A17B' }]}>
          <Text style={styles.tokenBadgeLetter}>₮</Text>
        </View>
      );
    }
    if (sym === 'LUCKY') {
      return (
        <View style={[styles.tokenBadge, { backgroundColor: '#FF4B4B' }]}>
          <Icon name="gift" size={18} color="#FFFFFF" strokeWidth={2.4} />
        </View>
      );
    }
    return (
      <View style={[styles.tokenBadge, { backgroundColor: '#E2E8F0' }]}>
        <Icon name="coins" size={18} color="#475569" strokeWidth={2.2} />
      </View>
    );
  };

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={onPress}
      activeOpacity={0.7}
      testID={`token-item-${token.symbol}`}
    >
      <View style={styles.iconContainer}>
        {renderTokenBadge()}
      </View>

      <View style={styles.infoContainer}>
        <Text style={styles.symbolText}>{token.symbol}</Text>
        <Text style={styles.nameText}>{token.name}</Text>
      </View>

      <View style={styles.balanceContainer}>
        <Text style={styles.balanceText}>{token.balance}</Text>
        <Text style={styles.usdText}>{formattedUsd}</Text>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0, 0, 0, 0.05)',
  },
  iconContainer: {
    marginRight: 14,
  },
  tokenBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tokenBadgeLetter: {
    color: '#FFFFFF',
    fontSize: 19,
    fontWeight: '800',
  },
  infoContainer: {
    flex: 1,
  },
  symbolText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
    letterSpacing: -0.2,
  },
  nameText: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 2,
  },
  balanceContainer: {
    alignItems: 'flex-end',
  },
  balanceText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
    letterSpacing: -0.2,
  },
  usdText: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 2,
    fontWeight: '500',
  },
});
