import type { ChatMessage, MessageReceipt, SyncResult, MessageType } from '../../types';

export interface WorkerApiOptions {
  baseUrl?: string;
  getToken?: () => Promise<string | null>;
  timeoutMs?: number;
  fetchFn?: typeof fetch;
}

export interface NonceResponse {
  nonce: string;
  message: string;
  expires_at: number;
}

export interface VerifyResponse {
  token: string;
  expires_at: number;
  user: {
    id: string;
    wallet_address: string;
    contract_address?: string | null;
    metadata?: Record<string, any>;
  };
}

export class WorkerApiClient {
  private baseUrl: string;
  private getToken?: () => Promise<string | null>;
  private timeoutMs: number;
  private fetchFn: typeof fetch;

  constructor(options: WorkerApiOptions = {}) {
    this.baseUrl = (options.baseUrl || 'http://127.0.0.1:8787').replace(/\/$/, '');
    this.getToken = options.getToken;
    this.timeoutMs = options.timeoutMs ?? 15000;
    this.fetchFn = options.fetchFn ?? globalThis.fetch.bind(globalThis);
  }

  public setBaseUrl(url: string): void {
    this.baseUrl = url.replace(/\/$/, '');
  }

  public getBaseUrl(): string {
    return this.baseUrl;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit & { requiresAuth?: boolean } = {},
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
    const headers: Record<string, string> = {
      Accept: 'application/json',
      ...((options.headers as Record<string, string>) || {}),
    };

    if (options.requiresAuth !== false && this.getToken) {
      const token = await this.getToken();
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
    }

    if (options.body && typeof options.body === 'string' && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const res = await this.fetchFn(url, {
        ...options,
        headers,
        signal: controller.signal,
      });

      clearTimeout(timer);

      if (!res.ok) {
        let errMessage = `HTTP ${res.status} ${res.statusText}`;
        try {
          const errBody = (await res.json()) as any;
          if (errBody && (errBody.error || errBody.message)) {
            errMessage = errBody.error || errBody.message;
          }
        } catch {
          // Ignore JSON parse error on non-json error responses
        }
        throw new Error(errMessage);
      }

      return (await res.json()) as T;
    } catch (err: any) {
      clearTimeout(timer);
      if (err.name === 'AbortError') {
        throw new Error(`Request timed out after ${this.timeoutMs}ms`);
      }
      throw err;
    }
  }

  // --- Auth Endpoints ---

  async getNonce(walletAddress: string): Promise<NonceResponse> {
    return this.request<NonceResponse>(
      `/auth/nonce?address=${encodeURIComponent(walletAddress)}`,
      {
        method: 'GET',
        requiresAuth: false,
      },
    );
  }

  async verifySignature(
    address: string,
    signature: string,
    nonce: string,
  ): Promise<VerifyResponse> {
    return this.request<VerifyResponse>('/auth/verify', {
      method: 'POST',
      body: JSON.stringify({ address, signature, nonce }),
      requiresAuth: false,
    });
  }

  async getMe(): Promise<any> {
    return this.request<any>('/auth/me', {
      method: 'GET',
    });
  }

  async logout(): Promise<void> {
    await this.request<{ success: boolean }>('/auth/logout', {
      method: 'POST',
    });
  }

  // --- Messages Endpoints ---

  async getMessages(
    conversationId: string,
    limit: number = 50,
    before?: number,
  ): Promise<ChatMessage[]> {
    let query = `?limit=${limit}`;
    if (before !== undefined) {
      query += `&before=${before}`;
    }
    const res = await this.request<{ messages: ChatMessage[] }>(
      `/conversations/${encodeURIComponent(conversationId)}/messages${query}`,
      { method: 'GET' },
    );
    return res.messages || [];
  }

  async sendMessage(
    conversationId: string,
    payload: {
      content: string;
      type?: MessageType;
      metadata?: Record<string, any>;
      retention?: 'permanent' | 'on_read';
      burn_after_seconds?: number;
      mentions?: string[];
    },
  ): Promise<ChatMessage> {
    const res = await this.request<{ message: ChatMessage }>(
      `/conversations/${encodeURIComponent(conversationId)}/messages`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
    );
    return res.message;
  }

  async ackMessage(messageId: string): Promise<void> {
    await this.request<any>(`/messages/${encodeURIComponent(messageId)}/ack`, {
      method: 'POST',
    });
  }

  async ackMessagesBatch(messageIds: string[]): Promise<void> {
    if (messageIds.length === 0) return;
    await this.request<any>('/messages/ack', {
      method: 'POST',
      body: JSON.stringify({ message_ids: messageIds }),
    });
  }

  async readMessage(messageId: string): Promise<void> {
    await this.request<any>(`/messages/${encodeURIComponent(messageId)}/read`, {
      method: 'POST',
    });
  }

  async readMessagesBatch(messageIds: string[]): Promise<void> {
    if (messageIds.length === 0) return;
    await this.request<any>('/messages/read', {
      method: 'POST',
      body: JSON.stringify({ message_ids: messageIds }),
    });
  }

  async recallMessage(messageId: string): Promise<void> {
    await this.request<any>(`/messages/${encodeURIComponent(messageId)}/recall`, {
      method: 'POST',
    });
  }

  // --- Synchronization Endpoints ---

  async sync(since: number = 0, limit: number = 100): Promise<SyncResult> {
    const res = await this.request<any>(`/sync?since=${since}&limit=${limit}`, {
      method: 'GET',
    });

    return {
      messages: res.messages || [],
      receipts: res.receipts || [],
      recalls: res.recalls || [],
      last_timestamp: res.last_timestamp || since,
    };
  }
}
