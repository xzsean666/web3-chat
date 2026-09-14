import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors } from '../theme/colors';
import { Badge } from '../components/common/Badge';
import { Icon, type IconName } from '../components/common/Icon';
import { shadows } from '../theme/design';

export type TabKey = 'chat' | 'contacts' | 'discover' | 'me';

export interface TabItemConfig {
  key: TabKey;
  label: string;
  icon: string;
  iconName?: IconName;
  badgeCount?: number;
  badgeDot?: boolean;
}

export interface TabNavigatorProps {
  activeTab: TabKey;
  onTabChange: (tab: TabKey) => void;
  chatUnreadCount?: number;
  hasDiscoverUpdate?: boolean;
  children?: React.ReactNode;
}

export const TAB_CONFIGS: TabItemConfig[] = [
  { key: 'chat', label: 'Chats', icon: '💬', iconName: 'chat' },
  { key: 'contacts', label: 'Contacts', icon: '👥', iconName: 'contacts' },
  { key: 'discover', label: 'Discover', icon: '🧭', iconName: 'discover' },
  { key: 'me', label: 'Me', icon: '👤', iconName: 'me' },
];

export const TabNavigator: React.FC<TabNavigatorProps> = ({
  activeTab,
  onTabChange,
  chatUnreadCount = 0,
  hasDiscoverUpdate = false,
  children,
}) => {
  return (
    <View style={styles.container} testID="tab-navigator">
      <View style={styles.contentArea}>{children}</View>

      <View style={styles.tabBar} testID="tab-bar">
        {TAB_CONFIGS.map((tab) => {
          const isActive = activeTab === tab.key;
          const badgeCount = tab.key === 'chat' ? chatUnreadCount : undefined;
          const badgeDot = tab.key === 'discover' ? hasDiscoverUpdate : undefined;
          const iconName: IconName = tab.iconName || (tab.key as IconName);

          return (
            <TouchableOpacity
              key={tab.key}
              style={styles.tabItem}
              onPress={() => onTabChange(tab.key)}
              testID={`tab-${tab.key}`}
              accessibilityRole="button"
              accessibilityState={{ selected: isActive }}
              activeOpacity={0.7}
            >
              <View style={styles.iconContainer}>
                <Icon
                  name={iconName}
                  size={24}
                  color={isActive ? colors.tabActive : colors.tabInactive}
                  strokeWidth={isActive ? 2.4 : 1.9}
                />
                {badgeCount !== undefined && badgeCount > 0 && (
                  <Badge count={badgeCount} style={styles.tabBadge} />
                )}
                {badgeDot && <Badge dot style={styles.tabDot} />}
              </View>
              <Text
                style={[
                  styles.tabLabel,
                  isActive ? styles.tabLabelActive : styles.tabLabelInactive,
                ]}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  contentArea: {
    flex: 1,
  },
  tabBar: {
    height: 60,
    backgroundColor: colors.tabBarBg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(0, 0, 0, 0.08)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingBottom: 4,
    paddingTop: 4,
    ...shadows.subtle,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
  },
  iconContainer: {
    width: 36,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  tabBadge: {
    position: 'absolute',
    top: -4,
    right: -8,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  tabDot: {
    position: 'absolute',
    top: -1,
    right: 2,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  tabLabel: {
    fontSize: 11,
    marginTop: 3,
    fontWeight: '500',
    letterSpacing: -0.1,
  },
  tabLabelActive: {
    color: colors.tabActive,
    fontWeight: '600',
  },
  tabLabelInactive: {
    color: colors.tabInactive,
  },
});
