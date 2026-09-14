import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Alert,
} from 'react-native';
import { colors } from '../../../theme/colors';
import { HeaderBar } from '../../../components/common/HeaderBar';
import { Icon } from '../../../components/common/Icon';
import { radii, shadows } from '../../../theme/design';

export interface AddFriendScreenProps {
  onBack: () => void;
  onAddFriend: (address: string, alias?: string) => Promise<void> | void;
}

export const AddFriendScreen: React.FC<AddFriendScreenProps> = ({
  onBack,
  onAddFriend,
}) => {
  const [address, setAddress] = useState('');
  const [alias, setAlias] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    const trimmed = address.trim();
    if (!trimmed.startsWith('0x') || trimmed.length !== 42) {
      Alert.alert('Invalid Address', 'Please enter a valid 42-character 0x EVM address.');
      return;
    }

    setSubmitting(true);
    try {
      await onAddFriend(trimmed, alias.trim() || undefined);
      onBack();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to send friend request');
    } finally {
      setSubmitting(false);
    }
  };

  const isValid = address.trim().length > 0 && !submitting;

  return (
    <SafeAreaView style={styles.safeArea} testID="add-friend-screen">
      <HeaderBar
        title="Add Friend"
        leftAction={{
          label: '‹ Back',
          onPress: onBack,
        }}
      />

      <View style={styles.container}>
        <View style={styles.card}>
          <Text style={styles.label}>Wallet Address</Text>
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              placeholder="0x... EVM address"
              placeholderTextColor="#94A3B8"
              value={address}
              onChangeText={setAddress}
              autoCapitalize="none"
              autoCorrect={false}
              testID="input-friend-address"
            />
          </View>

          <Text style={styles.label}>Alias / Note (Optional)</Text>
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              placeholder="e.g. Alice"
              placeholderTextColor="#94A3B8"
              value={alias}
              onChangeText={setAlias}
              testID="input-friend-alias"
            />
          </View>
        </View>

        <TouchableOpacity
          style={[styles.submitButton, !isValid && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={!isValid}
          testID="btn-submit-add-friend"
          activeOpacity={0.8}
        >
          <Text style={[styles.submitButtonText, !isValid && styles.submitButtonTextDisabled]}>
            {submitting ? 'Sending Request...' : 'Send Friend Request'}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  container: {
    padding: 20,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: radii.lg,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.05)',
    ...shadows.card,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 8,
    marginTop: 12,
  },
  inputContainer: {
    backgroundColor: '#F1F5F9',
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.04)',
    overflow: 'hidden',
  },
  input: {
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 15,
    color: '#0F172A',
  },
  submitButton: {
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 28,
    ...shadows.subtle,
  },
  submitButtonDisabled: {
    backgroundColor: '#E2E8F0',
    elevation: 0,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  submitButtonTextDisabled: {
    color: '#94A3B8',
  },
});
