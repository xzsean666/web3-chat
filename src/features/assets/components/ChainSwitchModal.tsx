import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { colors } from '../../../theme/colors';
import { Icon } from '../../../components/common/Icon';
import { radii, shadows } from '../../../theme/design';
import { SUPPORTED_CHAINS } from '../../../constants/chains';
import type { ChainConfig } from '../../../types';

export interface ChainSwitchModalProps {
  visible: boolean;
  currentChainId: number;
  onSelectChain: (chain: ChainConfig) => void;
  onClose: () => void;
}

export const ChainSwitchModal: React.FC<ChainSwitchModalProps> = ({
  visible,
  currentChainId,
  onSelectChain,
  onClose,
}) => {
  const chainList = Object.values(SUPPORTED_CHAINS);

  const renderChainIcon = (chainId: number) => {
    if (chainId === 97 || chainId === 56) {
      return (
        <View style={[styles.chainIconBadge, { backgroundColor: '#F3BA2F' }]}>
          <Text style={styles.chainBadgeText}>BNB</Text>
        </View>
      );
    }
    if (chainId === 1 || chainId === 11155111) {
      return (
        <View style={[styles.chainIconBadge, { backgroundColor: '#627EEA' }]}>
          <Text style={styles.chainBadgeText}>ETH</Text>
        </View>
      );
    }
    return (
      <View style={[styles.chainIconBadge, { backgroundColor: '#475569' }]}>
        <Icon name="layers" size={16} color="#FFFFFF" strokeWidth={2.4} />
      </View>
    );
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay} testID="chain-switch-modal">
        <View style={styles.container}>
          <View style={styles.handleBar} />

          <View style={styles.header}>
            <Text style={styles.title}>Select Network</Text>
            <TouchableOpacity onPress={onClose} testID="btn-close-chain-modal" style={styles.closeBtn}>
              <Icon name="close" size={20} color="#64748B" />
            </TouchableOpacity>
          </View>

          <View style={styles.chainList}>
            {chainList.map((chain) => {
              const isSelected = chain.chainId === currentChainId;
              return (
                <TouchableOpacity
                  key={chain.chainId}
                  style={[styles.chainItem, isSelected && styles.chainItemActive]}
                  onPress={() => {
                    onSelectChain(chain);
                    onClose();
                  }}
                  testID={`chain-option-${chain.chainId}`}
                  activeOpacity={0.7}
                >
                  <View style={styles.chainIconContainer}>
                    {renderChainIcon(chain.chainId)}
                  </View>

                  <View style={styles.chainInfo}>
                    <Text style={[styles.chainName, isSelected && styles.chainNameActive]}>
                      {chain.name}
                    </Text>
                    <Text style={styles.chainCurrency}>
                      Native: {chain.nativeCurrency.symbol} • Chain ID: {chain.chainId}
                    </Text>
                  </View>

                  {isSelected && (
                    <Text style={styles.checkMark} testID="selected-checkmark">✓</Text>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: radii.xxl,
    borderTopRightRadius: radii.xxl,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 36,
    ...shadows.modal,
  },
  handleBar: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#CBD5E1',
    alignSelf: 'center',
    marginBottom: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 18,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
    letterSpacing: -0.2,
  },
  closeBtn: {
    padding: 4,
  },
  chainList: {
    gap: 8,
  },
  chainItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: radii.lg,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.04)',
  },
  chainItemActive: {
    backgroundColor: '#F0FDF4',
    borderColor: colors.primary,
  },
  chainIconContainer: {
    marginRight: 14,
  },
  chainIconBadge: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chainBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  chainInfo: {
    flex: 1,
  },
  chainName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0F172A',
  },
  chainNameActive: {
    color: colors.primaryDark,
  },
  chainCurrency: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  checkMark: {
    fontSize: 18,
    color: colors.primary,
    fontWeight: '700',
  },
});
