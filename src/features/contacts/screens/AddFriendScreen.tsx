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
        <Text style={styles.label}>Wallet Address</Text>
        <TextInput
          style={styles.input}
          placeholder="0x... EVM address"
          placeholderTextColor={colors.textTertiary}
          value={address}
          onChangeText={setAddress}
          autoCapitalize="none"
          autoCorrect={false}
          testID="input-friend-address"
        />

        <Text style={styles.label}>Alias / Note (Optional)</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. Alice"
          placeholderTextColor={colors.textTertiary}
          value={alias}
          onChangeText={setAlias}
          testID="input-friend-alias"
        />

        <TouchableOpacity
          style={[styles.submitButton, (!address.trim() || submitting) && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={!address.trim() || submitting}
          testID="btn-submit-add-friend"
        >
          <Text style={styles.submitButtonText}>
            {submitting ? 'Sending...' : 'Send Friend Request'}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.backgroundLight,
  },
  container: {
    padding: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 8,
    marginTop: 12,
  },
  input: {
    backgroundColor: colors.surface,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: colors.textPrimary,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  submitButton: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 30,
  },
  submitButtonDisabled: {
    backgroundColor: colors.border,
  },
  submitButtonText: {
    color: colors.textInverse,
    fontSize: 16,
    fontWeight: '600',
  },
});
