import { describe, expect, it } from 'vitest'
import { privateKeyToAccount } from 'viem/accounts'
import { createSiweMessage } from 'viem/siwe'
import { appConfig } from './config'
import { generateSessionKeyPair } from './security'
import { verifyWalletIdentity } from './wallet'
import type { SharedWalletIdentity } from '../types/chat'

const TEST_ACCOUNT = privateKeyToAccount(
  '0x59c6995e998f97a5a0044966f0945384b2f7f8dca47a6e3ddccb93a1d0fce4b3',
)

function toBase64Url(value: string) {
  return value.replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '')
}

async function buildIdentity(
  overrides: Partial<SharedWalletIdentity> = {},
): Promise<SharedWalletIdentity> {
  const sessionKeys = await generateSessionKeyPair()
  const origin = overrides.origin ?? window.location.origin
  const domain = overrides.domain ?? window.location.host
  const uri = overrides.uri ?? origin
  const issuedAt = overrides.issuedAt ?? new Date().toISOString()
  const nonce = overrides.nonce ?? crypto.randomUUID().replaceAll('-', '')
  const sessionId = overrides.sessionId ?? crypto.randomUUID()
  const appId = overrides.appId ?? appConfig.appId
  const chainId = overrides.chainId ?? 1
  const sessionPublicKey = overrides.sessionPublicKey ?? sessionKeys.publicKey
  const message = createSiweMessage({
    address: TEST_ACCOUNT.address,
    chainId,
    domain,
    issuedAt: new Date(issuedAt),
    nonce,
    requestId: sessionId,
    resources: [
      `urn:web3-chat:app:${appId}`,
      `urn:web3-chat:origin:${origin}`,
      `urn:web3-chat:session-key:${toBase64Url(sessionPublicKey)}`,
    ],
    scheme: window.location.protocol.replace(':', ''),
    statement: 'Sign in to Web3 Chat mobile session.',
    uri,
    version: '1',
  })

  return {
    address: TEST_ACCOUNT.address,
    chainId,
    signature: await TEST_ACCOUNT.signMessage({ message }),
    message,
    issuedAt,
    nonce,
    sessionId,
    domain,
    origin,
    uri,
    appId,
    sessionPublicKey,
    ...overrides,
  }
}

describe('wallet utils', () => {
  it('verifies a well-formed signed identity', async () => {
    const identity = await buildIdentity()

    await expect(verifyWalletIdentity(identity, 60_000)).resolves.toBe(true)
  })

  it('rejects identities with tampered issuedAt metadata', async () => {
    const identity = await buildIdentity()

    await expect(
      verifyWalletIdentity(
        {
          ...identity,
          issuedAt: new Date(Date.now() - 10_000).toISOString(),
        },
        60_000,
      ),
    ).resolves.toBe(false)
  })

  it('rejects identities created for a different origin', async () => {
    const identity = await buildIdentity()

    await expect(
      verifyWalletIdentity(
        {
          ...identity,
          origin: 'https://evil.example',
        },
        60_000,
      ),
    ).resolves.toBe(false)
  })

  it('rejects identities issued too far in the future', async () => {
    const identity = await buildIdentity({
      issuedAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
    })

    await expect(verifyWalletIdentity(identity, 60_000)).resolves.toBe(false)
  })
})
