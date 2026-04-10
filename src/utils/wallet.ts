import { appConfig } from './config'
import { parseIsoDate } from './format'
import { generateSessionKeyPair } from './security'
import type { SharedWalletIdentity, WalletIdentity } from '../types/chat'

type InjectedProvider = {
  request: (...args: unknown[]) => Promise<unknown>
}

const APP_RESOURCE_PREFIX = 'urn:web3-chat:app:'
const ORIGIN_RESOURCE_PREFIX = 'urn:web3-chat:origin:'
const SESSION_KEY_RESOURCE_PREFIX = 'urn:web3-chat:session-key:'
const MAX_CLOCK_SKEW_MS = 60_000

let viemPromise: Promise<typeof import('viem')> | null = null
let siwePromise: Promise<typeof import('viem/siwe')> | null = null

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
  const { sessionPrivateKey: _sessionPrivateKey, ...sharedIdentity } = identity
  return sharedIdentity
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
  const nonce = crypto.randomUUID().replaceAll('-', '')
  const sessionId = crypto.randomUUID()
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

export async function verifyWalletIdentity(
  identity: SharedWalletIdentity | WalletIdentity,
  ttlMs: number,
) {
  const [{ isAddress, verifyMessage }, { parseSiweMessage }] = await Promise.all([
    loadViem(),
    loadSiwe(),
  ])

  if (
    !identity ||
    !isAddress(identity.address) ||
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
      isValidIssuedAt(identity.issuedAt, ttlMs),
  )
}
