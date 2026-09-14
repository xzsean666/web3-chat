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
import { Icon } from '../../../components/common/Icon';
import { radii, shadows } from '../../../theme/design';

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
          <View style={styles.handleBar} />

          <View style={styles.header}>
            <View style={styles.shieldIconContainer}>
              <Icon
                name={isTransaction ? 'shield-alert' : 'shield-check'}
                size={28}
                color={isTransaction ? '#F59E0B' : colors.primary}
                strokeWidth={2.2}
              />
            </View>
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
              activeOpacity={0.8}
            >
              <Text style={styles.rejectButtonText}>Reject</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.approveButton}
              onPress={onApprove}
              testID="btn-approve-approval"
              activeOpacity={0.8}
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
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: radii.xxl,
    borderTopRightRadius: radii.xxl,
    paddingHorizontal: 20,
    paddingBottom: 28,
    paddingTop: 10,
    maxHeight: '82%',
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
    alignItems: 'center',
    marginBottom: 14,
  },
  shieldIconContainer: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#F0FDF4',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
    letterSpacing: -0.2,
  },
  originText: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 4,
    fontWeight: '500',
  },
  methodBadge: {
    alignSelf: 'center',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: radii.sm,
    marginBottom: 16,
  },
  methodText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0284C7',
    fontFamily: 'monospace',
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 8,
  },
  payloadScroll: {
    maxHeight: 180,
    backgroundColor: '#F8FAFC',
    borderRadius: radii.md,
    padding: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.05)',
  },
  payloadText: {
    fontSize: 12,
    fontFamily: 'monospace',
    color: '#334155',
    lineHeight: 18,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  rejectButton: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    borderRadius: radii.md,
    paddingVertical: 14,
    alignItems: 'center',
  },
  rejectButtonText: {
    color: '#EF4444',
    fontSize: 15,
    fontWeight: '600',
  },
  approveButton: {
    flex: 1,
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    paddingVertical: 14,
    alignItems: 'center',
    ...shadows.subtle,
  },
  approveButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
});
