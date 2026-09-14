/**
 * Chat and Messaging Domain Models
 * Aligned with web3-chat-worker (D1 + R2) and local-first architecture.
 */

export type ConversationType = 'dm' | 'group';

export type MessageType = 'text' | 'voice' | 'image' | 'file' | 'packet' | 'system';

export type RetentionType = 'permanent' | 'on_read';

export type MessageStatus = 'pending' | 'sent' | 'delivered' | 'read' | 'recalled';

export interface ChatMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  type: MessageType;
  content: string | null;
  retention: RetentionType;
  status: MessageStatus;
  expires_at: number;
  delivered_at: number | null;
  read_at: number | null;
  created_at: number;
  recalled_at?: number | null;
  burn_after_seconds?: number | null;
  mentions?: string[] | null;
  metadata?: Record<string, any> | null;
}

export interface Conversation {
  id: string;
  type: ConversationType;
  title: string;
  avatar?: string | null;
  last_message?: string | null;
  last_message_at?: number | null;
  unread_count: number;
  updated_at: number;
  peer_address?: string;
  group_id?: string;
}

export interface MessageReceipt {
  id: string;
  message_id: string;
  user_id: string;
  status: 'delivered' | 'read';
  timestamp: number;
}

export interface SyncResult {
  messages: ChatMessage[];
  receipts: MessageReceipt[];
  recalls: Array<{ id: string; recalled_at: number }>;
  last_timestamp: number;
}

/**
 * Generate deterministic canonical Direct Message conversation ID:
 * dm:minAddress:maxAddress (lower-cased)
 */
export function getDirectConversationId(addrA: string, addrB: string): string {
  const a = addrA.toLowerCase().trim();
  const b = addrB.toLowerCase().trim();
  if (a < b) {
    return `dm:${a}:${b}`;
  }
  return `dm:${b}:${a}`;
}

/**
 * Parse conversation ID to extract type and identifiers
 */
export function parseConversationId(id: string): {
  type: ConversationType;
  peerAddress?: string;
  groupId?: string;
  participants?: [string, string];
} {
  if (id.startsWith('dm:')) {
    const parts = id.split(':');
    if (parts.length === 3) {
      return {
        type: 'dm',
        participants: [parts[1], parts[2]],
      };
    }
  } else if (id.startsWith('group:')) {
    const groupId = id.slice(6);
    return {
      type: 'group',
      groupId,
    };
  }
  return {
    type: 'dm',
  };
}

/**
 * Check if conversation ID is a direct message
 */
export function isDirectConversationId(id: string): boolean {
  return id.startsWith('dm:');
}
