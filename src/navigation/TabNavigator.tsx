import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors } from '../theme/colors';
import { Badge } from '../components/common/Badge';

export type TabKey = 'chat' | 'contacts' | 'discover' | 'me';

export interface TabItemConfig {
  key: TabKey;
  label: string;
  icon: string;
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
  { key: 'chat', label: 'Chats', icon: '💬' },
  { key: 'contacts', label: 'Contacts', icon: '👥' },
  { key: 'discover', label: 'Discover', icon: '🧭' },
  { key: 'me', label: 'Me', icon: '👤' },
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

          return (
            <TouchableOpacity
              key={tab.key}
              style={styles.tabItem}
              onPress={() => onTabChange(tab.key)}
              testID={`tab-${tab.key}`}
              accessibilityRole="button"
              accessibilityState={{ selected: isActive }}
            >
              <View style={styles.iconContainer}>
                <Text style={styles.tabIcon}>{tab.icon}</Text>
                {(badgeCount !== undefined && badgeCount > 0) && (
                  <Badge count={badgeCount} style={styles.tabBadge} />
                )}
                {badgeDot && (
                  <Badge dot style={styles.tabDot} />
                )}
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
    height: 56,
    backgroundColor: colors.tabBarBg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingBottom: 4,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
  },
  iconContainer: {
    width: 32,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  tabIcon: {
    fontSize: 20,
  },
  tabBadge: {
    position: 'absolute',
    top: -2,
    right: -10,
  },
  tabDot: {
    position: 'absolute',
    top: 0,
    right: 2,
  },
  tabLabel: {
    fontSize: 11,
    marginTop: 2,
    fontWeight: '500',
  },
  tabLabelActive: {
    color: colors.tabActive,
  },
  tabLabelInactive: {
    color: colors.tabInactive,
  },
});
