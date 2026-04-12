import { appConfig } from './config'
import { parseIsoDate } from './format'
import {
  generateSessionKeyPair,
  signPayload,
  verifyPayloadSignature,
} from './security'
import { generateCompactId, generateUuid } from './uuid'
import type {
  IdentityAuthMethod,
  SharedWalletIdentity,
  WalletIdentity,
} from '../types/chat'

type InjectedProvider = {
  request: (...args: unknown[]) => Promise<unknown>
}

const APP_RESOURCE_PREFIX = 'urn:web3-chat:app:'
const ORIGIN_RESOURCE_PREFIX = 'urn:web3-chat:origin:'
const SESSION_KEY_RESOURCE_PREFIX = 'urn:web3-chat:session-key:'
const MAX_CLOCK_SKEW_MS = 60_000
const TEST_IDENTITY_MESSAGE_TYPE = 'web3-chat-test-identity'
const TEST_IDENTITY_CHAIN_ID = 31_337

let viemPromise: Promise<typeof import('viem')> | null = null
let siwePromise: Promise<typeof import('viem/siwe')> | null = null

type TestIdentityMessage = {
  type: typeof TEST_IDENTITY_MESSAGE_TYPE
  version: 1
  address: `0x${string}`
  chainId: number
  sessionId: string
  nonce: string
  issuedAt: string
  domain: string
  origin: string
  uri: string
  appId: string
  sessionPublicKey: string
}

declare global {
  interface Window {
    ethereum?: InjectedProvider
  }
}

function loadViem() {
  viemPromise ??= import('viem')
  return viemPromise
}

function loadSiwe() {
  siwePromise ??= import('viem/siwe')
  return siwePromise
}

function getSigningOrigin() {
  const url = new URL(window.location.href)
  return {
    domain: url.host,
    origin: url.origin,
    scheme: url.protocol.replace(':', ''),
    uri: url.origin,
  }
}

function buildResource(prefix: string, value: string) {
  return `${prefix}${value}`
}

function toBase64Url(value: string) {
  return value.replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '')
}

function getResource(resources: string[] | undefined, prefix: string) {
  return resources?.find((item) => item.startsWith(prefix))?.slice(prefix.length) ?? null
}

function isIdentityAuthMethod(value: unknown): value is IdentityAuthMethod {
  return value === 'wallet' || value === 'guest'
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object'
}

function toHex(bytes: Uint8Array) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

function parseTestIdentityMessage(value: string) {
  try {
    const parsed = JSON.parse(value) as unknown

    if (!isRecord(parsed)) {
      return null
    }

    if (
      parsed.type !== TEST_IDENTITY_MESSAGE_TYPE ||
      parsed.version !== 1 ||
      typeof parsed.address !== 'string' ||
      typeof parsed.chainId !== 'number' ||
      typeof parsed.sessionId !== 'string' ||
      typeof parsed.nonce !== 'string' ||
      typeof parsed.issuedAt !== 'string' ||
      typeof parsed.domain !== 'string' ||
      typeof parsed.origin !== 'string' ||
      typeof parsed.uri !== 'string' ||
      typeof parsed.appId !== 'string' ||
      typeof parsed.sessionPublicKey !== 'string'
    ) {
      return null
    }

    return parsed as TestIdentityMessage
  } catch {
    return null
  }
}

async function deriveTestAddress(seed: string) {
  const digest = await globalThis.crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(seed),
  )

  return `0x${toHex(new Uint8Array(digest).slice(0, 20))}` as const
}

function buildTestIdentityMessage(
  payload: Omit<TestIdentityMessage, 'type' | 'version'>,
) {
  return {
    type: TEST_IDENTITY_MESSAGE_TYPE,
    version: 1,
    ...payload,
  } satisfies TestIdentityMessage
}

function isValidIssuedAt(value: string, ttlMs: number) {
  const issuedAt = parseIsoDate(value)

  if (!issuedAt) {
    return false
  }

  const ageMs = Date.now() - issuedAt.getTime()
  return ageMs >= -MAX_CLOCK_SKEW_MS && ageMs <= ttlMs
}

export function shortAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

export function toSharedWalletIdentity(
  identity: WalletIdentity,
): SharedWalletIdentity {
  const { sessionPrivateKey: _sessionPrivateKey, authMethod, ...sharedIdentity } =
    identity

  return {
    ...sharedIdentity,
    authMethod: authMethod ?? 'wallet',
  }
}

export async function connectWalletIdentity() {
  if (!window.ethereum) {
    throw new Error('未检测到 EVM 钱包。请先安装 MetaMask 或兼容钱包。')
  }

  const [{ createWalletClient, custom }, { createSiweMessage }] = await Promise.all([
    loadViem(),
    loadSiwe(),
  ])

  const walletClient = createWalletClient({
    transport: custom(window.ethereum),
  })

  const [address] = await walletClient.requestAddresses()

  if (!address) {
    throw new Error('钱包未返回可用地址。')
  }

  const chainId = await walletClient.getChainId()
  const nonce = generateCompactId()
  const sessionId = generateUuid()
  const issuedAt = new Date().toISOString()
  const { domain, origin, scheme, uri } = getSigningOrigin()
  const sessionKeys = await generateSessionKeyPair()
  const message = createSiweMessage({
    address,
    chainId,
    domain,
    issuedAt: new Date(issuedAt),
    nonce,
    requestId: sessionId,
    resources: [
      buildResource(APP_RESOURCE_PREFIX, appConfig.appId),
      buildResource(ORIGIN_RESOURCE_PREFIX, origin),
      buildResource(SESSION_KEY_RESOURCE_PREFIX, sessionKeys.publicKeyResource),
    ],
    scheme,
    statement: 'Sign in to Web3 Chat mobile session.',
    uri,
    version: '1',
  })
  const signature = await walletClient.signMessage({
    account: address,
    message,
  })

  return {
    authMethod: 'wallet',
    address,
    chainId,
    signature,
    message,
    issuedAt,
    nonce,
    sessionId,
    domain,
    origin,
    uri,
    appId: appConfig.appId,
    sessionPublicKey: sessionKeys.publicKey,
    sessionPrivateKey: sessionKeys.privateKey,
  } satisfies WalletIdentity
}

export async function connectTestIdentity() {
  if (!appConfig.enableTestIdentity) {
    throw new Error('当前环境未开启测试身份模式。')
  }

  const sessionKeys = await generateSessionKeyPair()
  const nonce = generateCompactId()
  const sessionId = generateUuid()
  const issuedAt = new Date().toISOString()
  const { domain, origin, uri } = getSigningOrigin()
  const address = await deriveTestAddress(`${sessionKeys.publicKey}:${sessionId}`)
  const messagePayload = buildTestIdentityMessage({
    address,
    chainId: TEST_IDENTITY_CHAIN_ID,
    sessionId,
    nonce,
    issuedAt,
    domain,
    origin,
    uri,
    appId: appConfig.appId,
    sessionPublicKey: sessionKeys.publicKey,
  })
  const signature = await signPayload(messagePayload, {
    sessionPrivateKey: sessionKeys.privateKey,
  })

  return {
    authMethod: 'guest',
    address,
    chainId: TEST_IDENTITY_CHAIN_ID,
    signature,
    message: JSON.stringify(messagePayload),
    issuedAt,
    nonce,
    sessionId,
    domain,
    origin,
    uri,
    appId: appConfig.appId,
    sessionPublicKey: sessionKeys.publicKey,
    sessionPrivateKey: sessionKeys.privateKey,
  } satisfies WalletIdentity
}

async function verifyTestIdentity(
  identity: SharedWalletIdentity | WalletIdentity,
  ttlMs: number,
) {
  if (!appConfig.enableTestIdentity) {
    return false
  }

  const parsedMessage = parseTestIdentityMessage(identity.message)
  const expectedOrigin = typeof window === 'undefined' ? identity.origin : window.location.origin

  if (!parsedMessage) {
    return false
  }

  const isSignatureValid = await verifyPayloadSignature(
    parsedMessage,
    identity.signature,
    identity.sessionPublicKey,
  )

  return Boolean(
    isSignatureValid &&
      parsedMessage.address === identity.address &&
      parsedMessage.chainId === identity.chainId &&
      parsedMessage.sessionId === identity.sessionId &&
      parsedMessage.nonce === identity.nonce &&
      parsedMessage.issuedAt === identity.issuedAt &&
      parsedMessage.domain === identity.domain &&
      parsedMessage.origin === identity.origin &&
      parsedMessage.origin === expectedOrigin &&
      parsedMessage.uri === identity.uri &&
      parsedMessage.appId === identity.appId &&
      identity.appId === appConfig.appId &&
      parsedMessage.sessionPublicKey === identity.sessionPublicKey &&
      isValidIssuedAt(identity.issuedAt, ttlMs),
  )
}

export async function verifyWalletIdentity(
  identity: SharedWalletIdentity | WalletIdentity,
  ttlMs: number,
) {
  if (
    !identity ||
    (identity.authMethod !== undefined && !isIdentityAuthMethod(identity.authMethod)) ||
    typeof identity.chainId !== 'number' ||
    typeof identity.message !== 'string' ||
    typeof identity.signature !== 'string' ||
    typeof identity.nonce !== 'string' ||
    typeof identity.sessionId !== 'string' ||
    typeof identity.issuedAt !== 'string' ||
    typeof identity.domain !== 'string' ||
    typeof identity.origin !== 'string' ||
    typeof identity.uri !== 'string' ||
    typeof identity.appId !== 'string' ||
    typeof identity.sessionPublicKey !== 'string'
  ) {
    return false
  }

  const { isAddress, verifyMessage } = await loadViem()
  const inferredAuthMethod =
    identity.authMethod ?? (parseTestIdentityMessage(identity.message) ? 'guest' : 'wallet')

  if (!isAddress(identity.address)) {
    return false
  }

  if (inferredAuthMethod === 'guest') {
    return verifyTestIdentity(identity, ttlMs)
  }

  const { parseSiweMessage } = await loadSiwe()

  const parsedMessage = parseSiweMessage(identity.message)
  const messageIssuedAt =
    parsedMessage.issuedAt instanceof Date
      ? parsedMessage.issuedAt.toISOString()
      : null
  const resources = parsedMessage.resources
  const appIdResource = getResource(resources, APP_RESOURCE_PREFIX)
  const originResource = getResource(resources, ORIGIN_RESOURCE_PREFIX)
  const sessionKeyResource = getResource(resources, SESSION_KEY_RESOURCE_PREFIX)
  const expectedOrigin = typeof window === 'undefined' ? identity.origin : window.location.origin

  const isSignatureValid = await verifyMessage({
    address: identity.address,
    message: identity.message,
    signature: identity.signature,
  })

  if (!isSignatureValid) {
    return false
  }

  return Boolean(
    parsedMessage.address === identity.address &&
      parsedMessage.chainId === identity.chainId &&
      parsedMessage.domain === identity.domain &&
      parsedMessage.uri === identity.uri &&
      parsedMessage.requestId === identity.sessionId &&
      parsedMessage.nonce === identity.nonce &&
      messageIssuedAt === identity.issuedAt &&
      appIdResource === identity.appId &&
      identity.appId === appConfig.appId &&
      originResource === identity.origin &&
      originResource === expectedOrigin &&
      sessionKeyResource === toBase64Url(identity.sessionPublicKey) &&
      sessionKeyResource.length > 0 &&
      inferredAuthMethod === 'wallet' &&
      isValidIssuedAt(identity.issuedAt, ttlMs),
  )
}
