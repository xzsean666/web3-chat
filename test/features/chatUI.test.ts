import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { MessageBubble, canRecallMessage } from '../../src/features/chat/components/MessageBubble';
import { ChatInputBar } from '../../src/features/chat/components/ChatInputBar';
import { ConversationListScreen } from '../../src/features/chat/screens/ConversationListScreen';
import { ChatDetailScreen } from '../../src/features/chat/screens/ChatDetailScreen';
import type { ChatMessage, Conversation } from '../../src/types';

describe('Chat UI Components & Conversation Screens (TASK-009)', () => {
  const baseMessage: ChatMessage = {
    id: 'msg-1',
    conversation_id: 'dm:0x1:0x2',
    sender_id: '0x1111111111111111111111111111111111111111',
    type: 'text',
    content: 'Hello Web3',
    retention: 'permanent',
    status: 'sent',
    expires_at: 0,
    delivered_at: 1000,
    read_at: null,
    created_at: 1000,
  };

  describe('30-Second Message Recall Eligibility', () => {
    it('should allow recall within 30 seconds', () => {
      expect(canRecallMessage(baseMessage, 1010)).toBe(true);
      expect(canRecallMessage(baseMessage, 1030)).toBe(true);
    });

    it('should reject recall after 30 seconds', () => {
      expect(canRecallMessage(baseMessage, 1031)).toBe(false);
      expect(canRecallMessage(baseMessage, 1100)).toBe(false);
    });

    it('should reject recall if already recalled', () => {
      const recalledMsg: ChatMessage = { ...baseMessage, status: 'recalled' };
      expect(canRecallMessage(recalledMsg, 1010)).toBe(false);
    });
  });

  describe('MessageBubble Component', () => {
    it('should render message bubble for sender (self)', () => {
      const element = MessageBubble({ message: baseMessage, isSelf: true });
      expect(React.isValidElement(element)).toBe(true);
      if (React.isValidElement(element)) {
        expect(element.props.testID).toBe('message-bubble-row');
      }
    });

    it('should render recalled banner if message is recalled', () => {
      const recalledMsg: ChatMessage = { ...baseMessage, status: 'recalled' };
      const element = MessageBubble({ message: recalledMsg, isSelf: true });
      expect(React.isValidElement(element)).toBe(true);
      if (React.isValidElement(element)) {
        expect(element.props.testID).toBe('message-recalled');
      }
    });

    it('should render red packet card for packet message type', () => {
      const packetMsg: ChatMessage = {
        ...baseMessage,
        type: 'packet',
        metadata: {
          packet: {
            wishText: 'Happy Web3 New Year',
            tokenSymbol: 'USDT',
          },
        },
      };

      const element = MessageBubble({ message: packetMsg, isSelf: false });
      expect(React.isValidElement(element)).toBe(true);
      if (React.isValidElement(element)) {
        expect(element.props.testID).toBe('message-bubble-row');
      }
    });
  });

  describe('ChatInputBar Component', () => {
    it('should create valid ReactElement with ChatInputBar', () => {
      const element = React.createElement(ChatInputBar, { onSend: vi.fn() });
      expect(React.isValidElement(element)).toBe(true);
      expect(element.type).toBe(ChatInputBar);
    });
  });

  describe('ConversationListScreen Component', () => {
    it('should render list of conversations', () => {
      const convs: Conversation[] = [
        {
          id: 'dm:0x1:0x2',
          type: 'dm',
          title: 'Alice',
          unread_count: 2,
          last_message: 'Hi there',
          last_message_at: 1000,
          updated_at: 1000,
        },
      ];

      const element = ConversationListScreen({
        conversations: convs,
        onSelectConversation: () => {},
      });

      expect(React.isValidElement(element)).toBe(true);
      if (React.isValidElement(element)) {
        expect(element.props.testID).toBe('conversation-list-screen');
      }
    });
  });

  describe('ChatDetailScreen Component', () => {
    it('should create valid ReactElement with ChatDetailScreen', () => {
      const conv: Conversation = {
        id: 'dm:0x1:0x2',
        type: 'dm',
        title: 'Alice',
        unread_count: 0,
        updated_at: 1000,
      };

      const element = React.createElement(ChatDetailScreen, {
        conversation: conv,
        messages: [baseMessage],
        currentWalletAddress: '0x1111111111111111111111111111111111111111',
        onBack: vi.fn(),
        onSendMessage: vi.fn(),
      });

      expect(React.isValidElement(element)).toBe(true);
      expect(element.type).toBe(ChatDetailScreen);
    });
  });
});
