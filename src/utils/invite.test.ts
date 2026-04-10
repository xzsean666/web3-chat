import { beforeEach, describe, expect, it } from 'vitest'
import {
  buildInviteLink,
  consumeInviteFromLocation,
  isInviteExpired,
  parseInvitePayload,
  sanitizeRoomTitle,
} from './invite'

describe('invite utils', () => {
  beforeEach(() => {
    window.history.replaceState({}, '', '/')
  })

  it('sanitizes title and applies a fallback', () => {
    expect(sanitizeRoomTitle('  产品同步  ', 'private')).toBe('产品同步')
    expect(sanitizeRoomTitle('   ', 'group')).toBe('新的群聊')
  })

  it('builds and parses an invite link', () => {
    const invite = buildInviteLink({
      roomId: 'room-1',
      kind: 'group',
      title: '研发群',
      secret: 'secret-1',
      peerLimit: 8,
      expiresAt: '2030-01-01T00:00:00.000Z',
    })

    expect(parseInvitePayload(invite)).toEqual({
      roomId: 'room-1',
      kind: 'group',
      title: '研发群',
      secret: 'secret-1',
      peerLimit: 8,
      expiresAt: '2030-01-01T00:00:00.000Z',
    })
  })

  it('consumes invite parameters from the current location', () => {
    window.history.replaceState(
      {},
      '',
      '/?room=dm-1&kind=private&title=私聊&secret=s3cr3t&limit=2&expires=2030-01-01T00:00:00.000Z',
    )

    const invite = consumeInviteFromLocation()

    expect(invite).toEqual({
      roomId: 'dm-1',
      kind: 'private',
      title: '私聊',
      secret: 's3cr3t',
      peerLimit: 2,
      expiresAt: '2030-01-01T00:00:00.000Z',
    })
    expect(window.location.search).toBe('')
  })

  it('rejects invites with malformed limits or missing expiration', () => {
    const invalidLimit =
      '/?room=room-x&kind=group&title=研发&secret=secret99&limit=abc&expires=2030-01-01T00:00:00.000Z'
    const missingExpiry =
      '/?room=room-y&kind=private&title=私聊&secret=secret99&limit=2&expires='

    expect(parseInvitePayload(invalidLimit)).toBeNull()
    expect(parseInvitePayload(missingExpiry)).toBeNull()
  })

  it('tolerates malformed expiration strings without throwing', () => {
    expect(() => isInviteExpired('totally-invalid')).not.toThrow()
    expect(isInviteExpired('totally-invalid')).toBe(true)
  })

  it('correctly detects past and future expirations', () => {
    const past = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    const future = new Date(Date.now() + 60 * 60 * 1000).toISOString()

    expect(isInviteExpired(past)).toBe(true)
    expect(isInviteExpired(future)).toBe(false)
  })
})
