import * as P256 from 'ox/P256'
import * as PublicKey from 'ox/PublicKey'
import * as Signature from 'ox/Signature'
import * as Hex from 'ox/Hex'
import type { ChatWireMessage, WalletIdentity } from '../types/chat'

const encoder = new TextEncoder()

type SignableValue = boolean | number | string | null | SignableValue[] | {
  [key: string]: SignableValue
}

type MessageSigner = Pick<WalletIdentity, 'sessionPrivateKey'>

type BufferLike = ArrayLike<number> & {
  toString(encoding: string): string
}

type BufferConstructorLike = {
  from(input: Uint8Array | string, encoding?: string): BufferLike
}

function getBufferConstructor() {
  return (globalThis as { Buffer?: BufferConstructorLike }).Buffer
}

function bytesToBase64(bytes: Uint8Array) {
  if (typeof btoa === 'function') {
    return btoa(String.fromCharCode(...bytes))
  }

  const BufferConstructor = getBufferConstructor()
  if (!BufferConstructor) {
    throw new Error('Base64 encoding is unavailable in the current runtime.')
  }

  return BufferConstructor.from(bytes).toString('base64')
}

function base64ToUint8Array(value: string) {
  if (typeof atob === 'function') {
    return Uint8Array.from(atob(value), (character) => character.charCodeAt(0))
  }

  const BufferConstructor = getBufferConstructor()
  if (!BufferConstructor) {
    throw new Error('Base64 decoding is unavailable in the current runtime.')
  }

  return Uint8Array.from(BufferConstructor.from(value, 'base64'))
}

function base64ToPublicKey(value: string) {
  return PublicKey.fromBytes(base64ToUint8Array(value))
}

function base64ToPrivateKey(value: string) {
  return base64ToUint8Array(value)
}

function toBase64Url(value: string) {
  return value.replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '')
}

function sortObjectKeys(value: SignableValue): SignableValue {
  if (Array.isArray(value)) {
    return value.map(sortObjectKeys)
  }

  if (!value || typeof value !== 'object') {
    return value
  }

  return Object.keys(value)
    .sort()
    .reduce<Record<string, SignableValue>>((accumulator, key) => {
      accumulator[key] = sortObjectKeys(value[key] as SignableValue)
      return accumulator
    }, {})
}

function canonicalizePayload(payload: SignableValue) {
  return JSON.stringify(sortObjectKeys(payload))
}

function toPayloadHex(payload: SignableValue) {
  return Hex.fromBytes(encoder.encode(canonicalizePayload(payload)))
}

export async function generateSessionKeyPair() {
  const keyPair = P256.createKeyPair({ as: 'Bytes' })
  const publicKey = PublicKey.toBytes(keyPair.publicKey)
  const privateKey = keyPair.privateKey

  return {
    publicKey: bytesToBase64(publicKey),
    publicKeyResource: toBase64Url(bytesToBase64(publicKey)),
    privateKey: bytesToBase64(privateKey),
  }
}

export async function signPayload(
  payload: SignableValue,
  identity: MessageSigner,
) {
  const signature = P256.sign({
    payload: toPayloadHex(payload),
    privateKey: base64ToPrivateKey(identity.sessionPrivateKey),
    hash: true,
  })

  return Signature.toHex(signature)
}

export async function verifyPayloadSignature(
  payload: SignableValue,
  signature: string,
  publicKey: string,
) {
  try {
    return P256.verify({
      payload: toPayloadHex(payload),
      publicKey: base64ToPublicKey(publicKey),
      signature: Signature.fromHex(signature as `0x${string}`),
      hash: true,
    })
  } catch {
    return false
  }
}

function canonicalizeMessage(message: Omit<ChatWireMessage, 'authTag'>) {
  return {
    type: 'chat-message',
    id: message.id,
    roomId: message.roomId,
    senderAddress: message.senderAddress,
    senderLabel: message.senderLabel,
    sessionId: message.sessionId,
    text: message.text,
    createdAt: message.createdAt,
  } satisfies SignableValue
}

export async function createMessageAuthTag(
  message: Omit<ChatWireMessage, 'authTag'>,
  identity: MessageSigner,
) {
  return signPayload(canonicalizeMessage(message), identity)
}

export async function verifyMessageAuthTag(
  message: ChatWireMessage,
  sessionPublicKey: string,
) {
  return verifyPayloadSignature(
    canonicalizeMessage({
      id: message.id,
      roomId: message.roomId,
      senderAddress: message.senderAddress,
      senderLabel: message.senderLabel,
      sessionId: message.sessionId,
      text: message.text,
      createdAt: message.createdAt,
    }),
    message.authTag,
    sessionPublicKey,
  )
}
