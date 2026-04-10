import { computed, markRaw, ref } from 'vue'
import { defineStore } from 'pinia'
import type {
  ActionSender,
  HandshakePayload,
  Room as TrysteroRoom,
} from 'trystero'
import {
  appConfig,
  getFallbackTransportMode,
  getPreferredTransportMode,
  getRtcConfig,
} from '../utils/config'
import { clampText, formatDateTime, parseIsoDate } from '../utils/format'
import {
  buildInviteLink,
  consumeInviteFromLocation,
  generateRoomId,
  generateRoomSecret,
  isInviteExpired,
  parseInvitePayload,
  sanitizeRoomTitle,
} from '../utils/invite'
import {
  loadPersistedState,
  loadSessionIdentity,
  savePersistedState,
  saveSessionIdentity,
} from '../utils/storage'
import {
  createMessageAuthTag,
  signPayload,
  verifyMessageAuthTag,
  verifyPayloadSignature,
} from '../utils/security'
import {
  connectWalletIdentity,
  shortAddress,
  toSharedWalletIdentity,
  verifyWalletIdentity,
} from '../utils/wallet'
import type {
  ChatMessage,
  ChatReceiptWire,
  ChatWireMessage,
  ConnectionState,
  HandshakeAck,
  HandshakeFinalize,
  HandshakeHello,
  HandshakeRoomContext,
  InvitePayload,
  KnownRoom,
  PeerProfile,
  PersistedState,
  RoomKind,
  SharedWalletIdentity,
  TransportMode,
  WalletIdentity,
} from '../types/chat'

type ActiveRoomRuntime = {
  roomId: string
  room: TrysteroRoom
  sendChat: ActionSender<ChatWireMessage>
  transportMode: TransportMode
}

let trysteroModulePromise: Promise<typeof import('trystero')> | null = null

type HandshakeSignaturePayload = {
  type: 'peer-handshake'
  appId: string
  roomId: string
  roomKind: RoomKind
  peerLimit: number
  expiresAt: string
  signerAddress: `0x${string}`
  signerSessionId: string
  audienceAddress: `0x${string}`
  audienceSessionId: string
  signerChallenge: string
  audienceChallenge: string
}

function createInitialState(): PersistedState {
  const persistedState = loadPersistedState()
  return {
    ...persistedState,
    identity: loadSessionIdentity(),
  }
}

function loadTrystero() {
  trysteroModulePromise ??= import('trystero')
  return trysteroModulePromise
}

function toRoomPreview(messages: ChatMessage[] | undefined, hasSecret: boolean) {
  const latestMessage = messages?.at(-1)

  if (latestMessage) {
    return clampText(latestMessage.text, 32)
  }

  return hasSecret ? '等待新消息' : '当前设备仅保留房间索引'
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object'
}

function isChatWireMessage(value: unknown): value is ChatWireMessage {
  if (!isRecord(value)) {
    return false
  }

  return (
    typeof value.id === 'string' &&
    typeof value.roomId === 'string' &&
    typeof value.senderAddress === 'string' &&
    typeof value.senderLabel === 'string' &&
    typeof value.sessionId === 'string' &&
    typeof value.text === 'string' &&
    typeof value.createdAt === 'string' &&
    typeof value.authTag === 'string'
  )
}

function isChatReceiptWire(value: unknown): value is ChatReceiptWire {
  if (!isRecord(value)) {
    return false
  }

  return (
    typeof value.roomId === 'string' &&
    typeof value.messageId === 'string' &&
    typeof value.senderSessionId === 'string' &&
    typeof value.recipientSessionId === 'string' &&
    typeof value.receivedAt === 'string'
  )
}

function isHandshakeRoomContext(
  value: unknown,
): value is HandshakeRoomContext {
  if (!isRecord(value)) {
    return false
  }

  return (
    value.version === 1 &&
    typeof value.appId === 'string' &&
    typeof value.roomId === 'string' &&
    (value.roomKind === 'private' || value.roomKind === 'group') &&
    typeof value.peerLimit === 'number' &&
    typeof value.expiresAt === 'string'
  )
}

function isSharedWalletIdentity(value: unknown): value is SharedWalletIdentity {
  if (!isRecord(value)) {
    return false
  }

  return (
    typeof value.address === 'string' &&
    typeof value.chainId === 'number' &&
    typeof value.signature === 'string' &&
    typeof value.message === 'string' &&
    typeof value.issuedAt === 'string' &&
    typeof value.nonce === 'string' &&
    typeof value.sessionId === 'string' &&
    typeof value.domain === 'string' &&
    typeof value.origin === 'string' &&
    typeof value.uri === 'string' &&
    typeof value.appId === 'string' &&
    typeof value.sessionPublicKey === 'string'
  )
}

function isHandshakeHello(value: unknown): value is HandshakeHello {
  if (!isHandshakeRoomContext(value) || !isRecord(value)) {
    return false
  }

  return (
    value.step === 'hello' &&
    typeof value.address === 'string' &&
    typeof value.label === 'string' &&
    typeof value.sessionId === 'string' &&
    typeof value.challenge === 'string' &&
    isSharedWalletIdentity(value.proof)
  )
}

function isHandshakeAck(value: unknown): value is HandshakeAck {
  if (!isHandshakeRoomContext(value) || !isRecord(value)) {
    return false
  }

  return (
    value.step === 'ack' &&
    typeof value.address === 'string' &&
    typeof value.label === 'string' &&
    typeof value.sessionId === 'string' &&
    typeof value.challenge === 'string' &&
    typeof value.responseSignature === 'string' &&
    isSharedWalletIdentity(value.proof)
  )
}

function isHandshakeFinalize(value: unknown): value is HandshakeFinalize {
  if (!isHandshakeRoomContext(value) || !isRecord(value)) {
    return false
  }

  return (
    value.step === 'finalize' &&
    typeof value.address === 'string' &&
    typeof value.sessionId === 'string' &&
    typeof value.responseSignature === 'string'
  )
}

function getDerivedLabel(address: string) {
  return shortAddress(address)
}

export const useChatAppStore = defineStore('chatApp', () => {
  const initialState = createInitialState()

  const identity = ref<WalletIdentity | null>(initialState.identity)
  const rooms = ref<KnownRoom[]>(initialState.rooms)
  const messagesByRoom = ref<Record<string, ChatMessage[]>>(
    initialState.messagesByRoom,
  )
  const initialRoomId =
    initialState.rooms.find((room) => room.roomId === initialState.currentRoomId)?.roomId ??
    initialState.rooms[0]?.roomId ??
    null
  const currentRoomId = ref<string | null>(
    initialRoomId,
  )
  const peerProfilesMap = ref<Record<string, PeerProfile>>({})
  const connectionState = ref<ConnectionState>('idle')
  const roomErrorMessage = ref('')
  const walletErrorMessage = ref('')
  const walletBusy = ref(false)
  const sendBusy = ref(false)
  const initialized = ref(false)
  const activeRoom = ref<ActiveRoomRuntime | null>(null)
  const transportMode = ref<TransportMode>(getPreferredTransportMode())

  let fallbackTimer: number | null = null
  let connectionAttempt = 0

  const identityLabel = computed(() =>
    identity.value ? shortAddress(identity.value.address) : '未连接钱包',
  )

  const transportLabel = computed(() => {
    if (transportMode.value === 'turn-only') {
      return 'Relay Only'
    }

    if (transportMode.value === 'hybrid') {
      return 'TURN + STUN'
    }

    return 'STUN'
  })

  const transportHint = computed(() => {
    if (transportMode.value === 'turn-only') {
      return '当前先走 relay-only 策略；如果发现对端但 relay 建链失败，会自动回退到 TURN + STUN 混合候选。'
    }

    if (transportMode.value === 'hybrid') {
      return '当前提供 TURN + STUN 候选，最终路径由浏览器 ICE 协商决定，并不保证一定走 TURN。'
    }

    return '当前仅提供 STUN 候选，严格 NAT / 企业网络下可能无法建立连接。'
  })

  const sortedRooms = computed(() =>
    [...rooms.value].sort((left, right) => {
      const leftAnchor = left.lastMessageAt ?? left.lastOpenedAt
      const rightAnchor = right.lastMessageAt ?? right.lastOpenedAt
      return rightAnchor.localeCompare(leftAnchor)
    }),
  )

  const currentRoom = computed(
    () => rooms.value.find((room) => room.roomId === currentRoomId.value) ?? null,
  )

  const currentMessages = computed(() =>
    currentRoomId.value ? messagesByRoom.value[currentRoomId.value] ?? [] : [],
  )

  const peerProfiles = computed(() => Object.values(peerProfilesMap.value))
  const roomPreviewMap = computed(() =>
    rooms.value.reduce<Record<string, string>>((accumulator, room) => {
      accumulator[room.roomId] = toRoomPreview(
        messagesByRoom.value[room.roomId],
        Boolean(room.secret),
      )
      return accumulator
    }, {}),
  )

  function clearFallbackTimer() {
    if (fallbackTimer !== null) {
      window.clearTimeout(fallbackTimer)
      fallbackTimer = null
    }
  }

  function clearRoomError() {
    roomErrorMessage.value = ''
  }

  function clearWalletError() {
    walletErrorMessage.value = ''
  }

  function persist() {
    savePersistedState({
      identity: null,
      rooms: rooms.value,
      messagesByRoom: messagesByRoom.value,
      currentRoomId: currentRoomId.value,
    })
    saveSessionIdentity(identity.value)
  }

  function getRoomContext(room: KnownRoom): HandshakeRoomContext {
    return {
      version: 1,
      appId: appConfig.appId,
      roomId: room.roomId,
      roomKind: room.kind,
      peerLimit: room.peerLimit,
      expiresAt: room.expiresAt,
    }
  }

  function buildHandshakePayload(
    room: KnownRoom,
    signerAddress: `0x${string}`,
    signerSessionId: string,
    audienceAddress: `0x${string}`,
    audienceSessionId: string,
    signerChallenge: string,
    audienceChallenge: string,
  ) {
    return {
      type: 'peer-handshake',
      appId: appConfig.appId,
      roomId: room.roomId,
      roomKind: room.kind,
      peerLimit: room.peerLimit,
      expiresAt: room.expiresAt,
      signerAddress,
      signerSessionId,
      audienceAddress,
      audienceSessionId,
      signerChallenge,
      audienceChallenge,
    } satisfies HandshakeSignaturePayload
  }

  function upsertRoom(payload: InvitePayload) {
    const existing = rooms.value.find((room) => room.roomId === payload.roomId)
    const now = new Date().toISOString()
    const inviteLink = buildInviteLink(payload)

    if (existing) {
      existing.kind = payload.kind
      existing.title = payload.title
      existing.secret = payload.secret
      existing.peerLimit = payload.peerLimit
      existing.expiresAt = payload.expiresAt
      existing.inviteLink = inviteLink
      existing.lastOpenedAt = now
    } else {
      rooms.value.push({
        ...payload,
        createdAt: now,
        createdBy: identity.value?.address ?? 'local',
        inviteLink,
        lastOpenedAt: now,
      })
    }

    persist()
    return rooms.value.find((room) => room.roomId === payload.roomId) ?? null
  }

  function touchRoom(roomId: string) {
    const room = rooms.value.find((item) => item.roomId === roomId)

    if (!room) {
      return
    }

    room.lastOpenedAt = new Date().toISOString()
    persist()
  }

  function appendMessage(roomId: string, message: ChatMessage) {
    const nextMessages = [...(messagesByRoom.value[roomId] ?? [])]
    const existingIndex = nextMessages.findIndex((entry) => entry.id === message.id)

    if (existingIndex >= 0) {
      nextMessages[existingIndex] = {
        ...nextMessages[existingIndex],
        ...message,
      }
    } else {
      nextMessages.push(message)
    }
    messagesByRoom.value = {
      ...messagesByRoom.value,
      [roomId]: nextMessages.slice(-appConfig.roomHistoryLimit),
    }

    const room = rooms.value.find((item) => item.roomId === roomId)
    if (room) {
      room.lastMessageAt = message.createdAt
      room.lastOpenedAt = message.createdAt
    }

    persist()
  }

  function updateMessageStatus(
    roomId: string,
    messageId: string,
    status: 'sending' | 'sent' | 'delivered' | 'failed',
  ) {
    const roomMessages = messagesByRoom.value[roomId]

    if (!roomMessages) {
      return
    }

    const statusPriority = {
      failed: 0,
      sending: 1,
      sent: 2,
      delivered: 3,
    } satisfies Record<'sending' | 'sent' | 'delivered' | 'failed', number>

    const nextMessages = roomMessages.map((message) => {
      if (message.id !== messageId) {
        return message
      }

      const currentStatus = message.status
      if (status === 'failed') {
        return currentStatus === 'delivered'
          ? message
          : {
              ...message,
              status,
            }
      }

      if (
        currentStatus &&
        statusPriority[currentStatus] > statusPriority[status]
      ) {
        return message
      }

      return {
        ...message,
        status,
      }
    })

    messagesByRoom.value = {
      ...messagesByRoom.value,
      [roomId]: nextMessages,
    }
    persist()
  }

  function appendSystemMessage(roomId: string, text: string) {
    appendMessage(roomId, {
      id: crypto.randomUUID(),
      roomId,
      senderAddress: 'system',
      senderLabel: '系统',
      text,
      createdAt: new Date().toISOString(),
      direction: 'system',
    })
  }

  async function leaveActiveRoom() {
    clearFallbackTimer()

    const runtime = activeRoom.value

    if (!runtime) {
      peerProfilesMap.value = {}
      connectionState.value = 'idle'
      return
    }

    activeRoom.value = null
    peerProfilesMap.value = {}
    connectionState.value = 'idle'

    await runtime.room.leave()
  }

  function validateHandshakeContext(
    room: KnownRoom,
    envelope: HandshakeRoomContext,
  ) {
    if (
      envelope.appId !== appConfig.appId ||
      envelope.roomId !== room.roomId ||
      envelope.roomKind !== room.kind ||
      envelope.peerLimit !== room.peerLimit ||
      envelope.expiresAt !== room.expiresAt
    ) {
      throw new Error('远端握手与当前房间配置不匹配。')
    }

    if (isInviteExpired(envelope.expiresAt)) {
      throw new Error('该房间邀请已过期。')
    }
  }

  async function validatePeerProof(
    proof: SharedWalletIdentity,
    address: string,
    sessionId: string,
  ) {
    const isValidIdentity = await verifyWalletIdentity(
      proof,
      appConfig.handshakeTtlMs,
    )

    if (!isValidIdentity || proof.address !== address || proof.sessionId !== sessionId) {
      throw new Error('远端钱包签名验证失败。')
    }
  }

  function ensurePeerAllowed(
    room: KnownRoom,
    peerId: string,
    proof: SharedWalletIdentity,
  ) {
    const duplicateSession = Object.entries(peerProfilesMap.value).find(
      ([existingPeerId, profile]) =>
        existingPeerId !== peerId &&
        profile.address === proof.address &&
        profile.sessionId === proof.sessionId,
    )

    if (duplicateSession) {
      throw new Error('检测到重复会话，已拒绝本次连接。')
    }

    if (
      Object.keys(peerProfilesMap.value).length >= room.peerLimit - 1 &&
      !peerProfilesMap.value[peerId]
    ) {
      throw new Error(
        room.kind === 'private'
          ? '该私聊房间已达到人数上限。'
          : '该群聊房间已达到人数上限。',
      )
    }
  }

  function registerPeer(
    peerId: string,
    proof: SharedWalletIdentity,
  ) {
    peerProfilesMap.value = {
      ...peerProfilesMap.value,
      [peerId]: {
        peerId,
        address: proof.address,
        label: getDerivedLabel(proof.address),
        sessionId: proof.sessionId,
        joinedAt: new Date().toISOString(),
        verifiedAt: new Date().toISOString(),
        proof,
      },
    }

    connectionState.value = 'ready'
  }

  function clearSessionRoomState() {
    rooms.value = rooms.value.map((room) => ({
      ...room,
      inviteLink: undefined,
      secret: undefined,
    }))
    messagesByRoom.value = {}
    currentRoomId.value = null
    peerProfilesMap.value = {}
  }

  function findRoomConflict(payload: InvitePayload) {
    const existing = rooms.value.find((room) => room.roomId === payload.roomId)

    if (!existing) {
      return null
    }

    if (
      existing.kind !== payload.kind ||
      existing.peerLimit !== payload.peerLimit ||
      existing.secret && existing.secret !== payload.secret
    ) {
      return '本地已存在同 ID 但配置不同的房间，已拒绝覆盖，请重新确认邀请链接。'
    }

    return null
  }

  function shouldAutoConnectRoom(roomId: string | null) {
    if (!roomId) {
      return false
    }

    return Boolean(rooms.value.find((room) => room.roomId === roomId)?.secret)
  }

  async function createHandshakeResponseSignature(
    room: KnownRoom,
    remoteProof: SharedWalletIdentity,
    localChallenge: string,
    remoteChallenge: string,
  ) {
    if (!identity.value) {
      throw new Error('缺少钱包签名身份。')
    }

    return signPayload(
      buildHandshakePayload(
        room,
        identity.value.address,
        identity.value.sessionId,
        remoteProof.address,
        remoteProof.sessionId,
        localChallenge,
        remoteChallenge,
      ),
      identity.value,
    )
  }

  async function verifyHandshakeResponseSignature(
    room: KnownRoom,
    signerProof: SharedWalletIdentity,
    audienceAddress: `0x${string}`,
    audienceSessionId: string,
    signerChallenge: string,
    audienceChallenge: string,
    signature: string,
  ) {
    return verifyPayloadSignature(
      buildHandshakePayload(
        room,
        signerProof.address,
        signerProof.sessionId,
        audienceAddress,
        audienceSessionId,
        signerChallenge,
        audienceChallenge,
      ),
      signature,
      signerProof.sessionPublicKey,
    )
  }

  async function performPeerHandshake(
    room: KnownRoom,
    peerId: string,
    send: (data: HandshakeHello | HandshakeAck | HandshakeFinalize) => Promise<void>,
    receive: () => Promise<HandshakePayload>,
    isInitiator: boolean,
  ) {
    if (!identity.value) {
      throw new Error('缺少钱包签名身份。')
    }

    const localProof = toSharedWalletIdentity(identity.value)
    const baseContext = getRoomContext(room)

    if (isInitiator) {
      const localChallenge = crypto.randomUUID()
      const hello = {
        ...baseContext,
        step: 'hello',
        address: localProof.address,
        label: getDerivedLabel(localProof.address),
        sessionId: localProof.sessionId,
        challenge: localChallenge,
        proof: localProof,
      } satisfies HandshakeHello

      await send(hello)

      const ackPayload = await receive()
      if (!isHandshakeAck(ackPayload.data)) {
        throw new Error('远端握手确认格式非法。')
      }

      validateHandshakeContext(room, ackPayload.data)
      await validatePeerProof(
        ackPayload.data.proof,
        ackPayload.data.address,
        ackPayload.data.sessionId,
      )
      ensurePeerAllowed(room, peerId, ackPayload.data.proof)

      const ackVerified = await verifyHandshakeResponseSignature(
        room,
        ackPayload.data.proof,
        localProof.address,
        localProof.sessionId,
        ackPayload.data.challenge,
        localChallenge,
        ackPayload.data.responseSignature,
      )

      if (!ackVerified) {
        throw new Error('远端握手挑战响应校验失败。')
      }

      const finalize = {
        ...baseContext,
        step: 'finalize',
        address: localProof.address,
        sessionId: localProof.sessionId,
        responseSignature: await createHandshakeResponseSignature(
          room,
          ackPayload.data.proof,
          localChallenge,
          ackPayload.data.challenge,
        ),
      } satisfies HandshakeFinalize

      await send(finalize)
      registerPeer(peerId, ackPayload.data.proof)
      return
    }

    const helloPayload = await receive()
    if (!isHandshakeHello(helloPayload.data)) {
      throw new Error('远端握手请求格式非法。')
    }

    validateHandshakeContext(room, helloPayload.data)
    await validatePeerProof(
      helloPayload.data.proof,
      helloPayload.data.address,
      helloPayload.data.sessionId,
    )
    ensurePeerAllowed(room, peerId, helloPayload.data.proof)

    const localChallenge = crypto.randomUUID()
    const ack = {
      ...baseContext,
      step: 'ack',
      address: localProof.address,
      label: getDerivedLabel(localProof.address),
      sessionId: localProof.sessionId,
      challenge: localChallenge,
      proof: localProof,
      responseSignature: await createHandshakeResponseSignature(
        room,
        helloPayload.data.proof,
        localChallenge,
        helloPayload.data.challenge,
      ),
    } satisfies HandshakeAck

    await send(ack)

    const finalizePayload = await receive()
    if (!isHandshakeFinalize(finalizePayload.data)) {
      throw new Error('远端握手完成包格式非法。')
    }

    validateHandshakeContext(room, finalizePayload.data)

    if (
      finalizePayload.data.address !== helloPayload.data.address ||
      finalizePayload.data.sessionId !== helloPayload.data.sessionId
    ) {
      throw new Error('远端最终握手会话与初始声明不一致。')
    }

    const finalizeVerified = await verifyHandshakeResponseSignature(
      room,
      helloPayload.data.proof,
      localProof.address,
      localProof.sessionId,
      helloPayload.data.challenge,
      localChallenge,
      finalizePayload.data.responseSignature,
    )

    if (!finalizeVerified) {
      throw new Error('远端最终握手响应校验失败。')
    }

    registerPeer(peerId, helloPayload.data.proof)
  }

  async function reopenRoomWithMode(roomId: string, mode: TransportMode) {
    await leaveActiveRoom()

    if (!identity.value || currentRoomId.value !== roomId) {
      return
    }

    const room = rooms.value.find((item) => item.roomId === roomId)
    if (!room) {
      return
    }

    await openRoomConnection(room, mode)
  }

  function scheduleTurnFallback(room: KnownRoom, attemptId: number) {
    if (transportMode.value !== 'turn-only') {
      return
    }

    const fallbackMode = getFallbackTransportMode()
    clearFallbackTimer()
    fallbackTimer = window.setTimeout(() => {
      const runtime = activeRoom.value
      const peerCount = runtime
        ? Object.keys(runtime.room.getPeers()).length
        : 0

      if (
        attemptId !== connectionAttempt ||
        runtime?.roomId !== room.roomId ||
        peerProfiles.value.length > 0 ||
        peerCount === 0
      ) {
        return
      }

      appendSystemMessage(
        room.roomId,
        '检测到对端但 relay-only 建链超时，已自动切换为 TURN + STUN 混合候选。',
      )
      void reopenRoomWithMode(room.roomId, fallbackMode)
    }, appConfig.turnOnlyTimeoutMs)
  }

  async function openRoomConnection(room: KnownRoom, mode: TransportMode) {
    if (!room.secret) {
      roomErrorMessage.value = '当前设备未保存该房间口令，请重新导入邀请链接。'
      connectionState.value = 'error'
      return
    }

    connectionAttempt += 1
    const attemptId = connectionAttempt

    clearRoomError()
    connectionState.value = 'joining'
    transportMode.value = mode
    touchRoom(room.roomId)

    const { joinRoom } = await loadTrystero()

    const runtimeRoom = joinRoom(
      {
        appId: appConfig.appId,
        password: room.secret,
        rtcConfig: getRtcConfig(mode),
        ...(appConfig.relayUrls.length ? { relayUrls: appConfig.relayUrls } : {}),
      },
      room.roomId,
      {
        handshakeTimeoutMs: 15000,
        onJoinError: ({ error }) => {
          if (mode === 'turn-only') {
            appendSystemMessage(
              room.roomId,
              'relay-only 尝试失败，已切换为 TURN + STUN 混合候选继续建链。',
            )
            void reopenRoomWithMode(room.roomId, getFallbackTransportMode())
            return
          }

          roomErrorMessage.value = error
          connectionState.value = 'error'
        },
        onPeerHandshake: async (peerId, send, receive, isInitiator) => {
          await performPeerHandshake(room, peerId, send, receive, isInitiator)
        },
      },
    )

    const [sendChat, receiveChat] =
      runtimeRoom.makeAction<ChatWireMessage>('chat-message')
    const [sendReceipt, receiveReceipt] =
      runtimeRoom.makeAction<ChatReceiptWire>('chat-receipt')

    receiveChat((payload, peerId) => {
      void (async () => {
        if (!isChatWireMessage(payload)) {
          return
        }

        const verifiedPeer = peerProfilesMap.value[peerId]
        if (
          !verifiedPeer ||
          payload.senderAddress !== verifiedPeer.address ||
          payload.sessionId !== verifiedPeer.sessionId
        ) {
          return
        }

        const createdAt = parseIsoDate(payload.createdAt)
        if (!createdAt) {
          return
        }

        const payloadAge = Math.abs(Date.now() - createdAt.getTime())
        if (payloadAge > appConfig.messageFreshnessMs) {
          return
        }

        const isValidAuthTag = await verifyMessageAuthTag(
          payload,
          verifiedPeer.proof.sessionPublicKey,
        )
        if (!isValidAuthTag) {
          return
        }

        const text = clampText(payload.text, appConfig.maxMessageLength)
        if (!text) {
          return
        }

        appendMessage(room.roomId, {
          id: payload.id,
          roomId: room.roomId,
          senderAddress: payload.senderAddress,
          senderLabel: verifiedPeer.label,
          text,
          createdAt: payload.createdAt,
          direction: 'inbound',
          peerId,
        })

        const activeIdentity = identity.value
        if (!activeIdentity) {
          return
        }

        const receipt = {
          roomId: room.roomId,
          messageId: payload.id,
          senderSessionId: payload.sessionId,
          recipientSessionId: activeIdentity.sessionId,
          receivedAt: new Date().toISOString(),
        } satisfies ChatReceiptWire

        try {
          await sendReceipt(receipt, peerId)
        } catch {
          // Best-effort delivery signal only.
        }
      })()
    })

    receiveReceipt((payload, peerId) => {
      if (!isChatReceiptWire(payload) || payload.roomId !== room.roomId) {
        return
      }

      const activeIdentity = identity.value
      const verifiedPeer = peerProfilesMap.value[peerId]

      if (!activeIdentity || !verifiedPeer) {
        return
      }

      if (
        payload.senderSessionId !== activeIdentity.sessionId ||
        payload.recipientSessionId !== verifiedPeer.sessionId ||
        !parseIsoDate(payload.receivedAt)
      ) {
        return
      }

      updateMessageStatus(room.roomId, payload.messageId, 'delivered')
    })

    runtimeRoom.onPeerJoin((peerId) => {
      clearFallbackTimer()
      const profile = peerProfilesMap.value[peerId]

      const modeLabel =
        transportMode.value === 'turn-only'
          ? 'relay-only'
          : transportMode.value === 'hybrid'
            ? 'TURN + STUN 混合候选'
            : '仅 STUN'

      appendSystemMessage(
        room.roomId,
        `${profile?.label ?? '新成员'} 已加入，当前 ICE 策略：${modeLabel}。`,
      )
    })

    runtimeRoom.onPeerLeave((peerId) => {
      const profile = peerProfilesMap.value[peerId]

      if (profile) {
        appendSystemMessage(room.roomId, `${profile.label} 已离开。`)
      }

      const nextPeers = { ...peerProfilesMap.value }
      delete nextPeers[peerId]
      peerProfilesMap.value = nextPeers
      connectionState.value = Object.keys(nextPeers).length ? 'ready' : 'idle'
    })

    activeRoom.value = {
      roomId: room.roomId,
      room: markRaw(runtimeRoom),
      sendChat: markRaw(sendChat),
      transportMode: mode,
    }

    connectionState.value = Object.keys(peerProfilesMap.value).length ? 'ready' : 'idle'
    scheduleTurnFallback(room, attemptId)
  }

  async function ensureRoomConnection(roomId = currentRoomId.value) {
    if (!roomId || !identity.value) {
      return
    }

    if (activeRoom.value?.roomId === roomId) {
      return
    }

    const room = rooms.value.find((item) => item.roomId === roomId)
    if (!room) {
      return
    }

    if (!room.secret) {
      roomErrorMessage.value = '当前设备未保存该房间口令，请重新导入邀请链接。'
      connectionState.value = 'error'
      return
    }

    if (isInviteExpired(room.expiresAt)) {
      roomErrorMessage.value = `该邀请已于 ${formatDateTime(room.expiresAt)} 过期，请创建新的房间。`
      connectionState.value = 'error'
      return
    }

    await leaveActiveRoom()
    await openRoomConnection(room, getPreferredTransportMode())
  }

  async function initialize() {
    if (initialized.value) {
      return
    }

    initialized.value = true

    if (
      identity.value &&
      !(await verifyWalletIdentity(identity.value, appConfig.handshakeTtlMs))
    ) {
      identity.value = null
      walletErrorMessage.value = '本地会话签名已失效，请重新连接钱包。'
    }

    const invite = consumeInviteFromLocation()
    if (invite) {
      const inviteConflict = findRoomConflict(invite)

      if (isInviteExpired(invite.expiresAt)) {
        roomErrorMessage.value = '地址栏中的邀请已过期，已拒绝导入。'
      } else if (inviteConflict) {
        roomErrorMessage.value = inviteConflict
      } else {
        upsertRoom(invite)
        currentRoomId.value = invite.roomId
        appendSystemMessage(
          invite.roomId,
          '检测到地址栏邀请，已导入到本地，并自动从 URL 中清除了房间口令。',
        )
      }
    }

    persist()

    const startupRoomId = shouldAutoConnectRoom(currentRoomId.value)
      ? currentRoomId.value
      : null

    if (identity.value && startupRoomId) {
      await ensureRoomConnection(startupRoomId)
    }
  }

  async function connectWallet() {
    walletBusy.value = true
    clearWalletError()
    clearRoomError()

    try {
      identity.value = await connectWalletIdentity()
      persist()

      if (shouldAutoConnectRoom(currentRoomId.value)) {
        await ensureRoomConnection(currentRoomId.value)
      }
    } catch (error) {
      walletErrorMessage.value =
        error instanceof Error ? error.message : '钱包连接失败。'
    } finally {
      walletBusy.value = false
    }
  }

  async function disconnectWallet() {
    await leaveActiveRoom()
    clearSessionRoomState()
    identity.value = null
    clearWalletError()
    clearRoomError()
    persist()
  }

  async function createRoom(kind: RoomKind, title: string) {
    clearRoomError()

    const payload = {
      roomId: generateRoomId(),
      kind,
      title: sanitizeRoomTitle(title, kind),
      secret: generateRoomSecret(),
      peerLimit: kind === 'private' ? 2 : 8,
      expiresAt: new Date(Date.now() + appConfig.inviteTtlMs).toISOString(),
    } satisfies InvitePayload

    const room = upsertRoom(payload)
    if (!room) {
      return null
    }

    currentRoomId.value = room.roomId
    appendSystemMessage(
      room.roomId,
      `房间已创建，有效期至 ${formatDateTime(room.expiresAt)}。请尽快发送邀请。`,
    )
    persist()

    if (identity.value) {
      await ensureRoomConnection(room.roomId)
    }

    return room
  }

  async function importInvite(raw: string) {
    clearRoomError()

    const payload = parseInvitePayload(raw)

    if (!payload) {
      roomErrorMessage.value = '邀请链接格式无效。'
      return null
    }

    if (isInviteExpired(payload.expiresAt)) {
      roomErrorMessage.value = '邀请链接已过期。'
      return null
    }

    const conflictError = findRoomConflict(payload)
    if (conflictError) {
      roomErrorMessage.value = conflictError
      return null
    }

    const room = upsertRoom(payload)
    if (!room) {
      return null
    }

    currentRoomId.value = room.roomId
    appendSystemMessage(
      room.roomId,
      `邀请已导入，有效期至 ${formatDateTime(room.expiresAt)}。`,
    )
    persist()

    if (identity.value && shouldAutoConnectRoom(room.roomId)) {
      await ensureRoomConnection(room.roomId)
    }

    return room
  }

  async function selectRoom(roomId: string) {
    clearRoomError()
    currentRoomId.value = roomId
    touchRoom(roomId)
    persist()

    if (identity.value) {
      await ensureRoomConnection(roomId)
    }
  }

  async function reconnectCurrentRoom() {
    const roomId = currentRoomId.value
    if (!roomId) {
      return
    }

    clearRoomError()
    await leaveActiveRoom()
    if (identity.value) {
      await ensureRoomConnection(roomId)
    }
  }

  async function sendMessage(rawText: string) {
    const room = currentRoom.value
    const activeIdentity = identity.value
    const runtime = activeRoom.value

    if (!room || !activeIdentity) {
      return false
    }

    if (!room.secret) {
      roomErrorMessage.value = '当前设备未保存该房间口令，请重新导入邀请链接。'
      return false
    }

    if (isInviteExpired(room.expiresAt)) {
      roomErrorMessage.value = '当前房间邀请已过期，无法继续发送消息。'
      return false
    }

    const text = clampText(rawText, appConfig.maxMessageLength)
    if (!text) {
      return false
    }

    if (!runtime || runtime.roomId !== room.roomId) {
      roomErrorMessage.value = '当前房间尚未建立可用连接，请先重连。'
      return false
    }

    if (Object.keys(peerProfilesMap.value).length === 0) {
      roomErrorMessage.value = '当前没有可用对端，消息未发送。'
      return false
    }

    sendBusy.value = true
    clearRoomError()

    let pendingMessageId: string | null = null

    try {
      const unsignedMessage = {
        id: crypto.randomUUID(),
        roomId: room.roomId,
        senderAddress: activeIdentity.address,
        senderLabel: shortAddress(activeIdentity.address),
        sessionId: activeIdentity.sessionId,
        text,
        createdAt: new Date().toISOString(),
      } satisfies Omit<ChatWireMessage, 'authTag'>

      const wireMessage = {
        ...unsignedMessage,
        authTag: await createMessageAuthTag(unsignedMessage, activeIdentity),
      } satisfies ChatWireMessage
      pendingMessageId = wireMessage.id

      appendMessage(room.roomId, {
        id: wireMessage.id,
        roomId: room.roomId,
        senderAddress: wireMessage.senderAddress,
        senderLabel: wireMessage.senderLabel,
        text: wireMessage.text,
        createdAt: wireMessage.createdAt,
        direction: 'outbound',
        status: 'sending',
      })

      await runtime.sendChat(wireMessage)
      updateMessageStatus(room.roomId, wireMessage.id, 'sent')

      return true
    } catch (error) {
      if (pendingMessageId) {
        updateMessageStatus(room.roomId, pendingMessageId, 'failed')
      }
      roomErrorMessage.value =
        error instanceof Error ? error.message : '消息发送失败。'
      return false
    } finally {
      sendBusy.value = false
    }
  }

  return {
    identity,
    currentRoomId,
    currentRoom,
    currentMessages,
    peerProfiles,
    roomPreviewMap,
    sortedRooms,
    connectionState,
    roomErrorMessage,
    walletErrorMessage,
    walletBusy,
    sendBusy,
    identityLabel,
    maxMessageLength: appConfig.maxMessageLength,
    transportMode,
    transportLabel,
    transportHint,
    initialize,
    connectWallet,
    disconnectWallet,
    createRoom,
    importInvite,
    selectRoom,
    reconnectCurrentRoom,
    sendMessage,
  }
})
