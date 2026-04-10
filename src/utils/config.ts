const DEFAULT_STUN_SERVERS = [
  'stun:stun.cloudflare.com:3478',
  'stun:stun.l.google.com:19302',
]

const DEFAULT_HISTORY_LIMIT = 200
const DEFAULT_MAX_MESSAGE_LENGTH = 1000
const DEFAULT_HANDSHAKE_TTL_MS = 24 * 60 * 60 * 1000
const DEFAULT_INVITE_TTL_MS = 12 * 60 * 60 * 1000
const DEFAULT_MESSAGE_FRESHNESS_MS = 10 * 60 * 1000
const DEFAULT_TURN_ONLY_TIMEOUT_MS = 6000

function readCsv(value?: string) {
  return value
    ?.split(',')
    .map((item) => item.trim())
    .filter(Boolean) ?? []
}

function parseBoolean(value: string | undefined, fallback: boolean) {
  if (value === undefined) {
    return fallback
  }

  return value.trim().toLowerCase() === 'true'
}

function parsePositiveInt(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(value ?? '', 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

const configuredStunServers = readCsv(import.meta.env.VITE_STUN_SERVERS)
const stunUrls = configuredStunServers.length
  ? configuredStunServers
  : DEFAULT_STUN_SERVERS
const turnUrls = readCsv(import.meta.env.VITE_TURN_URLS)
const turnServers: RTCIceServer[] = turnUrls.length
  ? [
      {
        urls: turnUrls,
        username: import.meta.env.VITE_TURN_USERNAME,
        credential: import.meta.env.VITE_TURN_CREDENTIAL,
      },
    ]
  : []
const stunServers: RTCIceServer[] = stunUrls.map((urls) => ({ urls }))

export const appConfig = {
  appId: import.meta.env.VITE_APP_ID?.trim() || 'web3-wallet-chat',
  relayUrls: readCsv(import.meta.env.VITE_RELAY_URLS),
  hasTurn: turnServers.length > 0,
  preferTurn: parseBoolean(import.meta.env.VITE_PREFER_TURN, true),
  turnOnlyTimeoutMs: parsePositiveInt(
    import.meta.env.VITE_TURN_ONLY_TIMEOUT_MS,
    DEFAULT_TURN_ONLY_TIMEOUT_MS,
  ),
  roomHistoryLimit: parsePositiveInt(
    import.meta.env.VITE_ROOM_HISTORY_LIMIT,
    DEFAULT_HISTORY_LIMIT,
  ),
  maxMessageLength: parsePositiveInt(
    import.meta.env.VITE_MAX_MESSAGE_LENGTH,
    DEFAULT_MAX_MESSAGE_LENGTH,
  ),
  handshakeTtlMs: parsePositiveInt(
    import.meta.env.VITE_HANDSHAKE_TTL_MS,
    DEFAULT_HANDSHAKE_TTL_MS,
  ),
  inviteTtlMs: parsePositiveInt(
    import.meta.env.VITE_INVITE_TTL_MS,
    DEFAULT_INVITE_TTL_MS,
  ),
  messageFreshnessMs: parsePositiveInt(
    import.meta.env.VITE_MESSAGE_FRESHNESS_MS,
    DEFAULT_MESSAGE_FRESHNESS_MS,
  ),
}

export function getPreferredTransportMode() {
  if (appConfig.hasTurn && appConfig.preferTurn) {
    return 'turn-only' as const
  }

  return appConfig.hasTurn ? ('hybrid' as const) : ('stun-only' as const)
}

export function getFallbackTransportMode() {
  return appConfig.hasTurn ? ('hybrid' as const) : ('stun-only' as const)
}

export function getRtcConfig(mode: 'turn-only' | 'hybrid' | 'stun-only') {
  if (mode === 'turn-only' && turnServers.length) {
    return {
      iceServers: turnServers,
      iceCandidatePoolSize: 4,
      iceTransportPolicy: 'relay',
    } satisfies RTCConfiguration
  }

  if (mode === 'hybrid') {
    return {
      iceServers: [...turnServers, ...stunServers],
      iceCandidatePoolSize: 4,
      iceTransportPolicy: 'all',
    } satisfies RTCConfiguration
  }

  return {
    iceServers: stunServers,
    iceCandidatePoolSize: 4,
    iceTransportPolicy: 'all',
  } satisfies RTCConfiguration
}
