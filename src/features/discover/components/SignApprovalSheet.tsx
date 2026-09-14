import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { colors } from '../../../theme/colors';

export interface SignApprovalSheetProps {
  visible: boolean;
  method: string;
  origin?: string;
  params: any[];
  onApprove: () => void;
  onReject: () => void;
}

export const SignApprovalSheet: React.FC<SignApprovalSheetProps> = ({
  visible,
  method,
  origin,
  params,
  onApprove,
  onReject,
}) => {
  const isTransaction = method === 'eth_sendTransaction';
  const title = isTransaction ? 'Confirm Transaction' : 'Signature Request';

  const formatPayloadPreview = (): string => {
    try {
      if (isTransaction && params[0]) {
        const tx = params[0];
        return `To: ${tx.to}\nValue: ${tx.value || '0'} wei\nData: ${tx.data || '0x'}`;
      }
      return JSON.stringify(params, null, 2);
    } catch {
      return String(params);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onReject}>
      <View style={styles.overlay} testID="sign-approval-sheet">
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.title}>{title}</Text>
            {origin && <Text style={styles.originText}>{origin}</Text>}
          </View>

          <View style={styles.methodBadge}>
            <Text style={styles.methodText}>{method}</Text>
          </View>

          <Text style={styles.sectionLabel}>Request Details</Text>
          <ScrollView style={styles.payloadScroll}>
            <Text style={styles.payloadText}>{formatPayloadPreview()}</Text>
          </ScrollView>

          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={styles.rejectButton}
              onPress={onReject}
              testID="btn-reject-approval"
            >
              <Text style={styles.rejectButtonText}>Reject</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.approveButton}
              onPress={onApprove}
              testID="btn-approve-approval"
            >
              <Text style={styles.approveButtonText}>Approve</Text>
            </TouchableOpacity>
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
    maxHeight: '80%',
  },
  header: {
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  originText: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  methodBadge: {
    alignSelf: 'center',
    backgroundColor: colors.backgroundLight,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    marginBottom: 16,
  },
  methodText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primaryDark,
    fontFamily: 'monospace',
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 6,
  },
  payloadScroll: {
    maxHeight: 180,
    backgroundColor: colors.backgroundLight,
    borderRadius: 8,
    padding: 10,
    marginBottom: 20,
  },
  payloadText: {
    fontSize: 12,
    fontFamily: 'monospace',
    color: colors.textPrimary,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingBottom: 16,
  },
  rejectButton: {
    flex: 1,
    backgroundColor: colors.backgroundLight,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginRight: 10,
  },
  rejectButtonText: {
    color: colors.badgeRed,
    fontSize: 15,
    fontWeight: '600',
  },
  approveButton: {
    flex: 1,
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginLeft: 10,
  },
  approveButtonText: {
    color: colors.textInverse,
    fontSize: 15,
    fontWeight: '600',
  },
});
