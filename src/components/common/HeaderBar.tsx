import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { colors } from '../../theme/colors';
import { Icon } from './Icon';

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
  const renderLeftContent = () => {
    if (!leftAction) return null;
    const label = leftAction.label || '‹ Back';
    const isBackLike = label.includes('Back') || label.startsWith('‹') || label.startsWith('<');

    return (
      <TouchableOpacity
        style={styles.leftButton}
        onPress={leftAction.onPress}
        testID="header-left-action"
        activeOpacity={0.7}
      >
        {isBackLike ? (
          <View style={styles.backRow}>
            <Icon name="chevron-left" size={22} color={colors.textPrimary} strokeWidth={2.4} />
            <Text style={styles.actionText}>Back</Text>
          </View>
        ) : (
          <Text style={styles.actionText}>{label}</Text>
        )}
      </TouchableOpacity>
    );
  };

  const renderRightAction = (
    action: { label: string; onPress: () => void },
    index: number
  ) => {
    const isPlus = action.label === '+' || action.label === '＋';
    const isMore = action.label === '...' || action.label === '•••';

    return (
      <TouchableOpacity
        key={index}
        style={[styles.rightButton, (isPlus || isMore) && styles.iconActionButton]}
        onPress={action.onPress}
        testID={`header-right-action-${index}`}
        activeOpacity={0.7}
      >
        {isPlus ? (
          <Icon name="plus" size={20} color={colors.textPrimary} strokeWidth={2.2} />
        ) : isMore ? (
          <Icon name="more" size={20} color={colors.textPrimary} strokeWidth={2.2} />
        ) : (
          <Text style={styles.actionText}>{action.label}</Text>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, style]} testID="header-bar">
      <View style={styles.leftContainer}>{renderLeftContent()}</View>

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
        {rightActions?.map((action, index) => renderRightAction(action, index))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    height: 50,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0, 0, 0, 0.08)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
  },
  leftContainer: {
    minWidth: 70,
    flexDirection: 'row',
    alignItems: 'center',
  },
  leftButton: {
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  backRow: {
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
    letterSpacing: -0.2,
  },
  subtitleText: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 1,
  },
  rightContainer: {
    minWidth: 70,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  rightButton: {
    paddingVertical: 6,
    paddingHorizontal: 6,
  },
  iconActionButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.surfaceSubtle,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 6,
  },
  actionText: {
    fontSize: 15,
    color: colors.textPrimary,
    fontWeight: '500',
  },
});
