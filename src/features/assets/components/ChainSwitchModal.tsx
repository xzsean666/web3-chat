import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { colors } from '../../../theme/colors';
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

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay} testID="chain-switch-modal">
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.title}>Select Network</Text>
            <TouchableOpacity onPress={onClose} testID="btn-close-chain-modal">
              <Text style={styles.closeText}>✕</Text>
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
                >
                  <View style={styles.chainIconContainer}>
                    <Text style={styles.chainIcon}>
                      {chain.chainId === 97 ? '🟡' : chain.chainId === 31337 ? '⚙️' : '🔷'}
                    </Text>
                  </View>

                  <View style={styles.chainInfo}>
                    <Text style={[styles.chainName, isSelected && styles.chainNameActive]}>
                      {chain.name}
                    </Text>
                    <Text style={styles.chainCurrency}>
                      Native: {chain.nativeCurrency.symbol} (Chain ID: {chain.chainId})
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
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 20,
    paddingBottom: 36,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  closeText: {
    fontSize: 18,
    color: colors.textSecondary,
  },
  chainList: {
    marginTop: 4,
  },
  chainItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 8,
    backgroundColor: colors.backgroundLight,
  },
  chainItemActive: {
    backgroundColor: '#EBF8F0',
    borderWidth: 1,
    borderColor: colors.primary,
  },
  chainIconContainer: {
    marginRight: 12,
  },
  chainIcon: {
    fontSize: 24,
  },
  chainInfo: {
    flex: 1,
  },
  chainName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  chainNameActive: {
    color: colors.primaryDark,
  },
  chainCurrency: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  checkMark: {
    fontSize: 18,
    color: colors.primary,
    fontWeight: '700',
  },
});
