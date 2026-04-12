const DEFAULT_STUN_SERVERS = [
  'stun:stun.cloudflare.com:3478',
  'stun:stun.l.google.com:19302',
]

const DEFAULT_HISTORY_LIMIT = 200
const DEFAULT_MAX_MESSAGE_LENGTH = 1000
const DEFAULT_HANDSHAKE_TTL_MS = 24 * 60 * 60 * 1000
const DEFAULT_MESSAGE_FRESHNESS_MS = 10 * 60 * 1000

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

function isLocalTestingHost() {
  if (typeof window === 'undefined') {
    return false
  }

  return ['localhost', '127.0.0.1', '::1'].includes(window.location.hostname)
}

function normalizeBaseUrl(value: string) {
  return value.replace(/\/+$/, '')
}

function deriveBackendBaseUrl() {
  if (typeof window === 'undefined') {
    return 'http://127.0.0.1:8787'
  }

  const protocol = window.location.protocol === 'https:' ? 'https:' : 'http:'
  return `${protocol}//${window.location.hostname}:8787`
}

function deriveBackendWsUrl(baseUrl: string) {
  const url = new URL('/ws', `${baseUrl}/`)
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
  return url.toString()
}

function dedupeIceServers(iceServers: RTCIceServer[]) {
  const seen = new Set<string>()
  const normalized: RTCIceServer[] = []

  for (const server of iceServers) {
    const urls = Array.isArray(server.urls) ? server.urls : [server.urls]
    const key = JSON.stringify({
      urls,
      username: server.username ?? '',
      credential: server.credential ?? '',
    })

    if (seen.has(key)) {
      continue
    }

    seen.add(key)
    normalized.push(server)
  }

  return normalized
}

const configuredStunServers = readCsv(import.meta.env.VITE_STUN_SERVERS)
const fallbackIceServers = (
  configuredStunServers.length ? configuredStunServers : DEFAULT_STUN_SERVERS
).map((urls) => ({ urls }))

const backendBaseUrl = normalizeBaseUrl(
  import.meta.env.VITE_BACKEND_BASE_URL?.trim() || deriveBackendBaseUrl(),
)
const backendWsUrl = (
  import.meta.env.VITE_BACKEND_WS_URL?.trim() || deriveBackendWsUrl(backendBaseUrl)
).trim()

export const appConfig = {
  appId: import.meta.env.VITE_APP_ID?.trim() || 'web3-wallet-chat',
  backendBaseUrl,
  backendWsUrl,
  enableTestIdentity: parseBoolean(
    import.meta.env.VITE_ENABLE_TEST_IDENTITY,
    isLocalTestingHost(),
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
  messageFreshnessMs: parsePositiveInt(
    import.meta.env.VITE_MESSAGE_FRESHNESS_MS,
    DEFAULT_MESSAGE_FRESHNESS_MS,
  ),
  fallbackIceServers,
}

export function buildRtcConfig(iceServers?: RTCIceServer[]) {
  const normalized = dedupeIceServers([
    ...(iceServers ?? []),
    ...appConfig.fallbackIceServers,
  ])

  return {
    iceServers: normalized,
    iceCandidatePoolSize: 4,
    iceTransportPolicy: 'all',
  } satisfies RTCConfiguration
}
