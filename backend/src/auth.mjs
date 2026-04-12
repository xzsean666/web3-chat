import { createHash, createHmac, randomBytes } from 'node:crypto'
import * as Hex from 'ox/Hex'
import * as P256 from 'ox/P256'
import * as PublicKey from 'ox/PublicKey'
import * as Signature from 'ox/Signature'
import { getAddress, isAddress, verifyMessage } from 'viem'
import { parseSiweMessage } from 'viem/siwe'
import { serverConfig } from './config.mjs'

const APP_RESOURCE_PREFIX = 'urn:web3-chat:app:'
const ORIGIN_RESOURCE_PREFIX = 'urn:web3-chat:origin:'
const SESSION_KEY_RESOURCE_PREFIX = 'urn:web3-chat:session-key:'
const MAX_CLOCK_SKEW_MS = 60_000
const TEST_IDENTITY_MESSAGE_TYPE = 'web3-chat-test-identity'
const encoder = new TextEncoder()

function isRecord(value) {
  return Boolean(value) && typeof value === 'object'
}

function isIdentityAuthMethod(value) {
  return value === 'wallet' || value === 'guest'
}

function toBase64Url(value) {
  return value.replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '')
}

function getResource(resources, prefix) {
  return resources?.find((item) => item.startsWith(prefix))?.slice(prefix.length) ?? null
}

function parseIsoDate(value) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function isValidIssuedAt(value, ttlMs) {
  const issuedAt = parseIsoDate(value)

  if (!issuedAt) {
    return false
  }

  const ageMs = Date.now() - issuedAt.getTime()
  return ageMs >= -MAX_CLOCK_SKEW_MS && ageMs <= ttlMs
}

function base64ToUint8Array(value) {
  return Uint8Array.from(Buffer.from(value, 'base64'))
}

function base64ToPublicKey(value) {
  return PublicKey.fromBytes(base64ToUint8Array(value))
}

function sortObjectKeys(value) {
  if (Array.isArray(value)) {
    return value.map(sortObjectKeys)
  }

  if (!value || typeof value !== 'object') {
    return value
  }

  return Object.keys(value)
    .sort()
    .reduce((accumulator, key) => {
      accumulator[key] = sortObjectKeys(value[key])
      return accumulator
    }, {})
}

function canonicalizePayload(payload) {
  return JSON.stringify(sortObjectKeys(payload))
}

function toPayloadHex(payload) {
  return Hex.fromBytes(encoder.encode(canonicalizePayload(payload)))
}

function verifyPayloadSignature(payload, signature, publicKey) {
  try {
    return P256.verify({
      payload: toPayloadHex(payload),
      publicKey: base64ToPublicKey(publicKey),
      signature: Signature.fromHex(signature),
      hash: true,
    })
  } catch {
    return false
  }
}

function parseTestIdentityMessage(value) {
  try {
    const parsed = JSON.parse(value)

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

    return parsed
  } catch {
    return null
  }
}

function verifyTestIdentity(identity, options) {
  if (!options.enableTestIdentity) {
    return { ok: false, reason: '测试身份模式未开启。' }
  }

  const parsedMessage = parseTestIdentityMessage(identity.message)

  if (!parsedMessage) {
    return { ok: false, reason: '测试身份消息格式无效。' }
  }

  const isSignatureValid = verifyPayloadSignature(
    parsedMessage,
    identity.signature,
    identity.sessionPublicKey,
  )

  if (!isSignatureValid) {
    return { ok: false, reason: '测试身份签名无效。' }
  }

  if (
    parsedMessage.address.toLowerCase() !== identity.address.toLowerCase() ||
    parsedMessage.chainId !== identity.chainId ||
    parsedMessage.sessionId !== identity.sessionId ||
    parsedMessage.nonce !== identity.nonce ||
    parsedMessage.issuedAt !== identity.issuedAt ||
    parsedMessage.domain !== identity.domain ||
    parsedMessage.origin !== identity.origin ||
    parsedMessage.uri !== identity.uri ||
    parsedMessage.appId !== identity.appId ||
    parsedMessage.sessionPublicKey !== identity.sessionPublicKey
  ) {
    return { ok: false, reason: '测试身份字段不匹配。' }
  }

  if (options.expectedOrigin && parsedMessage.origin !== options.expectedOrigin) {
    return { ok: false, reason: '测试身份来源与当前请求来源不一致。' }
  }

  if (
    options.allowedOrigins.length > 0 &&
    !options.allowedOrigins.includes(parsedMessage.origin)
  ) {
    return { ok: false, reason: '测试身份来源未在允许列表中。' }
  }

  if (identity.appId !== options.appId) {
    return { ok: false, reason: '测试身份 appId 不匹配。' }
  }

  if (!isValidIssuedAt(identity.issuedAt, options.ttlMs)) {
    return { ok: false, reason: '测试身份已过期。' }
  }

  return { ok: true }
}

export function normalizeAddress(address) {
  return getAddress(address)
}

export function hashSessionToken(token) {
  return createHash('sha256').update(token).digest('hex')
}

export function createSessionToken() {
  return randomBytes(32).toString('base64url')
}

export function extractBearerToken(authorizationHeader) {
  if (!authorizationHeader) {
    return null
  }

  const [scheme, token] = authorizationHeader.trim().split(/\s+/, 2)
  if (scheme?.toLowerCase() !== 'bearer' || !token) {
    return null
  }

  return token
}

export async function verifyWalletIdentity(identity, options = {}) {
  if (!isRecord(identity)) {
    return { ok: false, reason: '身份载荷必须是对象。' }
  }

  if (
    (identity.authMethod !== undefined &&
      !isIdentityAuthMethod(identity.authMethod)) ||
    typeof identity.address !== 'string' ||
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
    return { ok: false, reason: '身份字段不完整。' }
  }

  if (!isAddress(identity.address)) {
    return { ok: false, reason: '钱包地址格式无效。' }
  }

  const normalizedAddress = normalizeAddress(identity.address)
  const authMethod =
    identity.authMethod ??
    (parseTestIdentityMessage(identity.message) ? 'guest' : 'wallet')

  const mergedOptions = {
    appId: options.appId ?? serverConfig.appId,
    ttlMs: options.ttlMs ?? serverConfig.sessionTtlMs,
    enableTestIdentity:
      options.enableTestIdentity ?? serverConfig.enableTestIdentity,
    expectedOrigin: options.expectedOrigin ?? null,
    allowedOrigins: options.allowedOrigins ?? serverConfig.allowedOrigins,
  }

  if (
    mergedOptions.allowedOrigins.length > 0 &&
    !mergedOptions.allowedOrigins.includes(identity.origin)
  ) {
    return { ok: false, reason: '来源未在允许列表中。' }
  }

  if (mergedOptions.expectedOrigin && identity.origin !== mergedOptions.expectedOrigin) {
    return { ok: false, reason: '签名来源与当前请求来源不一致。' }
  }

  if (authMethod === 'guest') {
    const guestResult = verifyTestIdentity(
      { ...identity, address: normalizedAddress, authMethod },
      mergedOptions,
    )

    return guestResult.ok
      ? {
          ok: true,
          identity: {
            ...identity,
            address: normalizedAddress,
            authMethod,
          },
        }
      : guestResult
  }

  let parsedMessage
  try {
    parsedMessage = parseSiweMessage(identity.message)
  } catch {
    return { ok: false, reason: 'SIWE 消息解析失败。' }
  }

  const messageIssuedAt =
    parsedMessage.issuedAt instanceof Date
      ? parsedMessage.issuedAt.toISOString()
      : null
  const appIdResource = getResource(parsedMessage.resources, APP_RESOURCE_PREFIX)
  const originResource = getResource(parsedMessage.resources, ORIGIN_RESOURCE_PREFIX)
  const sessionKeyResource = getResource(
    parsedMessage.resources,
    SESSION_KEY_RESOURCE_PREFIX,
  )
  const signatureValid = await verifyMessage({
    address: normalizedAddress,
    message: identity.message,
    signature: identity.signature,
  })

  if (!signatureValid) {
    return { ok: false, reason: '钱包签名校验失败。' }
  }

  const expectedSessionKey = toBase64Url(identity.sessionPublicKey)

  if (
    parsedMessage.address !== normalizedAddress ||
    parsedMessage.chainId !== identity.chainId ||
    parsedMessage.domain !== identity.domain ||
    parsedMessage.uri !== identity.uri ||
    parsedMessage.requestId !== identity.sessionId ||
    parsedMessage.nonce !== identity.nonce ||
    messageIssuedAt !== identity.issuedAt ||
    appIdResource !== identity.appId ||
    identity.appId !== mergedOptions.appId ||
    originResource !== identity.origin ||
    sessionKeyResource !== expectedSessionKey ||
    !expectedSessionKey ||
    !isValidIssuedAt(identity.issuedAt, mergedOptions.ttlMs)
  ) {
    return { ok: false, reason: '钱包身份字段校验失败。' }
  }

  return {
    ok: true,
    identity: {
      ...identity,
      address: normalizedAddress,
      authMethod,
    },
  }
}

export function buildTurnCredentials(address) {
  const iceServers = []

  if (serverConfig.stunUrls.length > 0) {
    iceServers.push({
      urls: serverConfig.stunUrls,
    })
  }

  if (serverConfig.turnSecret && serverConfig.turnUrls.length > 0) {
    const expiresAt = Math.floor(Date.now() / 1000) + serverConfig.turnTtlSeconds
    const username = `${expiresAt}:${address.toLowerCase()}`
    const credential = createHmac('sha1', serverConfig.turnSecret)
      .update(username)
      .digest('base64')

    iceServers.push({
      urls: serverConfig.turnUrls,
      username,
      credential,
    })
  }

  return {
    ttlSeconds: serverConfig.turnTtlSeconds,
    iceServers,
  }
}
