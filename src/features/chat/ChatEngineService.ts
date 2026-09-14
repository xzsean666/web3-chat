import type { ConversationRepository } from '../../services/storage/repositories/ConversationRepo';
import type { MessageRepository } from '../../services/storage/repositories/MessageRepo';
import type { WorkerApiClient } from '../../services/worker/WorkerApiClient';
import type { AuthService } from '../../services/worker/AuthService';
import type { ChatMessage, MessageType, RetentionType, Conversation } from '../../types';
import { parseConversationId } from '../../types/chat';

export interface SendMessageOptions {
  type?: MessageType;
  retention?: RetentionType;
  burn_after_seconds?: number;
  mentions?: string[];
  metadata?: Record<string, any>;
}

export type MessageListener = (msg: ChatMessage) => void;

export class ChatEngineService {
  private convRepo: ConversationRepository;
  private msgRepo: MessageRepository;
  private workerClient: WorkerApiClient;
  private authService: AuthService;
  private messageListeners: Set<MessageListener> = new Set();

  constructor(
    convRepo: ConversationRepository,
    msgRepo: MessageRepository,
    workerClient: WorkerApiClient,
    authService: AuthService,
  ) {
    this.convRepo = convRepo;
    this.msgRepo = msgRepo;
    this.workerClient = workerClient;
    this.authService = authService;
  }

  public subscribeMessages(listener: MessageListener): () => void {
    this.messageListeners.add(listener);
    return () => {
      this.messageListeners.delete(listener);
    };
  }

  private notifyMessage(msg: ChatMessage): void {
    this.messageListeners.forEach((l) => {
      try {
        l(msg);
      } catch {
        // Ignore listener error
      }
    });
  }

  /**
   * Send message pipeline:
   * 1. Write locally as 'pending'
   * 2. Update conversation last message
   * 3. Attempt delivery to web3-chat-worker
   * 4. Update status to 'sent' on success
   */
  async sendMessage(
    conversationId: string,
    content: string,
    options: SendMessageOptions = {},
  ): Promise<ChatMessage> {
    const session = await this.authService.getSession();
    const senderAddress = session?.wallet_address || '0x0000000000000000000000000000000000000000';

    const localId = `local_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const now = Math.floor(Date.now() / 1000);

    const pendingMsg: ChatMessage = {
      id: localId,
      conversation_id: conversationId,
      sender_id: senderAddress,
      type: options.type || 'text',
      content,
      retention: options.retention || 'permanent',
      status: 'pending',
      expires_at: 0,
      delivered_at: null,
      read_at: null,
      created_at: now,
      burn_after_seconds: options.burn_after_seconds,
      mentions: options.mentions,
      metadata: options.metadata,
    };

    // 1. Store locally as pending
    await this.msgRepo.insertMessage(pendingMsg);

    // 2. Ensure conversation exists and update preview
    await this.updateConversationPreview(conversationId, content, now);

    this.notifyMessage(pendingMsg);

    // 3. Send to remote Worker
    try {
      const remoteMsg = await this.workerClient.sendMessage(conversationId, {
        content,
        type: options.type,
        metadata: options.metadata,
        retention: options.retention,
        burn_after_seconds: options.burn_after_seconds,
        mentions: options.mentions,
      });

      // Update local message record with remote confirmation
      await this.msgRepo.deleteMessage(localId);

      const confirmedMsg: ChatMessage = {
        ...pendingMsg,
        id: remoteMsg.id || localId,
        status: 'sent',
        created_at: remoteMsg.created_at || now,
      };

      await this.msgRepo.insertMessage(confirmedMsg);
      this.notifyMessage(confirmedMsg);
      return confirmedMsg;
    } catch {
      // Keep as pending for retry
      return pendingMsg;
    }
  }

  /**
   * Retry sending all queued pending messages
   */
  async retryPendingMessages(): Promise<number> {
    const pendingList = await this.msgRepo.getPendingMessages();
    let sentCount = 0;

    for (const msg of pendingList) {
      if (!msg.content) continue;
      try {
        const remoteMsg = await this.workerClient.sendMessage(msg.conversation_id, {
          content: msg.content,
          type: msg.type,
          metadata: msg.metadata ?? undefined,
          retention: msg.retention,
          burn_after_seconds: msg.burn_after_seconds ?? undefined,
          mentions: msg.mentions ?? undefined,
        });

        await this.msgRepo.deleteMessage(msg.id);

        const confirmedMsg: ChatMessage = {
          ...msg,
          id: remoteMsg.id || msg.id,
          status: 'sent',
          created_at: remoteMsg.created_at || msg.created_at,
        };

        await this.msgRepo.insertMessage(confirmedMsg);
        this.notifyMessage(confirmedMsg);
        sentCount++;
      } catch {
        // Stop batch on first network failure
        break;
      }
    }

    return sentCount;
  }

  async markMessageAsRead(messageId: string): Promise<void> {
    const now = Math.floor(Date.now() / 1000);
    await this.msgRepo.updateMessageStatus(messageId, 'read', { read_at: now });

    try {
      await this.workerClient.readMessage(messageId);
    } catch {
      // Ignore network error on read ack
    }
  }

  async recallMessage(messageId: string): Promise<void> {
    const now = Math.floor(Date.now() / 1000);
    await this.msgRepo.recallMessage(messageId, now);

    try {
      await this.workerClient.recallMessage(messageId);
    } catch {
      // Ignore network error
    }
  }

  private async updateConversationPreview(
    conversationId: string,
    lastContent: string,
    timestamp: number,
  ): Promise<void> {
    let conv = await this.convRepo.getConversation(conversationId);
    if (!conv) {
      const parsed = parseConversationId(conversationId);
      const isDm = parsed.type === 'dm';
      const peer = isDm && parsed.participants ? parsed.participants[1] : undefined;

      conv = {
        id: conversationId,
        type: isDm ? 'dm' : 'group',
        title: isDm ? (peer ? `${peer.slice(0, 6)}...${peer.slice(-4)}` : 'Chat') : `Group ${parsed.groupId}`,
        last_message: lastContent,
        last_message_at: timestamp,
        unread_count: 0,
        updated_at: timestamp,
        peer_address: peer,
        group_id: parsed.groupId,
      };
    } else {
      conv.last_message = lastContent;
      conv.last_message_at = timestamp;
      conv.updated_at = timestamp;
    }

    await this.convRepo.upsertConversation(conv);
  }
}
