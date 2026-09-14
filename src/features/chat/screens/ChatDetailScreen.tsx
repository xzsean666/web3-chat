import React, { useState, useCallback } from 'react';
import {
  View,
  FlatList,
  Modal,
  TouchableOpacity,
  Text,
  StyleSheet,
  SafeAreaView,
} from 'react-native';
import { colors } from '../../../theme/colors';
import { HeaderBar } from '../../../components/common/HeaderBar';
import { MessageBubble, MemoMessageBubble, canRecallMessage } from '../components/MessageBubble';
import { ChatInputBar } from '../components/ChatInputBar';
import { Icon } from '../../../components/common/Icon';
import { radii, shadows } from '../../../theme/design';
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

  const formatSubtitle = () => {
    if (conversation.type === 'dm' && conversation.peer_address) {
      const addr = conversation.peer_address;
      if (addr.length > 12) {
        return `${addr.slice(0, 6)}...${addr.slice(-4)} • BSC`;
      }
      return addr;
    }
    return undefined;
  };

  return (
    <SafeAreaView style={styles.safeArea} testID="chat-detail-screen">
      <HeaderBar
        title={conversation.title}
        subtitle={formatSubtitle()}
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
        style={styles.messageList}
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
              <Icon name="copy" size={18} color="#0F172A" />
              <Text style={styles.modalMenuText}>Copy Message</Text>
            </TouchableOpacity>

            {isEligibleForRecall && (
              <TouchableOpacity
                style={styles.modalMenuItem}
                onPress={handleRecall}
                testID="action-recall-btn"
              >
                <Icon name="clock" size={18} color="#EF4444" />
                <Text style={[styles.modalMenuText, styles.recallText]}>Recall (within 30s)</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[styles.modalMenuItem, styles.cancelItem]}
              onPress={() => setSelectedMessage(null)}
              testID="action-cancel-btn"
            >
              <Text style={styles.cancelText}>Cancel</Text>
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
    backgroundColor: '#EDEDED',
  },
  messageList: {
    flex: 1,
    backgroundColor: '#EDEDED',
  },
  messageListContent: {
    paddingVertical: 14,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalMenu: {
    width: 240,
    backgroundColor: '#FFFFFF',
    borderRadius: radii.lg,
    overflow: 'hidden',
    ...shadows.modal,
  },
  modalMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0, 0, 0, 0.06)',
    gap: 12,
  },
  modalMenuText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#0F172A',
    marginLeft: 8,
  },
  recallText: {
    color: '#EF4444',
  },
  cancelItem: {
    borderBottomWidth: 0,
    backgroundColor: '#F8FAFC',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelText: {
    fontSize: 15,
    color: '#64748B',
    fontWeight: '500',
  },
});
