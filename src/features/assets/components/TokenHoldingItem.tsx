import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { colors } from '../../../theme/colors';
import type { TokenAsset } from '../../../types';

export interface TokenHoldingItemProps {
  token: TokenAsset;
  onPress?: () => void;
}

export const TokenHoldingItem: React.FC<TokenHoldingItemProps> = ({ token, onPress }) => {
  const usdValue = (parseFloat(token.balance) || 0) * (token.usdPrice || 0);
  const formattedUsd = `$${usdValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={onPress}
      activeOpacity={0.7}
      testID={`token-item-${token.symbol}`}
    >
      <View style={styles.iconContainer}>
        <Text style={styles.tokenIcon}>{token.icon || '🪙'}</Text>
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
    backgroundColor: colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderLight,
  },
  iconContainer: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.backgroundLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  tokenIcon: {
    fontSize: 22,
  },
  infoContainer: {
    flex: 1,
  },
  symbolText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  nameText: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  balanceContainer: {
    alignItems: 'flex-end',
  },
  balanceText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  usdText: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
});
