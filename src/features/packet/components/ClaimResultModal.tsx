import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
import { colors } from '../../../theme/colors';
import type { PacketMessagePayload } from '../../../types';

export interface ClaimResultModalProps {
  visible: boolean;
  onClose: () => void;
  payload: PacketMessagePayload | null;
  claimedAmount?: string; // Formatted claim amount (e.g. "1.5")
  onClaim?: () => void;
  isClaiming?: boolean;
}

export const ClaimResultModal: React.FC<ClaimResultModalProps> = ({
  visible,
  onClose,
  payload,
  claimedAmount,
  onClaim,
  isClaiming = false,
}) => {
  if (!payload) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay} testID="claim-result-modal">
        <View style={styles.container}>
          {/* Top curve decoration */}
          <View style={styles.topCurvedHeader}>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose} testID="btn-close-claim-modal">
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarEmoji}>🧧</Text>
            </View>
          </View>

          <View style={styles.body}>
            <Text style={styles.wishText}>{payload.wishText}</Text>
            <Text style={styles.typeText}>
              {payload.tokenSymbol} Red Packet
            </Text>

            {claimedAmount ? (
              <View style={styles.amountContainer} testID="claimed-amount-display">
                <Text style={styles.amountNumber}>{claimedAmount}</Text>
                <Text style={styles.amountUnit}>{payload.tokenSymbol}</Text>
                <Text style={styles.successNote}>Deposited to your Web3 wallet</Text>
              </View>
            ) : (
              <View style={styles.actionContainer}>
                <TouchableOpacity
                  style={[styles.openButton, isClaiming && styles.openButtonDisabled]}
                  onPress={onClaim}
                  disabled={isClaiming}
                  testID="btn-open-packet"
                >
                  <Text style={styles.openButtonText}>
                    {isClaiming ? 'Claiming...' : '開'}
                  </Text>
                </TouchableOpacity>
                <Text style={styles.openHint}>Tap to claim tokens on-chain</Text>
              </View>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    width: 290,
    backgroundColor: colors.redPacketBg,
    borderRadius: 16,
    overflow: 'hidden',
    alignItems: 'center',
    ...Platform.select({
      web: { boxShadow: '0px 4px 10px rgba(0, 0, 0, 0.3)' } as any,
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 10,
        elevation: 10,
      },
    }),
  },
  topCurvedHeader: {
    width: '100%',
    height: 100,
    backgroundColor: colors.redPacketDark,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    borderBottomLeftRadius: 145,
    borderBottomRightRadius: 145,
  },
  closeBtn: {
    position: 'absolute',
    top: 12,
    right: 14,
  },
  closeBtnText: {
    fontSize: 18,
    color: 'rgba(255,255,255,0.7)',
  },
  avatarCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'absolute',
    bottom: -25,
    ...Platform.select({
      web: { boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.15)' } as any,
      default: {
        shadowColor: '#000',
        shadowOpacity: 0.15,
        shadowRadius: 4,
        elevation: 3,
      },
    }),
  },
  avatarEmoji: {
    fontSize: 26,
  },
  body: {
    paddingTop: 36,
    paddingBottom: 32,
    paddingHorizontal: 20,
    alignItems: 'center',
    width: '100%',
  },
  wishText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.redPacketGold,
    textAlign: 'center',
    marginBottom: 4,
  },
  typeText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.85)',
    marginBottom: 20,
  },
  actionContainer: {
    alignItems: 'center',
  },
  openButton: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: colors.redPacketGold,
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      web: { boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.25)' } as any,
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
        elevation: 5,
      },
    }),
  },
  openButtonDisabled: {
    opacity: 0.7,
  },
  openButtonText: {
    fontSize: 26,
    fontWeight: '800',
    color: colors.redPacketDark,
  },
  openHint: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 12,
  },
  amountContainer: {
    alignItems: 'center',
    marginTop: 10,
  },
  amountNumber: {
    fontSize: 36,
    fontWeight: '800',
    color: colors.redPacketGold,
  },
  amountUnit: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
    marginTop: 2,
  },
  successNote: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 10,
  },
});
