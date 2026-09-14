import React, { useState, useCallback } from 'react';
import {
  View,
  FlatList,
  Modal,
  TouchableOpacity,
  Text,
  StyleSheet,
  SafeAreaView,
  Alert,
} from 'react-native';
import { colors } from '../../../theme/colors';
import { HeaderBar } from '../../../components/common/HeaderBar';
import { MessageBubble, MemoMessageBubble, canRecallMessage } from '../components/MessageBubble';
import { ChatInputBar } from '../components/ChatInputBar';
import type { ChatMessage, Conversation } from '../../../types';

export interface ChatDetailScreenProps {
  conversation: Conversation;
  messages: ChatMessage[];
  currentWalletAddress: string;
  onBack: () => void;
  onSendMessage: (text: string, options?: { retention?: 'permanent' | 'on_read'; burn_after_seconds?: number }) => void;
  onRecallMessage?: (messageId: string) => void;
  onOpenRedPacket?: () => void;
  onClaimRedPacket?: (packetData: any) => void;
}

export const ChatDetailScreen: React.FC<ChatDetailScreenProps> = ({
  conversation,
  messages,
  currentWalletAddress,
  onBack,
  onSendMessage,
  onRecallMessage,
  onOpenRedPacket,
  onClaimRedPacket,
}) => {
  const [selectedMessage, setSelectedMessage] = useState<ChatMessage | null>(null);

  const myAddr = currentWalletAddress.toLowerCase();

  const handleLongPressMessage = useCallback((msg: ChatMessage) => {
    setSelectedMessage(msg);
  }, []);

  const renderMessageItem = useCallback(
    ({ item }: { item: ChatMessage }) => (
      <MemoMessageBubble
        message={item}
        isSelf={item.sender_id.toLowerCase() === myAddr}
        onLongPress={handleLongPressMessage}
        onPressPacket={onClaimRedPacket}
      />
    ),
    [myAddr, handleLongPressMessage, onClaimRedPacket],
  );

  const keyExtractor = useCallback((item: ChatMessage) => item.id, []);

  const handleRecall = () => {
    if (selectedMessage && onRecallMessage) {
      onRecallMessage(selectedMessage.id);
      setSelectedMessage(null);
    }
  };

  const isEligibleForRecall =
    selectedMessage &&
    selectedMessage.sender_id.toLowerCase() === myAddr &&
    canRecallMessage(selectedMessage);

  return (
    <SafeAreaView style={styles.safeArea} testID="chat-detail-screen">
      <HeaderBar
        title={conversation.title}
        subtitle={conversation.type === 'dm' ? conversation.peer_address : undefined}
        leftAction={{
          label: '‹ Back',
          onPress: onBack,
        }}
        rightActions={[
          { label: '···', onPress: () => {} },
        ]}
      />

      <FlatList
        data={messages}
        keyExtractor={keyExtractor}
        renderItem={renderMessageItem}
        contentContainerStyle={styles.messageListContent}
        testID="chat-message-list"
        initialNumToRender={15}
        maxToRenderPerBatch={10}
        windowSize={7}
        removeClippedSubviews={true}
      />

      <ChatInputBar
        onSend={onSendMessage}
        onOpenRedPacket={onOpenRedPacket}
      />

      {/* Message Action Modal */}
      <Modal
        visible={selectedMessage !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedMessage(null)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setSelectedMessage(null)}
          testID="message-action-modal-overlay"
        >
          <View style={styles.modalMenu} testID="message-action-menu">
            <TouchableOpacity
              style={styles.modalMenuItem}
              onPress={() => setSelectedMessage(null)}
              testID="action-copy-btn"
            >
              <Text style={styles.modalMenuText}>Copy</Text>
            </TouchableOpacity>

            {isEligibleForRecall && (
              <TouchableOpacity
                style={styles.modalMenuItem}
                onPress={handleRecall}
                testID="action-recall-btn"
              >
                <Text style={[styles.modalMenuText, styles.recallText]}>Recall (30s)</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[styles.modalMenuItem, styles.cancelItem]}
              onPress={() => setSelectedMessage(null)}
              testID="action-cancel-btn"
            >
              <Text style={styles.modalMenuText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.backgroundLight,
  },
  messageListContent: {
    paddingVertical: 12,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalMenu: {
    width: 220,
    backgroundColor: colors.surface,
    borderRadius: 12,
    overflow: 'hidden',
    elevation: 8,
  },
  modalMenuItem: {
    paddingVertical: 14,
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderLight,
  },
  modalMenuText: {
    fontSize: 16,
    color: colors.textPrimary,
  },
  recallText: {
    color: colors.badgeRed,
    fontWeight: '600',
  },
  cancelItem: {
    borderBottomWidth: 0,
    backgroundColor: colors.surfaceSubtle,
  },
});
