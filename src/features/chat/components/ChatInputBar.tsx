import React, { useState } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  Text,
  StyleSheet,
} from 'react-native';
import { colors } from '../../../theme/colors';
import { Icon } from '../../../components/common/Icon';
import { radii, shadows } from '../../../theme/design';

export interface ChatInputBarProps {
  onSend: (text: string, options?: { retention?: 'permanent' | 'on_read'; burn_after_seconds?: number }) => void;
  onOpenRedPacket?: () => void;
  disabled?: boolean;
}

export const ChatInputBar: React.FC<ChatInputBarProps> = ({
  onSend,
  onOpenRedPacket,
  disabled = false,
}) => {
  const [text, setText] = useState('');
  const [showMenu, setShowMenu] = useState(false);
  const [burnOnRead, setBurnOnRead] = useState(false);

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed || disabled) return;

    onSend(trimmed, {
      retention: burnOnRead ? 'on_read' : 'permanent',
      burn_after_seconds: burnOnRead ? 30 : undefined,
    });
    setText('');
  };

  const hasText = text.trim().length > 0;

  return (
    <View style={styles.container} testID="chat-input-bar">
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={text}
          onChangeText={setText}
          placeholder={burnOnRead ? 'Ephemeral message (burns 30s after read)...' : 'Type a message...'}
          placeholderTextColor="#94A3B8"
          multiline
          maxLength={1000}
          editable={!disabled}
          testID="chat-input-field"
        />

        <TouchableOpacity
          style={styles.moreButton}
          onPress={() => setShowMenu(!showMenu)}
          testID="chat-input-more-btn"
          activeOpacity={0.7}
        >
          <Icon name="plus" size={20} color="#475569" strokeWidth={2.4} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.sendButton, (!hasText || disabled) && styles.sendButtonDisabled]}
          onPress={handleSend}
          disabled={!hasText || disabled}
          testID="chat-send-btn"
          activeOpacity={0.7}
        >
          <Text style={[styles.sendButtonText, (!hasText || disabled) && styles.sendButtonTextDisabled]}>
            Send
          </Text>
        </TouchableOpacity>
      </View>

      {showMenu && (
        <View style={styles.menuPanel} testID="chat-input-menu-panel">
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => {
              setShowMenu(false);
              onOpenRedPacket?.();
            }}
            testID="menu-red-packet-btn"
            activeOpacity={0.7}
          >
            <View style={[styles.menuIconContainer, { backgroundColor: '#FA4E38' }]}>
              <Icon name="gift" size={26} color="#FDE49E" strokeWidth={2.2} />
            </View>
            <Text style={styles.menuItemLabel}>Red Packet</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => {
              setBurnOnRead(!burnOnRead);
              setShowMenu(false);
            }}
            testID="menu-burn-on-read-btn"
            activeOpacity={0.7}
          >
            <View
              style={[
                styles.menuIconContainer,
                { backgroundColor: burnOnRead ? '#EF4444' : '#64748B' },
              ]}
            >
              <Icon name="flame" size={26} color="#FFFFFF" strokeWidth={2.2} />
            </View>
            <Text style={styles.menuItemLabel}>
              {burnOnRead ? 'Burn (Active)' : 'Burn on Read'}
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(0, 0, 0, 0.08)',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 100,
    backgroundColor: '#F1F5F9',
    borderRadius: radii.xl,
    paddingHorizontal: 16,
    paddingVertical: 9,
    fontSize: 15,
    color: '#0F172A',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.04)',
  },
  moreButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  sendButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    height: 38,
    borderRadius: 19,
    marginLeft: 8,
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.subtle,
  },
  sendButtonDisabled: {
    backgroundColor: '#E2E8F0',
  },
  sendButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
  },
  sendButtonTextDisabled: {
    color: '#94A3B8',
  },
  menuPanel: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    paddingVertical: 20,
    backgroundColor: '#F8FAFC',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(0, 0, 0, 0.06)',
  },
  menuItem: {
    alignItems: 'center',
    marginRight: 28,
  },
  menuIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.subtle,
  },
  menuItemLabel: {
    fontSize: 12,
    color: '#475569',
    marginTop: 8,
    fontWeight: '500',
  },
});
