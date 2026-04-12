import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import {
  createMessageAuthTag,
  generateSessionKeyPair,
  verifyMessageAuthTag,
} from './security'

let sessionKeys: Awaited<ReturnType<typeof generateSessionKeyPair>>
const originalCrypto = globalThis.crypto

const chatPayload = {
  id: 'message-1',
  roomId: 'room-1',
  senderAddress: '0x1111111111111111111111111111111111111111' as const,
  senderLabel: '0x1111...1111',
  sessionId: 'session-1',
  text: 'hello',
  createdAt: new Date().toISOString(),
}

beforeAll(async () => {
  sessionKeys = await generateSessionKeyPair()
})

afterEach(() => {
  Object.defineProperty(globalThis, 'crypto', {
    configurable: true,
    value: originalCrypto,
  })
})

describe('security utils', () => {
  it('signs and verifies message payloads', async () => {
    const authTag = await createMessageAuthTag(chatPayload, {
      sessionPrivateKey: sessionKeys.privateKey,
    })

    expect(
      await verifyMessageAuthTag(
        {
          ...chatPayload,
          authTag,
        },
        sessionKeys.publicKey,
      ),
    ).toBe(true)
  })

  it('rejects tampered message payloads', async () => {
    const authTag = await createMessageAuthTag(chatPayload, {
      sessionPrivateKey: sessionKeys.privateKey,
    })
    const tampered = {
      ...chatPayload,
      text: 'goodbye',
      authTag,
    }

    expect(await verifyMessageAuthTag(tampered, sessionKeys.publicKey)).toBe(false)
  })

  it('rejects mismatched wallet identities', async () => {
    const authTag = await createMessageAuthTag(chatPayload, {
      sessionPrivateKey: sessionKeys.privateKey,
    })
    const otherKeys = await generateSessionKeyPair()

    expect(
      await verifyMessageAuthTag(
        {
          ...chatPayload,
          authTag,
        },
        otherKeys.publicKey,
      ),
    ).toBe(false)
  })

  it('generates session keys without crypto.subtle', async () => {
    Object.defineProperty(globalThis, 'crypto', {
      configurable: true,
      value: {
        ...originalCrypto,
        subtle: undefined,
      },
    })

    const keys = await generateSessionKeyPair()

    expect(keys.publicKey.length).toBeGreaterThan(0)
    expect(keys.privateKey.length).toBeGreaterThan(0)
    expect(keys.publicKeyResource.length).toBeGreaterThan(0)
  })
})
