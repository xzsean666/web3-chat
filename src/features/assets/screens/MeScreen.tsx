import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Platform,
} from 'react-native';
import { colors } from '../../../theme/colors';
import { TokenHoldingItem } from '../components/TokenHoldingItem';
import { ChainSwitchModal } from '../components/ChainSwitchModal';
import type { WalletAccount, ChainConfig, TokenAsset } from '../../../types';

export interface MeScreenProps {
  account: WalletAccount | null;
  currentChain: ChainConfig;
  assets: TokenAsset[];
  totalUsd: number;
  onSwitchChain: (chain: ChainConfig) => void;
  onSendToken?: (token: TokenAsset) => void;
  onReceiveToken?: () => void;
  onBackupWallet?: () => void;
  onLogout?: () => void;
}

export const MeScreen: React.FC<MeScreenProps> = ({
  account,
  currentChain,
  assets,
  totalUsd,
  onSwitchChain,
  onSendToken,
  onReceiveToken,
  onBackupWallet,
  onLogout,
}) => {
  const [showChainModal, setShowChainModal] = useState(false);

  const address = account?.address || '0x0000000000000000000000000000000000000000';
  const truncatedAddress = `${address.slice(0, 6)}...${address.slice(-4)}`;

  const handleCopyAddress = () => {
    Alert.alert('Address Copied', address);
  };

  return (
    <ScrollView style={styles.container} testID="me-screen">
      {/* Profile Header */}
      <View style={styles.profileSection}>
        <View style={styles.avatar}>
          <Text style={styles.avatarEmoji}>👤</Text>
        </View>
        <View style={styles.profileInfo}>
          <Text style={styles.accountName}>{account?.name || 'My Web3 Wallet'}</Text>
          <TouchableOpacity
            style={styles.addressBadge}
            onPress={handleCopyAddress}
            testID="btn-copy-address"
          >
            <Text style={styles.addressText}>{truncatedAddress}</Text>
            <Text style={styles.copyIcon}> 📋</Text>
          </TouchableOpacity>
        </View>

        {/* Network Selector Badge */}
        <TouchableOpacity
          style={styles.networkBadge}
          onPress={() => setShowChainModal(true)}
          testID="btn-open-network-selector"
        >
          <View style={styles.statusDot} />
          <Text style={styles.networkText} numberOfLines={1}>
            {currentChain.name.split(' ')[0]}
          </Text>
          <Text style={styles.networkArrow}> ▾</Text>
        </TouchableOpacity>
      </View>

      {/* Asset Valuation Card */}
      <View style={styles.valuationCard} testID="asset-valuation-card">
        <Text style={styles.valuationLabel}>Total Estimated Balance</Text>
        <Text style={styles.valuationAmount}>
          ${totalUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </Text>

        <View style={styles.actionRow}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={onReceiveToken}
            testID="btn-receive-tokens"
          >
            <Text style={styles.actionIcon}>⬇️</Text>
            <Text style={styles.actionLabel}>Receive</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => assets[0] && onSendToken?.(assets[0])}
            testID="btn-send-tokens"
          >
            <Text style={styles.actionIcon}>⬆️</Text>
            <Text style={styles.actionLabel}>Send</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Holdings Breakdown */}
      <View style={styles.holdingsSection}>
        <Text style={styles.sectionTitle}>Holdings Breakdown</Text>
        <View style={styles.holdingsList}>
          {assets.map((token) => (
            <TokenHoldingItem
              key={token.address + token.symbol}
              token={token}
              onPress={() => onSendToken?.(token)}
            />
          ))}
        </View>
      </View>

      {/* Settings Options */}
      <View style={styles.settingsSection}>
        <TouchableOpacity
          style={styles.settingsItem}
          onPress={onBackupWallet}
          testID="btn-backup-wallet"
        >
          <Text style={styles.settingsItemText}>🔐 Backup Mnemonic / Private Key</Text>
          <Text style={styles.settingsItemArrow}>›</Text>
        </TouchableOpacity>

        {onLogout && (
          <TouchableOpacity
            style={[styles.settingsItem, styles.logoutItem]}
            onPress={onLogout}
            testID="btn-logout"
          >
            <Text style={[styles.settingsItemText, styles.logoutText]}>Log Out Session</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Chain Switch Modal */}
      <ChainSwitchModal
        visible={showChainModal}
        currentChainId={currentChain.chainId}
        onSelectChain={onSwitchChain}
        onClose={() => setShowChainModal(false)}
      />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  profileSection: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: colors.surface,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 8,
    backgroundColor: '#E6F8F0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  avatarEmoji: {
    fontSize: 28,
  },
  profileInfo: {
    flex: 1,
  },
  accountName: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  addressBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  addressText: {
    fontSize: 13,
    color: colors.textSecondary,
    fontFamily: 'monospace',
  },
  copyIcon: {
    fontSize: 12,
  },
  networkBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.backgroundLight,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.primary,
    marginRight: 6,
  },
  networkText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  networkArrow: {
    fontSize: 10,
    color: colors.textSecondary,
  },
  valuationCard: {
    margin: 16,
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    ...Platform.select({
      web: { boxShadow: '0px 2px 6px rgba(0, 0, 0, 0.04)' } as any,
      default: {
        shadowColor: '#000',
        shadowOpacity: 0.04,
        shadowRadius: 6,
        elevation: 2,
      },
    }),
  },
  valuationLabel: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  valuationAmount: {
    fontSize: 32,
    fontWeight: '800',
    color: colors.textPrimary,
    marginVertical: 8,
  },
  actionRow: {
    flexDirection: 'row',
    marginTop: 12,
    width: '100%',
    justifyContent: 'space-around',
  },
  actionButton: {
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 20,
  },
  actionIcon: {
    fontSize: 22,
    marginBottom: 4,
  },
  actionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  holdingsSection: {
    marginHorizontal: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 8,
    marginLeft: 4,
  },
  holdingsList: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    overflow: 'hidden',
  },
  settingsSection: {
    marginHorizontal: 16,
    marginBottom: 36,
    backgroundColor: colors.surface,
    borderRadius: 12,
    overflow: 'hidden',
  },
  settingsItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderLight,
  },
  settingsItemText: {
    fontSize: 15,
    color: colors.textPrimary,
  },
  settingsItemArrow: {
    fontSize: 18,
    color: colors.textTertiary,
  },
  logoutItem: {
    borderBottomWidth: 0,
    justifyContent: 'center',
  },
  logoutText: {
    color: colors.badgeRed,
    fontWeight: '600',
  },
});
