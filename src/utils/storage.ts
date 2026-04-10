import type {
  ChatMessage,
  KnownRoom,
  PersistedState,
  WalletIdentity,
} from '../types/chat'

const LOCAL_STATE_KEY = 'web3-chat:local-state:v2'
const SESSION_STATE_KEY = 'web3-chat:session-state:v2'
const SESSION_IDENTITY_KEY = 'web3-chat:session-identity:v2'

type PersistedRoomIndex = Omit<KnownRoom, 'createdBy' | 'inviteLink' | 'secret'>

type SessionRoomState = {
  inviteLink?: string
  secret?: string
}

type LocalStateSnapshot = {
  currentRoomId: string | null
  rooms: PersistedRoomIndex[]
}

type SessionStateSnapshot = {
  messagesByRoom: Record<string, ChatMessage[]>
  roomsById: Record<string, SessionRoomState>
}

function emptyState(): PersistedState {
  return {
    identity: null,
    rooms: [],
    messagesByRoom: {},
    currentRoomId: null,
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

function mergeRooms(
  roomIndex: PersistedRoomIndex[],
  sessionRooms: Record<string, SessionRoomState>,
) {
  return roomIndex.map((room) => ({
    ...room,
    createdBy: 'local',
    ...(sessionRooms[room.roomId] ?? {}),
  }))
}

function stripRoom(room: KnownRoom): PersistedRoomIndex {
  const {
    createdBy: _createdBy,
    secret: _secret,
    inviteLink: _inviteLink,
    ...safeRoom
  } = room
  return safeRoom
}

export function loadPersistedState(): PersistedState {
  if (typeof window === 'undefined') {
    return emptyState()
  }

  const localState = readJson<LocalStateSnapshot>(
    window.localStorage,
    LOCAL_STATE_KEY,
  )
  const sessionState = readJson<SessionStateSnapshot>(
    window.sessionStorage,
    SESSION_STATE_KEY,
  )

  return {
    identity: null,
    rooms: mergeRooms(
      localState?.rooms ?? [],
      sessionState?.roomsById ?? {},
    ),
    messagesByRoom: sessionState?.messagesByRoom ?? {},
    currentRoomId: localState?.currentRoomId ?? null,
  }
}

export function savePersistedState(state: PersistedState) {
  const localSnapshot = {
    currentRoomId: state.currentRoomId,
    rooms: state.rooms.map(stripRoom),
  } satisfies LocalStateSnapshot

  const sessionSnapshot = {
    messagesByRoom: state.messagesByRoom,
    roomsById: state.rooms.reduce<Record<string, SessionRoomState>>(
      (accumulator, room) => {
        if (room.secret || room.inviteLink) {
          accumulator[room.roomId] = {
            ...(room.secret ? { secret: room.secret } : {}),
            ...(room.inviteLink ? { inviteLink: room.inviteLink } : {}),
          }
        }

        return accumulator
      },
      {},
    ),
  } satisfies SessionStateSnapshot

  window.localStorage.setItem(LOCAL_STATE_KEY, JSON.stringify(localSnapshot))
  window.sessionStorage.setItem(SESSION_STATE_KEY, JSON.stringify(sessionSnapshot))
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
  if (identity) {
    window.sessionStorage.setItem(SESSION_IDENTITY_KEY, JSON.stringify(identity))
    return
  }

  window.sessionStorage.removeItem(SESSION_IDENTITY_KEY)
}
