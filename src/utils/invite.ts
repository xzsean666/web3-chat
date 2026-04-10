import type { InvitePayload, RoomKind } from '../types/chat'
import { parseIsoDate } from './format'

const ROOM_TITLE_LIMIT = 24
const MAX_PEER_LIMIT = 8
const MIN_PEER_LIMIT = 2
const ROOM_ID_PATTERN = /^[a-zA-Z0-9_-]{2,128}$/
const SECRET_PATTERN = /^[^\s]{6,256}$/

function normalizeRoomKind(value: string | null): RoomKind | null {
  if (value === 'private' || value === 'group') {
    return value
  }

  return null
}

export function sanitizeRoomTitle(title: string, fallback: RoomKind) {
  const trimmed = title.trim().slice(0, ROOM_TITLE_LIMIT)

  if (trimmed) {
    return trimmed
  }

  return fallback === 'private' ? '新的私聊' : '新的群聊'
}

export function generateRoomId() {
  return crypto.randomUUID().replaceAll('-', '')
}

export function generateRoomSecret() {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map((item) => item.toString(16).padStart(2, '0'))
    .join('')
}

export function buildInviteLink(payload: InvitePayload) {
  const url = new URL(window.location.href)

  url.search = ''
  url.hash = ''
  url.searchParams.set('room', payload.roomId)
  url.searchParams.set('kind', payload.kind)
  url.searchParams.set('title', payload.title)
  url.searchParams.set('secret', payload.secret)
  url.searchParams.set('limit', String(payload.peerLimit))
  url.searchParams.set('expires', payload.expiresAt)

  return url.toString()
}

function normalizeExpiry(value: string | null) {
  if (!value) {
    return null
  }

  return parseIsoDate(value)?.toISOString() ?? null
}

export function parseInvitePayload(raw: string) {
  try {
    const url = new URL(raw, window.location.origin)
    const roomId = url.searchParams.get('room')?.trim()
    const kind = normalizeRoomKind(url.searchParams.get('kind'))
    const title = url.searchParams.get('title')
    const secret = url.searchParams.get('secret')?.trim()
    const peerLimit = Number.parseInt(url.searchParams.get('limit') ?? '', 10)
    const expiresAt = normalizeExpiry(url.searchParams.get('expires')?.trim() ?? null)

    if (
      !roomId ||
      !ROOM_ID_PATTERN.test(roomId) ||
      !kind ||
      !title ||
      !secret ||
      !SECRET_PATTERN.test(secret) ||
      !Number.isFinite(peerLimit) ||
      peerLimit < MIN_PEER_LIMIT ||
      peerLimit > MAX_PEER_LIMIT ||
      !expiresAt
    ) {
      return null
    }

    return {
      roomId,
      kind,
      title: sanitizeRoomTitle(title, kind),
      secret,
      peerLimit,
      expiresAt,
    } satisfies InvitePayload
  } catch {
    return null
  }
}

export function isInviteExpired(expiresAt: string) {
  const parsedDate = parseIsoDate(expiresAt)
  return !parsedDate || Date.now() > parsedDate.getTime()
}

export function consumeInviteFromLocation() {
  const invite = parseInvitePayload(window.location.href)

  if (!invite) {
    return null
  }

  const cleanUrl = new URL(window.location.href)
  cleanUrl.search = ''
  cleanUrl.hash = ''
  window.history.replaceState({}, document.title, cleanUrl.toString())

  return invite
}
