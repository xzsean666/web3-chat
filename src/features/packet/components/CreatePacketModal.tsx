import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Platform,
} from 'react-native';
import { colors } from '../../../theme/colors';
import { PacketType } from '../../../types/packet';
import type { CreateRedPacketOptions } from '../LuckyDropService';

export interface CreatePacketModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (params: CreateRedPacketOptions) => Promise<void> | void;
  defaultTokenAddress?: string;
  defaultTokenSymbol?: string;
}

export const CreatePacketModal: React.FC<CreatePacketModalProps> = ({
  visible,
  onClose,
  onSubmit,
  defaultTokenAddress = '0x337610d27c682E347C9cD60BD4b3b107C9d34dDd',
  defaultTokenSymbol = 'USDT',
}) => {
  const [totalAmount, setTotalAmount] = useState('10');
  const [shares, setShares] = useState('5');
  const [wishText, setWishText] = useState('Best Wishes & Good Luck! 🧧');
  const [packetType, setPacketType] = useState<PacketType>(PacketType.RANDOM);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    const amountNum = parseFloat(totalAmount);
    const sharesNum = parseInt(shares, 10);

    if (isNaN(amountNum) || amountNum <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid amount greater than 0.');
      return;
    }

    if (isNaN(sharesNum) || sharesNum <= 0 || sharesNum > 1000) {
      Alert.alert('Invalid Shares', 'Please enter a valid share count (1 - 1000).');
      return;
    }

    setSubmitting(true);
    try {
      // 18 decimals default conversion
      const rawAmount = BigInt(Math.floor(amountNum * 1e6)) * BigInt(1e12); // e.g. 10 USDT = 10 * 10^18

      await onSubmit({
        tokenAddress: defaultTokenAddress,
        tokenSymbol: defaultTokenSymbol,
        totalAmount: rawAmount.toString(),
        recipientCount: sharesNum,
        packetType,
        wishText: wishText.trim(),
      });
      onClose();
    } catch (err: any) {
      Alert.alert('Failed to Create', err.message || 'Error creating red packet');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay} testID="create-packet-modal">
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.title}>Send Token Red Packet</Text>
            <TouchableOpacity onPress={onClose} testID="btn-close-packet-modal">
              <Text style={styles.closeText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Type Selector: Random vs Fixed */}
          <View style={styles.typeSelectorRow}>
            <TouchableOpacity
              style={[styles.typeButton, packetType === PacketType.RANDOM && styles.typeButtonActive]}
              onPress={() => setPacketType(PacketType.RANDOM)}
              testID="btn-packet-type-random"
            >
              <Text style={[styles.typeButtonText, packetType === PacketType.RANDOM && styles.typeButtonTextActive]}>
                Random (Lucky 拼手气)
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.typeButton, packetType === PacketType.FIXED && styles.typeButtonActive]}
              onPress={() => setPacketType(PacketType.FIXED)}
              testID="btn-packet-type-fixed"
            >
              <Text style={[styles.typeButtonText, packetType === PacketType.FIXED && styles.typeButtonTextActive]}>
                Fixed (Normal 普通)
              </Text>
            </TouchableOpacity>
          </View>

          {/* Amount input */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Total Amount ({defaultTokenSymbol})</Text>
            <TextInput
              style={styles.input}
              value={totalAmount}
              onChangeText={setTotalAmount}
              keyboardType="decimal-pad"
              testID="input-packet-amount"
            />
          </View>

          {/* Recipient count input */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Total Shares (Recipients)</Text>
            <TextInput
              style={styles.input}
              value={shares}
              onChangeText={setShares}
              keyboardType="number-pad"
              testID="input-packet-shares"
            />
          </View>

          {/* Wish text */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Best Wishes</Text>
            <TextInput
              style={styles.input}
              value={wishText}
              onChangeText={setWishText}
              testID="input-packet-wish"
            />
          </View>

          <TouchableOpacity
            style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={submitting}
            testID="btn-submit-create-packet"
          >
            <Text style={styles.submitButtonText}>
              {submitting ? 'Generating Merkle Tree...' : `Send ${totalAmount} ${defaultTokenSymbol}`}
            </Text>
          </TouchableOpacity>
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
  typeSelectorRow: {
    flexDirection: 'row',
    backgroundColor: colors.backgroundLight,
    borderRadius: 8,
    padding: 4,
    marginBottom: 16,
  },
  typeButton: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 6,
  },
  typeButtonActive: {
    backgroundColor: colors.surface,
    ...Platform.select({
      web: { boxShadow: '0px 1px 2px rgba(0, 0, 0, 0.05)' } as any,
      default: {
        shadowColor: '#000',
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 1,
      },
    }),
  },
  typeButtonText: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  typeButtonTextActive: {
    color: colors.redPacketBg,
    fontWeight: '700',
  },
  inputGroup: {
    marginBottom: 14,
  },
  inputLabel: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: 6,
    fontWeight: '500',
  },
  input: {
    backgroundColor: colors.backgroundLight,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: colors.textPrimary,
  },
  submitButton: {
    backgroundColor: colors.redPacketBg,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 10,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: colors.textInverse,
    fontSize: 16,
    fontWeight: '700',
  },
});
