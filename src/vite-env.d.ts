/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APP_ID?: string
  readonly VITE_BACKEND_BASE_URL?: string
  readonly VITE_BACKEND_WS_URL?: string
  readonly VITE_STUN_SERVERS?: string
  readonly VITE_ENABLE_TEST_IDENTITY?: string
  readonly VITE_HANDSHAKE_TTL_MS?: string
  readonly VITE_ROOM_HISTORY_LIMIT?: string
  readonly VITE_MAX_MESSAGE_LENGTH?: string
  readonly VITE_MESSAGE_FRESHNESS_MS?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
