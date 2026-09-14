import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
} from 'react-native';
import { colors } from '../../../theme/colors';
import { HeaderBar } from '../../../components/common/HeaderBar';
import { SignApprovalSheet } from '../components/SignApprovalSheet';
import { handleEip1193Request, type Eip1193Request, type Eip1193Response } from '../bridge/eip1193Bridge';
import type { WalletCoreService } from '../../../services/wallet/WalletCoreService';
import type { EvmService } from '../../../services/evm/EvmService';

export interface DAppBrowserScreenProps {
  url: string;
  title?: string;
  walletAddress: string;
  chainId: number;
  walletCore: WalletCoreService;
  evmService: EvmService;
  onClose: () => void;
}

export const DAppBrowserScreen: React.FC<DAppBrowserScreenProps> = ({
  url,
  title,
  walletAddress,
  chainId,
  walletCore,
  evmService,
  onClose,
}) => {
  const [approvalState, setApprovalState] = useState<{
    visible: boolean;
    method: string;
    params: any[];
    origin?: string;
    resolve?: (approved: boolean) => void;
  }>({
    visible: false,
    method: '',
    params: [],
  });

  const requestUserApproval = (method: string, params: any[], origin?: string): Promise<boolean> => {
    return new Promise((resolve) => {
      setApprovalState({
        visible: true,
        method,
        params,
        origin,
        resolve,
      });
    });
  };

  const handleApprove = () => {
    if (approvalState.resolve) {
      approvalState.resolve(true);
    }
    setApprovalState({ visible: false, method: '', params: [] });
  };

  const handleReject = () => {
    if (approvalState.resolve) {
      approvalState.resolve(false);
    }
    setApprovalState({ visible: false, method: '', params: [] });
  };

  const processRpcMessage = async (msg: Eip1193Request): Promise<Eip1193Response> => {
    return handleEip1193Request(msg, {
      walletAddress,
      chainId,
      walletCore,
      evmService,
      origin: url,
      requestUserApproval,
    });
  };

  return (
    <SafeAreaView style={styles.container} testID="dapp-browser-screen">
      <HeaderBar
        title={title || 'DApp Browser'}
        subtitle={url}
        leftAction={{
          label: '✕ Close',
          onPress: onClose,
        }}
        rightActions={[
          { label: '⟳', onPress: () => {} },
        ]}
      />

      <View style={styles.browserContainer} testID="dapp-webview-container">
        <View style={styles.browserBanner}>
          <Text style={styles.bannerText}>
            Connected as {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)} (Chain ID {chainId})
          </Text>
        </View>

        <View style={styles.placeholderContainer}>
          <Text style={styles.placeholderIcon}>🌐</Text>
          <Text style={styles.placeholderUrl}>{url}</Text>
          <Text style={styles.placeholderNote}>
            Web3 Sandbox Active. EIP-1193 window.ethereum provider ready.
          </Text>
        </View>
      </View>

      {/* Approval Sheet for Transactions and Signatures */}
      <SignApprovalSheet
        visible={approvalState.visible}
        method={approvalState.method}
        origin={approvalState.origin}
        params={approvalState.params}
        onApprove={handleApprove}
        onReject={handleReject}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.backgroundLight,
  },
  browserContainer: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  browserBanner: {
    backgroundColor: '#E8F8F0',
    paddingVertical: 6,
    paddingHorizontal: 12,
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.primary,
  },
  bannerText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primaryDark,
  },
  placeholderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  placeholderIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  placeholderUrl: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 8,
    textAlign: 'center',
  },
  placeholderNote: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
  },
});
