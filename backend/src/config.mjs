const DEFAULT_HOST = '0.0.0.0'
const DEFAULT_PORT = 8787
const DEFAULT_DB_FILE = '/data/web3-chat.sqlite'
const DEFAULT_SESSION_TTL_HOURS = 24 * 7
const DEFAULT_TURN_TTL_SECONDS = 3600

function readCsv(value) {
  return (value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

function parsePositiveInt(value, fallback) {
  const parsed = Number.parseInt(value ?? '', 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

function parseBoolean(value, fallback) {
  if (value === undefined) {
    return fallback
  }

  return value.trim().toLowerCase() === 'true'
}

export const serverConfig = {
  host: process.env.HOST?.trim() || DEFAULT_HOST,
  port: parsePositiveInt(process.env.PORT, DEFAULT_PORT),
  dbFile: process.env.DB_FILE?.trim() || DEFAULT_DB_FILE,
  appId: process.env.APP_ID?.trim() || 'web3-wallet-chat',
  allowedOrigins: readCsv(process.env.ALLOWED_ORIGINS),
  sessionTtlMs:
    parsePositiveInt(process.env.SESSION_TTL_HOURS, DEFAULT_SESSION_TTL_HOURS) *
    60 *
    60 *
    1000,
  enableTestIdentity: parseBoolean(process.env.ENABLE_TEST_IDENTITY, false),
  turnSecret: process.env.TURN_SECRET?.trim() || '',
  turnTtlSeconds: parsePositiveInt(
    process.env.TURN_TTL_SECONDS,
    DEFAULT_TURN_TTL_SECONDS,
  ),
  stunUrls: readCsv(process.env.STUN_URLS),
  turnUrls: readCsv(process.env.TURN_URLS),
}

export function isAllowedOrigin(origin) {
  if (!origin) {
    return false
  }

  return (
    serverConfig.allowedOrigins.length === 0 ||
    serverConfig.allowedOrigins.includes(origin)
  )
}
