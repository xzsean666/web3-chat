import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import { colors } from '../../../theme/colors';
import { TokenHoldingItem } from '../components/TokenHoldingItem';
import { ChainSwitchModal } from '../components/ChainSwitchModal';
import { Icon } from '../../../components/common/Icon';
import { radii, shadows } from '../../../theme/design';
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
          <Icon name="wallet" size={26} color={colors.primary} strokeWidth={2.2} />
        </View>
        <View style={styles.profileInfo}>
          <Text style={styles.accountName}>{account?.name || 'My Web3 Wallet'}</Text>
          <TouchableOpacity
            style={styles.addressBadge}
            onPress={handleCopyAddress}
            testID="btn-copy-address"
            activeOpacity={0.7}
          >
            <Text style={styles.addressText}>{truncatedAddress}</Text>
            <Icon name="copy" size={13} color="#64748B" style={styles.copyIcon} />
          </TouchableOpacity>
        </View>

        {/* Network Selector Badge */}
        <TouchableOpacity
          style={styles.networkBadge}
          onPress={() => setShowChainModal(true)}
          testID="btn-open-network-selector"
          activeOpacity={0.7}
        >
          <View style={styles.statusDot} />
          <Text style={styles.networkText} numberOfLines={1}>
            {currentChain.name.split(' ')[0]}
          </Text>
          <Icon name="chevron-right" size={13} color="#64748B" style={styles.networkArrow} />
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
            activeOpacity={0.7}
          >
            <View style={[styles.actionCircle, styles.actionCircleReceive]}>
              <Icon name="arrow-down-left" size={20} color={colors.primary} strokeWidth={2.4} />
            </View>
            <Text style={styles.actionLabel}>Receive</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => assets[0] && onSendToken?.(assets[0])}
            testID="btn-send-tokens"
            activeOpacity={0.7}
          >
            <View style={[styles.actionCircle, styles.actionCircleSend]}>
              <Icon name="arrow-up-right" size={20} color="#0284C7" strokeWidth={2.4} />
            </View>
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
          activeOpacity={0.7}
        >
          <View style={styles.settingsLeft}>
            <Icon name="shield-check" size={18} color="#475569" />
            <Text style={styles.settingsItemText}>Backup Mnemonic / Private Key</Text>
          </View>
          <Icon name="chevron-right" size={16} color="#CBD5E1" />
        </TouchableOpacity>

        {onLogout && (
          <TouchableOpacity
            style={[styles.settingsItem, styles.logoutItem]}
            onPress={onLogout}
            testID="btn-logout"
            activeOpacity={0.7}
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
    backgroundColor: '#F8FAFC',
  },
  profileSection: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0, 0, 0, 0.05)',
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: radii.md,
    backgroundColor: colors.primarySubtle,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  profileInfo: {
    flex: 1,
  },
  accountName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
    letterSpacing: -0.3,
  },
  addressBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.sm,
    alignSelf: 'flex-start',
  },
  addressText: {
    fontSize: 12,
    color: '#64748B',
    fontFamily: 'monospace',
    fontWeight: '500',
  },
  copyIcon: {
    marginLeft: 6,
  },
  networkBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.04)',
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: colors.primary,
    marginRight: 6,
  },
  networkText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0F172A',
  },
  networkArrow: {
    marginLeft: 3,
  },
  valuationCard: {
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: radii.xl,
    padding: 22,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.05)',
    ...shadows.card,
  },
  valuationLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: '#64748B',
  },
  valuationAmount: {
    fontSize: 34,
    fontWeight: '800',
    color: '#0F172A',
    marginVertical: 10,
    letterSpacing: -0.5,
  },
  actionRow: {
    flexDirection: 'row',
    marginTop: 12,
    width: '100%',
    justifyContent: 'center',
    gap: 40,
  },
  actionButton: {
    alignItems: 'center',
  },
  actionCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
    ...shadows.subtle,
  },
  actionCircleReceive: {
    backgroundColor: '#F0FDF4',
  },
  actionCircleSend: {
    backgroundColor: '#F0F9FF',
  },
  actionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0F172A',
  },
  holdingsSection: {
    marginHorizontal: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#64748B',
    marginBottom: 10,
    marginLeft: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  holdingsList: {
    backgroundColor: '#FFFFFF',
    borderRadius: radii.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.05)',
    ...shadows.card,
  },
  settingsSection: {
    marginHorizontal: 16,
    marginBottom: 36,
    backgroundColor: '#FFFFFF',
    borderRadius: radii.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.05)',
    ...shadows.card,
  },
  settingsItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 15,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0, 0, 0, 0.05)',
  },
  settingsLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  settingsItemText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#0F172A',
    marginLeft: 10,
  },
  logoutItem: {
    borderBottomWidth: 0,
    justifyContent: 'center',
  },
  logoutText: {
    color: '#EF4444',
    fontWeight: '600',
    marginLeft: 0,
  },
});
