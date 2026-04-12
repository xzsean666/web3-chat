import type { ChatMessage, PersistedState, WalletIdentity } from '../types/chat'

const LOCAL_STATE_KEY = 'web3-chat:local-state:v3'
const SESSION_STATE_KEY = 'web3-chat:session-state:v3'
const SESSION_IDENTITY_KEY = 'web3-chat:session-identity:v3'

type LocalStateSnapshot = {
  currentConversationId: string | null
  messagesByConversation: Record<string, ChatMessage[]>
}

type SessionStateSnapshot = {
  authToken: string | null
  authExpiresAt: string | null
}

function emptyState(): PersistedState {
  return {
    identity: null,
    authToken: null,
    authExpiresAt: null,
    currentConversationId: null,
    messagesByConversation: {},
  }
}

function readJson<T>(storage: Storage, key: string) {
  try {
    const raw = storage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

function sanitizeMessages(messagesByConversation: unknown) {
  if (!messagesByConversation || typeof messagesByConversation !== 'object') {
    return {}
  }

  const normalizedEntries = Object.entries(messagesByConversation).filter(
    ([conversationId, messages]) =>
      typeof conversationId === 'string' && Array.isArray(messages),
  )

  return Object.fromEntries(normalizedEntries) as Record<string, ChatMessage[]>
}

export function loadPersistedState(): PersistedState {
  if (typeof window === 'undefined') {
    return emptyState()
  }

  const localState = readJson<LocalStateSnapshot>(window.localStorage, LOCAL_STATE_KEY)
  const sessionState = readJson<SessionStateSnapshot>(
    window.sessionStorage,
    SESSION_STATE_KEY,
  )

  return {
    identity: null,
    authToken: sessionState?.authToken ?? null,
    authExpiresAt: sessionState?.authExpiresAt ?? null,
    currentConversationId: localState?.currentConversationId ?? null,
    messagesByConversation: sanitizeMessages(localState?.messagesByConversation),
  }
}

export function savePersistedState(state: PersistedState) {
  if (typeof window === 'undefined') {
    return
  }

  const localSnapshot = {
    currentConversationId: state.currentConversationId,
    messagesByConversation: state.messagesByConversation,
  } satisfies LocalStateSnapshot

  const sessionSnapshot = {
    authToken: state.authToken,
    authExpiresAt: state.authExpiresAt,
  } satisfies SessionStateSnapshot

  window.localStorage.setItem(LOCAL_STATE_KEY, JSON.stringify(localSnapshot))
  window.sessionStorage.setItem(SESSION_STATE_KEY, JSON.stringify(sessionSnapshot))
}

export function clearPersistedSession() {
  if (typeof window === 'undefined') {
    return
  }

  window.sessionStorage.removeItem(SESSION_STATE_KEY)
  window.sessionStorage.removeItem(SESSION_IDENTITY_KEY)
}

export function loadSessionIdentity() {
  if (typeof window === 'undefined') {
    return null
  }

  try {
    const raw = window.sessionStorage.getItem(SESSION_IDENTITY_KEY)
    return raw ? (JSON.parse(raw) as WalletIdentity) : null
  } catch {
    return null
  }
}

export function saveSessionIdentity(identity: WalletIdentity | null) {
  if (typeof window === 'undefined') {
    return
  }

  if (identity) {
    window.sessionStorage.setItem(SESSION_IDENTITY_KEY, JSON.stringify(identity))
    return
  }

  window.sessionStorage.removeItem(SESSION_IDENTITY_KEY)
}
