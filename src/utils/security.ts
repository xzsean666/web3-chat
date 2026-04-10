import type { ChatWireMessage, WalletIdentity } from '../types/chat'

const encoder = new TextEncoder()

const SESSION_KEY_ALGORITHM = {
  name: 'ECDSA',
  namedCurve: 'P-256',
} satisfies EcKeyImportParams

const SESSION_SIGNATURE_ALGORITHM = {
  name: 'ECDSA',
  hash: 'SHA-256',
} satisfies EcdsaParams

type SignableValue = boolean | number | string | null | SignableValue[] | {
  [key: string]: SignableValue
}

type MessageSigner = Pick<WalletIdentity, 'sessionPrivateKey'>

function arrayBufferToBase64(buffer: ArrayBuffer) {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)))
}

function base64ToUint8Array(value: string) {
  return Uint8Array.from(atob(value), (character) => character.charCodeAt(0))
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

async function importPrivateKey(serializedKey: string) {
  return crypto.subtle.importKey(
    'pkcs8',
    base64ToUint8Array(serializedKey),
    SESSION_KEY_ALGORITHM,
    false,
    ['sign'],
  )
}

async function importPublicKey(serializedKey: string) {
  return crypto.subtle.importKey(
    'spki',
    base64ToUint8Array(serializedKey),
    SESSION_KEY_ALGORITHM,
    false,
    ['verify'],
  )
}

export async function generateSessionKeyPair() {
  const keyPair = await crypto.subtle.generateKey(
    SESSION_KEY_ALGORITHM,
    true,
    ['sign', 'verify'],
  )

  const [publicKey, privateKey] = await Promise.all([
    crypto.subtle.exportKey('spki', keyPair.publicKey),
    crypto.subtle.exportKey('pkcs8', keyPair.privateKey),
  ])

  return {
    publicKey: arrayBufferToBase64(publicKey),
    publicKeyResource: toBase64Url(arrayBufferToBase64(publicKey)),
    privateKey: arrayBufferToBase64(privateKey),
  }
}

export async function signPayload(
  payload: SignableValue,
  identity: MessageSigner,
) {
  const privateKey = await importPrivateKey(identity.sessionPrivateKey)
  const signature = await crypto.subtle.sign(
    SESSION_SIGNATURE_ALGORITHM,
    privateKey,
    encoder.encode(canonicalizePayload(payload)),
  )

  return arrayBufferToBase64(signature)
}

export async function verifyPayloadSignature(
  payload: SignableValue,
  signature: string,
  publicKey: string,
) {
  try {
    const importedKey = await importPublicKey(publicKey)
    return crypto.subtle.verify(
      SESSION_SIGNATURE_ALGORITHM,
      importedKey,
      base64ToUint8Array(signature),
      encoder.encode(canonicalizePayload(payload)),
    )
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
