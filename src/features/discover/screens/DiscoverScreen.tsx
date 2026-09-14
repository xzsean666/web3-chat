import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { colors } from '../../../theme/colors';

export interface DAppItem {
  id: string;
  name: string;
  category: string;
  url: string;
  icon: string;
  description: string;
}

export const FEATURED_DAPPS: DAppItem[] = [
  {
    id: 'luckydrop',
    name: 'LuckyDrop Protocol',
    category: 'DeFi & Social',
    url: 'https://luckydrop.io',
    icon: '🧧',
    description: 'Constant gas Merkle token red packets on BSC',
  },
  {
    id: 'pancakeswap',
    name: 'PancakeSwap',
    category: 'DEX',
    url: 'https://pancakeswap.finance',
    icon: '🥞',
    description: 'Top decentralized exchange and automated market maker',
  },
  {
    id: 'bscscan',
    name: 'BscScan Testnet',
    category: 'Explorer',
    url: 'https://testnet.bscscan.com',
    icon: '🔍',
    description: 'Official block explorer for BNB Smart Chain Testnet',
  },
  {
    id: 'bscfaucet',
    name: 'BNB Faucet',
    category: 'Tools',
    url: 'https://www.bnbchain.org/en/testnet-faucet',
    icon: '🚰',
    description: 'Free testnet tBNB tokens for builders and testing',
  },
];

export interface DiscoverScreenProps {
  onOpenUrl: (url: string, title?: string) => void;
}

export const DiscoverScreen: React.FC<DiscoverScreenProps> = ({ onOpenUrl }) => {
  const [urlInput, setUrlInput] = useState('');

  const handleGo = () => {
    let target = urlInput.trim();
    if (!target) return;
    if (!target.startsWith('http://') && !target.startsWith('https://')) {
      target = `https://${target}`;
    }
    onOpenUrl(target);
  };

  return (
    <ScrollView style={styles.container} testID="discover-screen">
      {/* URL search bar */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Enter DApp URL (e.g. pancakeswap.finance)"
          placeholderTextColor={colors.textTertiary}
          value={urlInput}
          onChangeText={setUrlInput}
          onSubmitEditing={handleGo}
          autoCapitalize="none"
          autoCorrect={false}
          testID="dapp-url-input"
        />
        {urlInput.trim().length > 0 && (
          <TouchableOpacity style={styles.goButton} onPress={handleGo} testID="btn-go-dapp">
            <Text style={styles.goButtonText}>Go</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Featured Web3 DApps */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Featured Web3 Ecosystem</Text>

        <View style={styles.dappList}>
          {FEATURED_DAPPS.map((dapp) => (
            <TouchableOpacity
              key={dapp.id}
              style={styles.dappCard}
              onPress={() => onOpenUrl(dapp.url, dapp.name)}
              activeOpacity={0.7}
              testID={`dapp-card-${dapp.id}`}
            >
              <View style={styles.dappIconContainer}>
                <Text style={styles.dappIcon}>{dapp.icon}</Text>
              </View>

              <View style={styles.dappInfo}>
                <View style={styles.titleRow}>
                  <Text style={styles.dappName}>{dapp.name}</Text>
                  <Text style={styles.dappCategory}>{dapp.category}</Text>
                </View>
                <Text style={styles.dappDesc} numberOfLines={2}>
                  {dapp.description}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  searchContainer: {
    flexDirection: 'row',
    padding: 12,
    backgroundColor: colors.surface,
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderLight,
  },
  searchInput: {
    flex: 1,
    height: 40,
    backgroundColor: colors.backgroundLight,
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 14,
    color: colors.textPrimary,
  },
  goButton: {
    marginLeft: 8,
    backgroundColor: colors.primary,
    paddingHorizontal: 14,
    height: 40,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  goButtonText: {
    color: colors.textInverse,
    fontWeight: '700',
    fontSize: 14,
  },
  section: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textSecondary,
    marginBottom: 12,
  },
  dappList: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    overflow: 'hidden',
  },
  dappCard: {
    flexDirection: 'row',
    padding: 16,
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderLight,
  },
  dappIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: colors.backgroundLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  dappIcon: {
    fontSize: 26,
  },
  dappInfo: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  dappName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  dappCategory: {
    fontSize: 11,
    color: colors.primaryDark,
    backgroundColor: '#E8F8F0',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    fontWeight: '600',
  },
  dappDesc: {
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 16,
  },
});
