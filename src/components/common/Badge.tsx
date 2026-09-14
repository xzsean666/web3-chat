import React from 'react';
import { View, Text, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { colors } from '../../theme/colors';

export interface BadgeProps {
  count?: number;
  dot?: boolean;
  maxCount?: number;
  style?: StyleProp<ViewStyle>;
}

export const Badge: React.FC<BadgeProps> = ({ count = 0, dot = false, maxCount = 99, style }) => {
  if (!dot && count <= 0) {
    return null;
  }

  if (dot) {
    return <View style={[styles.dot, style]} testID="badge-dot" />;
  }

  const displayText = count > maxCount ? `${maxCount}+` : `${count}`;

  return (
    <View style={[styles.badge, style]} testID="badge-count">
      <Text style={styles.badgeText}>{displayText}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.badgeRed,
  },
  badge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.badgeRed,
    paddingHorizontal: 5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeText: {
    color: colors.textInverse,
    fontSize: 11,
    fontWeight: '600',
    lineHeight: 14,
    textAlign: 'center',
  },
});
