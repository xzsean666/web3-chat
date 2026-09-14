import React, { useState } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  Text,
  StyleSheet,
} from 'react-native';
import { colors } from '../../../theme/colors';

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

  return (
    <View style={styles.container} testID="chat-input-bar">
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={text}
          onChangeText={setText}
          placeholder={burnOnRead ? '🔥 Ephemeral (Burns 30s after read)...' : 'Type a message...'}
          placeholderTextColor={colors.textTertiary}
          multiline
          maxLength={1000}
          editable={!disabled}
          testID="chat-input-field"
        />

        <TouchableOpacity
          style={styles.moreButton}
          onPress={() => setShowMenu(!showMenu)}
          testID="chat-input-more-btn"
        >
          <Text style={styles.moreButtonText}>＋</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.sendButton, (!text.trim() || disabled) && styles.sendButtonDisabled]}
          onPress={handleSend}
          disabled={!text.trim() || disabled}
          testID="chat-send-btn"
        >
          <Text style={styles.sendButtonText}>Send</Text>
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
          >
            <View style={[styles.menuIconContainer, { backgroundColor: colors.redPacketBg }]}>
              <Text style={styles.menuItemIcon}>🧧</Text>
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
          >
            <View
              style={[
                styles.menuIconContainer,
                { backgroundColor: burnOnRead ? colors.badgeRed : '#7F7F7F' },
              ]}
            >
              <Text style={styles.menuItemIcon}>🔥</Text>
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
    backgroundColor: colors.backgroundLight,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  input: {
    flex: 1,
    minHeight: 38,
    maxHeight: 100,
    backgroundColor: colors.surface,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 16,
    color: colors.textPrimary,
  },
  moreButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  moreButtonText: {
    fontSize: 20,
    color: colors.textSecondary,
    lineHeight: 22,
  },
  sendButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 6,
    marginLeft: 8,
  },
  sendButtonDisabled: {
    backgroundColor: colors.border,
  },
  sendButtonText: {
    color: colors.textInverse,
    fontWeight: '600',
    fontSize: 14,
  },
  menuPanel: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: colors.backgroundLight,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.borderLight,
  },
  menuItem: {
    alignItems: 'center',
    marginRight: 24,
  },
  menuIconContainer: {
    width: 52,
    height: 52,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuItemIcon: {
    fontSize: 26,
  },
  menuItemLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 6,
  },
});
