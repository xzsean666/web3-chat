/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APP_ID?: string
  readonly VITE_STUN_SERVERS?: string
  readonly VITE_RELAY_URLS?: string
  readonly VITE_TURN_URLS?: string
  readonly VITE_TURN_USERNAME?: string
  readonly VITE_TURN_CREDENTIAL?: string
  readonly VITE_PREFER_TURN?: string
  readonly VITE_TURN_ONLY_TIMEOUT_MS?: string
  readonly VITE_HANDSHAKE_TTL_MS?: string
  readonly VITE_INVITE_TTL_MS?: string
  readonly VITE_ROOM_HISTORY_LIMIT?: string
  readonly VITE_MAX_MESSAGE_LENGTH?: string
  readonly VITE_MESSAGE_FRESHNESS_MS?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
