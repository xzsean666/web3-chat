import type { WorkerApiClient } from '../../services/worker/WorkerApiClient';
import type { MessageRepository } from '../../services/storage/repositories/MessageRepo';
import type { ConversationRepository } from '../../services/storage/repositories/ConversationRepo';
import type { SyncCheckpointRepository } from '../../services/storage';
import type { AuthService } from '../../services/worker/AuthService';
import type { ChatMessage, SyncResult } from '../../types';
import { parseConversationId } from '../../types/chat';

export type SyncListener = (result: SyncResult) => void;

export class PeriodicSyncService {
  private workerClient: WorkerApiClient;
  private messageRepo: MessageRepository;
  private convRepo: ConversationRepository;
  private syncCheckpointRepo: SyncCheckpointRepository;
  private authService: AuthService;

  private isSyncing = false;
  private timer: NodeJS.Timeout | null = null;
  private syncListeners: Set<SyncListener> = new Set();

  constructor(
    workerClient: WorkerApiClient,
    messageRepo: MessageRepository,
    convRepo: ConversationRepository,
    syncCheckpointRepo: SyncCheckpointRepository,
    authService: AuthService,
  ) {
    this.workerClient = workerClient;
    this.messageRepo = messageRepo;
    this.convRepo = convRepo;
    this.syncCheckpointRepo = syncCheckpointRepo;
    this.authService = authService;
  }

  public subscribeSync(listener: SyncListener): () => void {
    this.syncListeners.add(listener);
    return () => {
      this.syncListeners.delete(listener);
    };
  }

  private notifySync(result: SyncResult): void {
    this.syncListeners.forEach((l) => {
      try {
        l(result);
      } catch {
        // Ignore listener error
      }
    });
  }

  /**
   * Start background polling timer (default 8000ms)
   */
  public startPolling(intervalMs: number = 8000): void {
    this.stopPolling();
    this.timer = setInterval(() => {
      this.syncOnce().catch(() => {});
    }, intervalMs);
  }

  /**
   * Stop background polling timer
   */
  public stopPolling(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /**
   * Execute single incremental sync run with mutex lock
   */
  public async syncOnce(): Promise<SyncResult | null> {
    if (this.isSyncing) {
      return null;
    }

    const isAuthed = await this.authService.isAuthenticated();
    if (!isAuthed) {
      return null;
    }

    this.isSyncing = true;
    try {
      const session = await this.authService.getSession();
      const myAddress = (session?.wallet_address || '').toLowerCase();
      const lastTs = await this.syncCheckpointRepo.getLastSyncTimestamp();

      const syncRes = await this.workerClient.sync(lastTs, 100);

      // 1. Process new/updated messages concurrently
      const acksToSend: string[] = [];
      const newMessages: ChatMessage[] = [];
      const statusUpdates: Array<{ id: string; status: any; delivered_at?: number; read_at?: number }> = [];

      const existingMessages = await Promise.all(
        syncRes.messages.map((m) => this.messageRepo.getMessage(m.id)),
      );

      for (let i = 0; i < syncRes.messages.length; i++) {
        const msg = syncRes.messages[i];
        const existing = existingMessages[i];

        if (!existing) {
          newMessages.push(msg);
          const isFromMe = msg.sender_id.toLowerCase() === myAddress;
          await this.processConversationUpdate(msg, !isFromMe);

          if (!isFromMe) {
            acksToSend.push(msg.id);
          }
        } else if (existing.status !== msg.status) {
          statusUpdates.push({
            id: msg.id,
            status: msg.status,
            delivered_at: msg.delivered_at ?? undefined,
            read_at: msg.read_at ?? undefined,
          });
        }
      }

      if (newMessages.length > 0) {
        await this.messageRepo.batchInsertMessages(newMessages);
      }

      if (statusUpdates.length > 0) {
        await Promise.all(
          statusUpdates.map((su) =>
            this.messageRepo.updateMessageStatus(su.id, su.status, {
              delivered_at: su.delivered_at,
              read_at: su.read_at,
            }),
          ),
        );
      }

      // Batch send delivery ACKs
      if (acksToSend.length > 0) {
        try {
          await this.workerClient.ackMessagesBatch(acksToSend);
        } catch {
          // Non-blocking error
        }
      }

      // 2. Process delivery & read receipts in parallel
      if (syncRes.receipts.length > 0) {
        await Promise.all(
          syncRes.receipts.map((receipt) =>
            this.messageRepo.updateMessageStatus(receipt.message_id, receipt.status, {
              [receipt.status === 'read' ? 'read_at' : 'delivered_at']: receipt.timestamp,
            }),
          ),
        );
      }

      // 3. Process recalls in parallel
      if (syncRes.recalls.length > 0) {
        await Promise.all(
          syncRes.recalls.map((recall) =>
            this.messageRepo.recallMessage(recall.id, recall.recalled_at),
          ),
        );
      }

      // 4. Update sync timestamp checkpoint
      if (syncRes.last_timestamp > lastTs) {
        await this.syncCheckpointRepo.setLastSyncTimestamp(syncRes.last_timestamp);
      }

      this.notifySync(syncRes);
      return syncRes;
    } finally {
      this.isSyncing = false;
    }
  }

  private async processConversationUpdate(msg: ChatMessage, incrementUnread: boolean): Promise<void> {
    const convId = msg.conversation_id;
    let conv = await this.convRepo.getConversation(convId);

    const now = msg.created_at || Math.floor(Date.now() / 1000);
    const textPreview = msg.type === 'packet' ? '[🧧 Token Red Packet]' : (msg.content || '');

    if (!conv) {
      const parsed = parseConversationId(convId);
      const isDm = parsed.type === 'dm';
      const peer = isDm && parsed.participants ? parsed.participants[0] : undefined;

      conv = {
        id: convId,
        type: isDm ? 'dm' : 'group',
        title: isDm ? (peer ? `${peer.slice(0, 6)}...${peer.slice(-4)}` : 'Chat') : `Group ${parsed.groupId}`,
        last_message: textPreview,
        last_message_at: now,
        unread_count: incrementUnread ? 1 : 0,
        updated_at: now,
        peer_address: peer,
        group_id: parsed.groupId,
      };
    } else {
      conv.last_message = textPreview;
      conv.last_message_at = now;
      conv.updated_at = now;
      if (incrementUnread) {
        conv.unread_count = (conv.unread_count || 0) + 1;
      }
    }

    await this.convRepo.upsertConversation(conv);
  }
}
