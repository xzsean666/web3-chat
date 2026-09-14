import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { colors } from '../../theme/colors';

export interface HeaderBarProps {
  title: string;
  subtitle?: string;
  leftAction?: {
    label?: string;
    onPress: () => void;
  };
  rightActions?: Array<{
    label: string;
    onPress: () => void;
  }>;
  style?: StyleProp<ViewStyle>;
}

export const HeaderBar: React.FC<HeaderBarProps> = ({
  title,
  subtitle,
  leftAction,
  rightActions,
  style,
}) => {
  return (
    <View style={[styles.container, style]} testID="header-bar">
      <View style={styles.leftContainer}>
        {leftAction && (
          <TouchableOpacity
            style={styles.actionButton}
            onPress={leftAction.onPress}
            testID="header-left-action"
          >
            <Text style={styles.actionText}>{leftAction.label || '‹ Back'}</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.titleContainer}>
        <Text style={styles.titleText} numberOfLines={1} testID="header-title">
          {title}
        </Text>
        {subtitle && (
          <Text style={styles.subtitleText} numberOfLines={1}>
            {subtitle}
          </Text>
        )}
      </View>

      <View style={styles.rightContainer}>
        {rightActions?.map((action, index) => (
          <TouchableOpacity
            key={index}
            style={styles.actionButton}
            onPress={action.onPress}
            testID={`header-right-action-${index}`}
          >
            <Text style={styles.actionText}>{action.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    height: 48,
    backgroundColor: colors.backgroundLight,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
  },
  leftContainer: {
    minWidth: 60,
    flexDirection: 'row',
    alignItems: 'center',
  },
  titleContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleText: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  subtitleText: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 1,
  },
  rightContainer: {
    minWidth: 60,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  actionButton: {
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  actionText: {
    fontSize: 15,
    color: colors.textPrimary,
    fontWeight: '500',
  },
});
