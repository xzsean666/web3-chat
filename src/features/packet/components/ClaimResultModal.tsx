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
              <Icon name="close" size={20} color="rgba(255, 255, 255, 0.85)" />
            </TouchableOpacity>
            <View style={styles.avatarCircle}>
              <Icon name="gift" size={24} color="#D44A26" strokeWidth={2.4} />
            </View>
          </View>

          <View style={styles.body}>
            <Text style={styles.wishText}>{payload.wishText}</Text>
            <Text style={styles.typeText}>
              {payload.tokenSymbol} LuckyDrop Red Packet
            </Text>

            {claimedAmount ? (
              <View style={styles.amountContainer} testID="claimed-amount-display">
                <Text style={styles.amountNumber}>{claimedAmount}</Text>
                <Text style={styles.amountUnit}>{payload.tokenSymbol}</Text>
                <View style={styles.badgeSuccess}>
                  <Icon name="check" size={12} color="#07C160" strokeWidth={3} />
                  <Text style={styles.successNote}>Deposited to your Web3 wallet</Text>
                </View>
              </View>
            ) : (
              <View style={styles.actionContainer}>
                <TouchableOpacity
                  style={[styles.openButton, isClaiming && styles.openButtonDisabled]}
                  onPress={onClaim}
                  disabled={isClaiming}
                  testID="btn-open-packet"
                  activeOpacity={0.85}
                >
                  <Text style={styles.openButtonText}>
                    {isClaiming ? '...' : '開'}
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
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    width: 300,
    backgroundColor: '#FA4E38',
    borderRadius: radii.xl,
    overflow: 'hidden',
    alignItems: 'center',
    ...shadows.modal,
  },
  topCurvedHeader: {
    width: '100%',
    height: 104,
    backgroundColor: '#D33620',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    borderBottomLeftRadius: 150,
    borderBottomRightRadius: 150,
  },
  closeBtn: {
    position: 'absolute',
    top: 14,
    right: 14,
    padding: 4,
  },
  avatarCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#FDE49E',
    borderWidth: 2,
    borderColor: '#F5CD6D',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'absolute',
    bottom: -26,
    ...shadows.card,
  },
  body: {
    paddingTop: 38,
    paddingBottom: 32,
    paddingHorizontal: 20,
    alignItems: 'center',
    width: '100%',
  },
  wishText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FDE49E',
    textAlign: 'center',
    marginBottom: 4,
    letterSpacing: -0.1,
  },
  typeText: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.85)',
    marginBottom: 20,
    fontWeight: '500',
  },
  actionContainer: {
    alignItems: 'center',
  },
  openButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#FDE49E',
    borderWidth: 2,
    borderColor: '#F5CD6D',
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.floating,
  },
  openButtonDisabled: {
    opacity: 0.7,
  },
  openButtonText: {
    fontSize: 28,
    fontWeight: '800',
    color: '#D44A26',
  },
  openHint: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.75)',
    marginTop: 14,
    fontWeight: '500',
  },
  amountContainer: {
    alignItems: 'center',
    marginTop: 8,
  },
  amountNumber: {
    fontSize: 38,
    fontWeight: '800',
    color: '#FDE49E',
    letterSpacing: -0.5,
  },
  amountUnit: {
    fontSize: 15,
    color: '#FFFFFF',
    fontWeight: '600',
    marginTop: 2,
  },
  badgeSuccess: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.full,
    marginTop: 14,
    gap: 5,
  },
  successNote: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '500',
    marginLeft: 4,
  },
});
