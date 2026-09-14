import React, { useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView } from 'react-native';
import { TabNavigator, type TabKey } from './TabNavigator';
import { HeaderBar } from '../components/common/HeaderBar';
import { colors } from '../theme/colors';

export interface RootNavigatorProps {
  initialTab?: TabKey;
  chatUnreadCount?: number;
  hasDiscoverUpdate?: boolean;
}

export const RootNavigator: React.FC<RootNavigatorProps> = ({
  initialTab = 'chat',
  chatUnreadCount = 0,
  hasDiscoverUpdate = false,
}) => {
  const [activeTab, setActiveTab] = useState<TabKey>(initialTab);

  const renderTabHeader = () => {
    switch (activeTab) {
      case 'chat':
        return (
          <HeaderBar
            title="Chats"
            rightActions={[
              { label: '＋', onPress: () => {} },
            ]}
          />
        );
      case 'contacts':
        return (
          <HeaderBar
            title="Contacts"
            rightActions={[
              { label: '＋', onPress: () => {} },
            ]}
          />
        );
      case 'discover':
        return <HeaderBar title="Discover" />;
      case 'me':
        return <HeaderBar title="Me" />;
    }
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'chat':
        return (
          <View style={styles.screenContainer} testID="screen-chat">
            <Text style={styles.placeholderTitle}>💬 Chats</Text>
            <Text style={styles.placeholderSubtitle}>No active conversations</Text>
          </View>
        );
      case 'contacts':
        return (
          <View style={styles.screenContainer} testID="screen-contacts">
            <Text style={styles.placeholderTitle}>👥 Contacts</Text>
            <Text style={styles.placeholderSubtitle}>Friends & Groups</Text>
          </View>
        );
      case 'discover':
        return (
          <View style={styles.screenContainer} testID="screen-discover">
            <Text style={styles.placeholderTitle}>🧭 Discover</Text>
            <Text style={styles.placeholderSubtitle}>DApps & Web3 Ecosystem</Text>
          </View>
        );
      case 'me':
        return (
          <View style={styles.screenContainer} testID="screen-me">
            <Text style={styles.placeholderTitle}>👤 Me</Text>
            <Text style={styles.placeholderSubtitle}>Wallet & Settings</Text>
          </View>
        );
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} testID="root-navigator">
      {renderTabHeader()}
      <TabNavigator
        activeTab={activeTab}
        onTabChange={setActiveTab}
        chatUnreadCount={chatUnreadCount}
        hasDiscoverUpdate={hasDiscoverUpdate}
      >
        {renderTabContent()}
      </TabNavigator>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.backgroundLight,
  },
  screenContainer: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  placeholderTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 8,
  },
  placeholderSubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
  },
});
