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
import { Icon, type IconName } from '../../../components/common/Icon';
import { radii, shadows } from '../../../theme/design';

export interface DAppItem {
  id: string;
  name: string;
  category: string;
  url: string;
  icon: string;
  iconName?: IconName;
  iconColor?: string;
  iconBg?: string;
  description: string;
}

export const FEATURED_DAPPS: DAppItem[] = [
  {
    id: 'luckydrop',
    name: 'LuckyDrop Protocol',
    category: 'DeFi & Social',
    url: 'https://luckydrop.io',
    icon: '🧧',
    iconName: 'gift',
    iconColor: '#FA4E38',
    iconBg: '#FFF1F2',
    description: 'Constant gas Merkle token red packets on BSC',
  },
  {
    id: 'pancakeswap',
    name: 'PancakeSwap',
    category: 'DEX',
    url: 'https://pancakeswap.finance',
    icon: '🥞',
    iconName: 'coins',
    iconColor: '#D97706',
    iconBg: '#FEF3C7',
    description: 'Top decentralized exchange and automated market maker',
  },
  {
    id: 'bscscan',
    name: 'BscScan Testnet',
    category: 'Explorer',
    url: 'https://testnet.bscscan.com',
    icon: '🔍',
    iconName: 'search',
    iconColor: '#0284C7',
    iconBg: '#E0F2FE',
    description: 'Official block explorer for BNB Smart Chain Testnet',
  },
  {
    id: 'bscfaucet',
    name: 'BNB Faucet',
    category: 'Tools',
    url: 'https://www.bnbchain.org/en/testnet-faucet',
    icon: '🚰',
    iconName: 'sparkles',
    iconColor: '#059669',
    iconBg: '#ECFDF5',
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
        <View style={styles.searchInputWrapper}>
          <Icon name="globe" size={16} color="#94A3B8" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Enter DApp URL (e.g. pancakeswap.finance)"
            placeholderTextColor="#94A3B8"
            value={urlInput}
            onChangeText={setUrlInput}
            onSubmitEditing={handleGo}
            autoCapitalize="none"
            autoCorrect={false}
            testID="dapp-url-input"
          />
        </View>
        {urlInput.trim().length > 0 && (
          <TouchableOpacity style={styles.goButton} onPress={handleGo} testID="btn-go-dapp" activeOpacity={0.8}>
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
              <View style={[styles.dappIconContainer, { backgroundColor: dapp.iconBg || '#F1F5F9' }]}>
                {dapp.iconName ? (
                  <Icon name={dapp.iconName} size={24} color={dapp.iconColor || colors.primary} strokeWidth={2.2} />
                ) : (
                  <Text style={styles.dappIcon}>{dapp.icon}</Text>
                )}
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

              <Icon name="chevron-right" size={16} color="#CBD5E1" style={styles.arrow} />
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
    backgroundColor: '#F8FAFC',
  },
  searchContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0, 0, 0, 0.06)',
  },
  searchInputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: radii.md,
    paddingHorizontal: 12,
    height: 40,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#0F172A',
    height: '100%',
  },
  goButton: {
    marginLeft: 10,
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    height: 40,
    borderRadius: radii.md,
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.subtle,
  },
  goButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
  },
  section: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#64748B',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  dappList: {
    backgroundColor: '#FFFFFF',
    borderRadius: radii.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.05)',
    ...shadows.card,
  },
  dappCard: {
    flexDirection: 'row',
    padding: 16,
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0, 0, 0, 0.05)',
  },
  dappIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  dappIcon: {
    fontSize: 24,
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
    color: '#0F172A',
    letterSpacing: -0.2,
  },
  dappCategory: {
    fontSize: 11,
    color: colors.primaryDark,
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: radii.sm,
    fontWeight: '600',
  },
  dappDesc: {
    fontSize: 13,
    color: '#64748B',
    lineHeight: 18,
  },
  arrow: {
    marginLeft: 8,
  },
});
