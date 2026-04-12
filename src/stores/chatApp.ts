import { computed, ref, watch } from 'vue'
import { defineStore } from 'pinia'
import { appConfig, buildRtcConfig } from '../utils/config'
import { clampText, parseIsoDate } from '../utils/format'
import {
  acceptFriendRequest as acceptFriendRequestApi,
  buildBackendWsUrl,
  createBackendSession,
  createGroup as createGroupApi,
  fetchFriends,
  fetchGroups,
  fetchMe,
  fetchTurnCredentials,
  revokeBackendSession,
  sendFriendRequest as sendFriendRequestApi,
} from '../utils/backend'
import {
  clearPersistedSession,
  loadPersistedState,
  loadSessionIdentity,
  savePersistedState,
  saveSessionIdentity,
} from '../utils/storage'
import { createMessageAuthTag, verifyMessageAuthTag } from '../utils/security'
import {
  connectTestIdentity as createTestIdentity,
  connectWalletIdentity,
  shortAddress,
} from '../utils/wallet'
import { generateUuid } from '../utils/uuid'
import type {
  BackendUser,
  ChatMessage,
  ChatMessageStatus,
  ChatWireMessage,
  ConnectionState,
  ConversationSummary,
  FriendRecord,
  GroupRecord,
  IdentityAuthMethod,
  PeerProfile,
  PersistedState,
  WalletIdentity,
} from '../types/chat'

type SignalPeerDescriptor = {
  connectionId: string
  userId: number
  address: `0x${string}`
  authMethod: IdentityAuthMethod
  sessionId: string
  sessionPublicKey: string
  connectedAt: string
}

type RoomSubscribedPayload = {
  type: 'room.subscribed'
  roomKey: string
  roomType: 'direct' | 'group'
  peers: SignalPeerDescriptor[]
}

type PeerJoinedPayload = {
  type: 'peer.joined'
  roomKey: string
  peer: SignalPeerDescriptor
}

type PeerLeftPayload = {
  type: 'peer.left'
  roomKey: string
  peer: SignalPeerDescriptor
}

type SignalPayload = {
  roomKey: string
  from: SignalPeerDescriptor
  description?: RTCSessionDescriptionInit
  candidate?: RTCIceCandidateInit
}

type PeerRuntime = {
  key: string
  conversationId: string
  peer: SignalPeerDescriptor
  pc: RTCPeerConnection
  channel: RTCDataChannel | null
  isInitiator: boolean
  pendingCandidates: RTCIceCandidateInit[]
}

function createInitialState(): PersistedState {
  const persistedState = loadPersistedState()
  return {
    ...persistedState,
    identity: loadSessionIdentity(),
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object'
}

function isSignalPeerDescriptor(value: unknown): value is SignalPeerDescriptor {
  if (!isRecord(value)) {
    return false
  }

  return (
    typeof value.connectionId === 'string' &&
    typeof value.userId === 'number' &&
    typeof value.address === 'string' &&
    (value.authMethod === 'wallet' || value.authMethod === 'guest') &&
    typeof value.sessionId === 'string' &&
    typeof value.sessionPublicKey === 'string' &&
    typeof value.connectedAt === 'string'
  )
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

function createDirectConversationId(addressA: string, addressB: string) {
  return `direct:${[addressA.toLowerCase(), addressB.toLowerCase()].sort().join(':')}`
}

function createGroupConversationId(groupId: string) {
  return `group:${groupId}`
}

function compareDatesDesc(left?: string, right?: string) {
  const leftTime = parseIsoDate(left ?? '')?.getTime() ?? 0
  const rightTime = parseIsoDate(right ?? '')?.getTime() ?? 0
  return rightTime - leftTime
}

function countUniqueUsers(peers: SignalPeerDescriptor[]) {
  return new Set(peers.map((peer) => peer.userId)).size
}

function normalizePeers(peers: SignalPeerDescriptor[], selfConnectionId?: string) {
  const byConnectionId = new Map<string, SignalPeerDescriptor>()

  for (const peer of peers) {
    if (peer.connectionId === selfConnectionId) {
      continue
    }

    byConnectionId.set(peer.connectionId, peer)
  }

  return [...byConnectionId.values()].sort((left, right) =>
    compareDatesDesc(right.connectedAt, left.connectedAt),
  )
}

function stringifyError(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback
}

function hasTurnServer(iceServers: RTCIceServer[]) {
  return iceServers.some((server) => {
    const urls = Array.isArray(server.urls) ? server.urls : [server.urls]
    return urls.some((url) => url.startsWith('turn:') || url.startsWith('turns:'))
  })
}

function toSessionDescription(description: RTCSessionDescription | null) {
  if (!description) {
    return null
  }

  return {
    type: description.type,
    sdp: description.sdp ?? '',
  } satisfies RTCSessionDescriptionInit
}

function parseDataMessage(rawData: string | ArrayBuffer | Blob) {
  if (typeof rawData === 'string') {
    return rawData
  }

  if (rawData instanceof ArrayBuffer) {
    return new TextDecoder().decode(rawData)
  }

  return null
}

export const useChatAppStore = defineStore('chatApp', () => {
  const initialState = createInitialState()

  const identity = ref<WalletIdentity | null>(initialState.identity)
  const authToken = ref<string | null>(initialState.authToken)
  const authExpiresAt = ref<string | null>(initialState.authExpiresAt)
  const me = ref<BackendUser | null>(null)
  const messagesByConversation = ref<Record<string, ChatMessage[]>>(
    initialState.messagesByConversation,
  )
  const currentConversationId = ref<string | null>(
    initialState.currentConversationId,
  )
  const acceptedFriends = ref<FriendRecord[]>([])
  const pendingInbound = ref<FriendRecord[]>([])
  const pendingOutbound = ref<FriendRecord[]>([])
  const groups = ref<GroupRecord[]>([])
  const walletBusy = ref(false)
  const walletErrorMessage = ref('')
  const roomErrorMessage = ref('')
  const sendBusy = ref(false)
  const connectionState = ref<ConnectionState>('idle')
  const conversationPeers = ref<Record<string, SignalPeerDescriptor[]>>({})
  const iceServers = ref<RTCIceServer[]>(appConfig.fallbackIceServers)
  const wsConnected = ref(false)

  let turnExpiresAt = 0
  let ws: WebSocket | null = null
  let wsConnectPromise: Promise<void> | null = null
  let resolveWsConnect: (() => void) | null = null
  let rejectWsConnect: ((error: Error) => void) | null = null
  let wsPingTimer: number | null = null
  let wsReconnectTimer: number | null = null
  let directoryRefreshTimer: number | null = null
  let refreshingDirectory = false
  let selfConnection: SignalPeerDescriptor | null = null
  let allowSocketReconnect = false

  const joinedRooms = new Set<string>()
  const pendingRoomSubscriptions = new Set<string>()
  const peerRuntimes = new Map<string, PeerRuntime>()

  const testIdentityEnabled = appConfig.enableTestIdentity
  const maxMessageLength = appConfig.maxMessageLength

  const sortedConversations = computed<ConversationSummary[]>(() => {
    const selfAddress = identity.value?.address ?? me.value?.address

    if (!selfAddress) {
      return []
    }

    const directConversations = acceptedFriends.value.map((record) => {
      const conversationId = createDirectConversationId(
        selfAddress,
        record.friend.address,
      )
      const latestMessage = messagesByConversation.value[conversationId]?.at(-1)
      const onlineCount = countUniqueUsers(
        conversationPeers.value[conversationId] ?? [],
      )

      return {
        id: conversationId,
        title: shortAddress(record.friend.address),
        kind: 'private',
        directAddress: record.friend.address,
        lastMessageAt: latestMessage?.createdAt ?? record.updatedAt,
        onlineCount: onlineCount || (record.online ? 1 : 0),
      } satisfies ConversationSummary
    })

    const groupConversations = groups.value.map((group) => {
      const conversationId = createGroupConversationId(group.id)
      const latestMessage = messagesByConversation.value[conversationId]?.at(-1)
      const onlineCount = countUniqueUsers(
        conversationPeers.value[conversationId] ?? [],
      )

      return {
        id: conversationId,
        title: group.name,
        kind: 'group',
        groupId: group.id,
        lastMessageAt: latestMessage?.createdAt ?? group.updatedAt,
        onlineCount: onlineCount || group.onlineMemberCount,
      } satisfies ConversationSummary
    })

    return [...directConversations, ...groupConversations].sort((left, right) =>
      compareDatesDesc(left.lastMessageAt, right.lastMessageAt),
    )
  })

  const currentConversation = computed(
    () =>
      sortedConversations.value.find(
        (conversation) => conversation.id === currentConversationId.value,
      ) ?? null,
  )

  const currentMessages = computed(() =>
    currentConversationId.value
      ? messagesByConversation.value[currentConversationId.value] ?? []
      : [],
  )

  const peerProfiles = computed<PeerProfile[]>(() => {
    if (!currentConversationId.value) {
      return []
    }

    return (conversationPeers.value[currentConversationId.value] ?? []).map((peer) => ({
      peerId: peer.connectionId,
      address: peer.address,
      label: shortAddress(peer.address),
      sessionId: peer.sessionId,
      sessionPublicKey: peer.sessionPublicKey,
      joinedAt: peer.connectedAt,
      verifiedAt: peer.connectedAt,
    }))
  })

  const transportLabel = computed(() =>
    hasTurnServer(iceServers.value)
      ? '后端信令 + P2P（STUN / TURN）'
      : '后端信令 + P2P（STUN）',
  )

  const canSendCurrentConversation = computed(() =>
    getReadyRuntimes(currentConversationId.value).length > 0,
  )

  function persistState() {
    savePersistedState({
      identity: null,
      authToken: authToken.value,
      authExpiresAt: authExpiresAt.value,
      currentConversationId: currentConversationId.value,
      messagesByConversation: messagesByConversation.value,
    })
  }

  function syncConnectionState() {
    const conversationId = currentConversationId.value

    if (!identity.value || !conversationId) {
      connectionState.value = 'idle'
      return
    }

    if (getReadyRuntimes(conversationId).length > 0) {
      connectionState.value = 'ready'
      return
    }

    const peers = conversationPeers.value[conversationId] ?? []
    const runtimes = getConversationRuntimes(conversationId)
    const connecting = runtimes.some((runtime) => {
      return (
        runtime.pc.connectionState === 'new' ||
        runtime.pc.connectionState === 'connecting' ||
        runtime.pc.iceConnectionState === 'checking'
      )
    })

    if (peers.length > 0 || connecting || pendingRoomSubscriptions.has(conversationId)) {
      connectionState.value = 'joining'
      return
    }

    connectionState.value = roomErrorMessage.value ? 'error' : 'idle'
  }

  function getConversationRuntimes(conversationId: string | null) {
    if (!conversationId) {
      return []
    }

    return [...peerRuntimes.values()].filter(
      (runtime) => runtime.conversationId === conversationId,
    )
  }

  function getReadyRuntimes(conversationId: string | null) {
    return getConversationRuntimes(conversationId).filter(
      (runtime) => runtime.channel?.readyState === 'open',
    )
  }

  function findFriendByConversationId(conversationId: string) {
    const selfAddress = identity.value?.address ?? me.value?.address

    if (!selfAddress) {
      return null
    }

    return (
      acceptedFriends.value.find(
        (record) =>
          createDirectConversationId(selfAddress, record.friend.address) ===
          conversationId,
      ) ?? null
    )
  }

  function getDirectConversationIdForAddress(address: string) {
    const selfAddress = identity.value?.address ?? me.value?.address

    if (!selfAddress) {
      return null
    }

    return createDirectConversationId(selfAddress, address)
  }

  function upsertConversationPeer(conversationId: string, peer: SignalPeerDescriptor) {
    const peers = conversationPeers.value[conversationId] ?? []
    conversationPeers.value = {
      ...conversationPeers.value,
      [conversationId]: normalizePeers(
        [...peers.filter((item) => item.connectionId !== peer.connectionId), peer],
        selfConnection?.connectionId,
      ),
    }
    syncConnectionState()
  }

  function setConversationPeers(conversationId: string, peers: SignalPeerDescriptor[]) {
    conversationPeers.value = {
      ...conversationPeers.value,
      [conversationId]: normalizePeers(peers, selfConnection?.connectionId),
    }
    syncConnectionState()
  }

  function removeConversationPeer(conversationId: string, connectionId: string) {
    const nextPeers = (conversationPeers.value[conversationId] ?? []).filter(
      (peer) => peer.connectionId !== connectionId,
    )

    if (nextPeers.length > 0) {
      conversationPeers.value = {
        ...conversationPeers.value,
        [conversationId]: nextPeers,
      }
    } else {
      const nextMap = { ...conversationPeers.value }
      delete nextMap[conversationId]
      conversationPeers.value = nextMap
    }

    syncConnectionState()
  }

  function clearConversationPeers(conversationId: string) {
    const nextMap = { ...conversationPeers.value }
    delete nextMap[conversationId]
    conversationPeers.value = nextMap
    syncConnectionState()
  }

  function replaceConversationMessages(
    conversationId: string,
    messages: ChatMessage[],
  ) {
    messagesByConversation.value = {
      ...messagesByConversation.value,
      [conversationId]: messages
        .sort((left, right) => compareDatesDesc(right.createdAt, left.createdAt))
        .slice(-appConfig.roomHistoryLimit),
    }
  }

  function appendMessage(conversationId: string, message: ChatMessage) {
    const existingMessages = messagesByConversation.value[conversationId] ?? []

    if (existingMessages.some((existing) => existing.id === message.id)) {
      return false
    }

    replaceConversationMessages(conversationId, [...existingMessages, message])
    return true
  }

  function appendSystemMessage(conversationId: string, text: string) {
    appendMessage(conversationId, {
      id: `system:${generateUuid()}`,
      roomId: conversationId,
      senderAddress: 'system',
      senderLabel: '系统',
      text,
      createdAt: new Date().toISOString(),
      direction: 'system',
    })
  }

  function updateMessageStatus(
    conversationId: string,
    messageId: string,
    status: ChatMessageStatus,
  ) {
    const messages = messagesByConversation.value[conversationId] ?? []
    const targetIndex = messages.findIndex((message) => message.id === messageId)

    if (targetIndex === -1) {
      return
    }

    const nextMessages = [...messages]
    nextMessages[targetIndex] = {
      ...nextMessages[targetIndex],
      status,
    }

    replaceConversationMessages(conversationId, nextMessages)
  }

  function clearWsPromise(error?: Error) {
    if (error) {
      rejectWsConnect?.(error)
    } else {
      resolveWsConnect?.()
    }

    resolveWsConnect = null
    rejectWsConnect = null
    wsConnectPromise = null
  }

  function clearWsHeartbeat() {
    if (wsPingTimer !== null) {
      window.clearInterval(wsPingTimer)
      wsPingTimer = null
    }
  }

  function stopDirectoryRefreshLoop() {
    if (directoryRefreshTimer !== null) {
      window.clearInterval(directoryRefreshTimer)
      directoryRefreshTimer = null
    }
  }

  async function refreshDirectorySafely() {
    if (refreshingDirectory || !authToken.value) {
      return
    }

    refreshingDirectory = true

    try {
      await refreshDirectory()
      await syncSubscriptions()
    } catch {
      // Ignore transient directory refresh failures.
    } finally {
      refreshingDirectory = false
    }
  }

  function startDirectoryRefreshLoop() {
    stopDirectoryRefreshLoop()

    if (!authToken.value) {
      return
    }

    directoryRefreshTimer = window.setInterval(() => {
      void refreshDirectorySafely()
    }, 5_000)
  }

  function startWsHeartbeat() {
    clearWsHeartbeat()
    wsPingTimer = window.setInterval(() => {
      if (!ws || ws.readyState !== WebSocket.OPEN) {
        return
      }

      ws.send(JSON.stringify({ type: 'ping' }))
    }, 20_000)
  }

  function closePeerRuntime(key: string) {
    const runtime = peerRuntimes.get(key)

    if (!runtime) {
      return
    }

    runtime.channel?.close()
    runtime.pc.close()
    peerRuntimes.delete(key)
    syncConnectionState()
  }

  function closeConversationRuntimes(conversationId: string) {
    for (const runtime of getConversationRuntimes(conversationId)) {
      closePeerRuntime(runtime.key)
    }
  }

  function clearAllPeerRuntimes() {
    for (const key of [...peerRuntimes.keys()]) {
      closePeerRuntime(key)
    }
  }

  function resetSignalState() {
    clearWsHeartbeat()
    wsConnected.value = false
    selfConnection = null
    joinedRooms.clear()
    pendingRoomSubscriptions.clear()
    conversationPeers.value = {}
    clearAllPeerRuntimes()
    syncConnectionState()
  }

  function scheduleSocketReconnect() {
    if (wsReconnectTimer !== null || !authToken.value) {
      return
    }

    wsReconnectTimer = window.setTimeout(() => {
      wsReconnectTimer = null
      void ensureWebSocket()
        .then(() => syncSubscriptions())
        .catch(() => undefined)
    }, 1_500)
  }

  function shutdownSocket(manual: boolean) {
    allowSocketReconnect = !manual && Boolean(authToken.value)

    if (wsReconnectTimer !== null) {
      window.clearTimeout(wsReconnectTimer)
      wsReconnectTimer = null
    }

    const socket = ws
    ws = null

    if (socket) {
      socket.onopen = null
      socket.onmessage = null
      socket.onerror = null
      socket.onclose = null

      if (
        socket.readyState === WebSocket.OPEN ||
        socket.readyState === WebSocket.CONNECTING
      ) {
        socket.close()
      }
    }

    clearWsPromise(manual ? new Error('信令连接已关闭。') : undefined)
    resetSignalState()
  }

  function sendWsPayload(payload: Record<string, unknown>) {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      throw new Error('信令连接尚未建立。')
    }

    ws.send(JSON.stringify(payload))
  }

  async function ensureIceServers() {
    if (!authToken.value) {
      iceServers.value = appConfig.fallbackIceServers
      turnExpiresAt = 0
      return iceServers.value
    }

    if (Date.now() < turnExpiresAt - 30_000) {
      return iceServers.value
    }

    try {
      const payload = await fetchTurnCredentials(authToken.value)
      iceServers.value = payload.iceServers.length
        ? [...payload.iceServers, ...appConfig.fallbackIceServers]
        : appConfig.fallbackIceServers
      turnExpiresAt = Date.now() + payload.ttlSeconds * 1_000
    } catch {
      iceServers.value = appConfig.fallbackIceServers
      turnExpiresAt = Date.now() + 60_000
    }

    return iceServers.value
  }

  async function createOffer(runtime: PeerRuntime) {
    if (runtime.pc.signalingState !== 'stable') {
      return
    }

    try {
      await runtime.pc.setLocalDescription()
      const description = toSessionDescription(runtime.pc.localDescription)

      if (!description) {
        return
      }

      sendWsPayload({
        type: 'signal.offer',
        roomKey: runtime.conversationId,
        targetConnectionId: runtime.peer.connectionId,
        description,
      })
    } catch {
      if (currentConversationId.value === runtime.conversationId) {
        roomErrorMessage.value = '创建 WebRTC offer 失败，请重试当前会话。'
      }
    }
  }

  async function flushPendingCandidates(runtime: PeerRuntime) {
    const candidates = [...runtime.pendingCandidates]
    runtime.pendingCandidates = []

    for (const candidate of candidates) {
      try {
        await runtime.pc.addIceCandidate(candidate)
      } catch {
        // Ignore invalid buffered candidates after renegotiation.
      }
    }
  }

  async function handleIncomingChat(runtime: PeerRuntime, rawData: string) {
    let payload: unknown

    try {
      payload = JSON.parse(rawData)
    } catch {
      return
    }

    if (!isChatWireMessage(payload)) {
      return
    }

    if (payload.roomId !== runtime.conversationId) {
      return
    }

    if (payload.senderAddress.toLowerCase() !== runtime.peer.address.toLowerCase()) {
      return
    }

    const createdAt = parseIsoDate(payload.createdAt)
    if (!createdAt) {
      return
    }

    if (Math.abs(Date.now() - createdAt.getTime()) > appConfig.messageFreshnessMs) {
      return
    }

    const verified = await verifyMessageAuthTag(
      payload,
      runtime.peer.sessionPublicKey,
    )

    if (!verified) {
      return
    }

    appendMessage(runtime.conversationId, {
      id: payload.id,
      roomId: payload.roomId,
      senderAddress: payload.senderAddress,
      senderLabel: payload.senderLabel || shortAddress(payload.senderAddress),
      text: payload.text,
      createdAt: payload.createdAt,
      direction: 'inbound',
      peerId: runtime.peer.connectionId,
    })
  }

  function attachDataChannel(runtime: PeerRuntime, channel: RTCDataChannel) {
    runtime.channel = channel

    channel.onopen = () => {
      if (currentConversationId.value === runtime.conversationId) {
        roomErrorMessage.value = ''
      }

      syncConnectionState()
    }

    channel.onclose = () => {
      if (runtime.channel === channel) {
        runtime.channel = null
      }

      syncConnectionState()
    }

    channel.onerror = () => {
      if (currentConversationId.value === runtime.conversationId) {
        roomErrorMessage.value = 'P2P 数据通道异常，请重试当前会话。'
      }

      syncConnectionState()
    }

    channel.onmessage = (event) => {
      const rawData = parseDataMessage(event.data)

      if (!rawData) {
        return
      }

      void handleIncomingChat(runtime, rawData)
    }
  }

  async function ensurePeerRuntime(
    conversationId: string,
    peer: SignalPeerDescriptor,
  ) {
    const runtimeKey = `${conversationId}:${peer.connectionId}`
    const existingRuntime = peerRuntimes.get(runtimeKey)

    if (existingRuntime) {
      existingRuntime.peer = peer
      return existingRuntime
    }

    const currentIceServers = await ensureIceServers()
    const pc = new RTCPeerConnection(buildRtcConfig(currentIceServers))
    const runtime: PeerRuntime = {
      key: runtimeKey,
      conversationId,
      peer,
      pc,
      channel: null,
      isInitiator: Boolean(
        selfConnection && selfConnection.connectionId > peer.connectionId,
      ),
      pendingCandidates: [],
    }

    pc.onicecandidate = ({ candidate }) => {
      if (!candidate) {
        return
      }

      try {
        sendWsPayload({
          type: 'signal.candidate',
          roomKey: conversationId,
          targetConnectionId: peer.connectionId,
          candidate: candidate.toJSON(),
        })
      } catch {
        // Ignore transient socket failures; reconnect will retry signaling.
      }
    }

    pc.ondatachannel = (event) => {
      attachDataChannel(runtime, event.channel)
    }

    pc.onnegotiationneeded = () => {
      if (!runtime.isInitiator) {
        return
      }

      void createOffer(runtime)
    }

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed') {
        if (currentConversationId.value === conversationId) {
          roomErrorMessage.value = 'P2P 连接失败，请点击重连。'
        }

        closePeerRuntime(runtime.key)
        return
      }

      syncConnectionState()
    }

    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === 'failed' && currentConversationId.value === conversationId) {
        roomErrorMessage.value = 'ICE 协商失败，请检查后端 TURN / STUN。'
      }

      syncConnectionState()
    }

    peerRuntimes.set(runtimeKey, runtime)

    if (runtime.isInitiator) {
      attachDataChannel(runtime, pc.createDataChannel('chat'))
    }

    syncConnectionState()
    return runtime
  }

  function buildPeerPresenceText(
    conversationId: string,
    peer: SignalPeerDescriptor,
    action: 'joined' | 'left',
  ) {
    const conversation = sortedConversations.value.find(
      (item) => item.id === conversationId,
    )

    if (conversation?.kind === 'group') {
      return `${shortAddress(peer.address)} ${action === 'joined' ? '已上线' : '已离线'}`
    }

    return action === 'joined' ? '对方已上线，可以开始聊天。' : '对方已离线。'
  }

  async function handleRoomSubscribed(payload: RoomSubscribedPayload) {
    pendingRoomSubscriptions.delete(payload.roomKey)
    joinedRooms.add(payload.roomKey)
    setConversationPeers(payload.roomKey, payload.peers)

    for (const peer of payload.peers) {
      await ensurePeerRuntime(payload.roomKey, peer)
    }
  }

  async function handlePeerJoined(payload: PeerJoinedPayload) {
    upsertConversationPeer(payload.roomKey, payload.peer)
    appendSystemMessage(
      payload.roomKey,
      buildPeerPresenceText(payload.roomKey, payload.peer, 'joined'),
    )
    await ensurePeerRuntime(payload.roomKey, payload.peer)
  }

  function handlePeerLeft(payload: PeerLeftPayload) {
    removeConversationPeer(payload.roomKey, payload.peer.connectionId)
    appendSystemMessage(
      payload.roomKey,
      buildPeerPresenceText(payload.roomKey, payload.peer, 'left'),
    )
    closePeerRuntime(`${payload.roomKey}:${payload.peer.connectionId}`)
  }

  async function handleSignalOffer(payload: SignalPayload) {
    if (!payload.description || !payload.from) {
      return
    }

    const runtime = await ensurePeerRuntime(payload.roomKey, payload.from)

    try {
      await runtime.pc.setRemoteDescription(payload.description)
      await flushPendingCandidates(runtime)
      await runtime.pc.setLocalDescription(await runtime.pc.createAnswer())
      const description = toSessionDescription(runtime.pc.localDescription)

      if (!description) {
        return
      }

      sendWsPayload({
        type: 'signal.answer',
        roomKey: payload.roomKey,
        targetConnectionId: payload.from.connectionId,
        description,
      })
    } catch {
      if (currentConversationId.value === payload.roomKey) {
        roomErrorMessage.value = '处理远端 offer 失败，请点击重连。'
      }
    }
  }

  async function handleSignalAnswer(payload: SignalPayload) {
    if (!payload.description || !payload.from) {
      return
    }

    const runtime = await ensurePeerRuntime(payload.roomKey, payload.from)

    try {
      await runtime.pc.setRemoteDescription(payload.description)
      await flushPendingCandidates(runtime)
    } catch {
      if (currentConversationId.value === payload.roomKey) {
        roomErrorMessage.value = '处理远端 answer 失败，请点击重连。'
      }
    }
  }

  async function handleSignalCandidate(payload: SignalPayload) {
    if (!payload.candidate || !payload.from) {
      return
    }

    const runtime = await ensurePeerRuntime(payload.roomKey, payload.from)

    if (!runtime.pc.remoteDescription) {
      runtime.pendingCandidates.push(payload.candidate)
      return
    }

    try {
      await runtime.pc.addIceCandidate(payload.candidate)
    } catch {
      // Ignore invalid late ICE candidates.
    }
  }

  async function handleWsMessage(rawData: string) {
    let payload: unknown

    try {
      payload = JSON.parse(rawData)
    } catch {
      return
    }

    if (!isRecord(payload) || typeof payload.type !== 'string') {
      return
    }

    switch (payload.type) {
      case 'session.ready': {
        if (!isSignalPeerDescriptor(payload.self)) {
          return
        }

        selfConnection = payload.self
        wsConnected.value = true
        clearWsPromise()
        startWsHeartbeat()
        await syncSubscriptions()
        syncConnectionState()
        return
      }

      case 'room.subscribed': {
        if (
          typeof payload.roomKey !== 'string' ||
          !Array.isArray(payload.peers) ||
          (payload.roomType !== 'direct' && payload.roomType !== 'group')
        ) {
          return
        }

        await handleRoomSubscribed({
          type: 'room.subscribed',
          roomKey: payload.roomKey,
          roomType: payload.roomType,
          peers: payload.peers.filter(isSignalPeerDescriptor),
        })
        return
      }

      case 'peer.joined': {
        if (typeof payload.roomKey !== 'string' || !isSignalPeerDescriptor(payload.peer)) {
          return
        }

        await handlePeerJoined({
          type: 'peer.joined',
          roomKey: payload.roomKey,
          peer: payload.peer,
        })
        return
      }

      case 'peer.left': {
        if (typeof payload.roomKey !== 'string' || !isSignalPeerDescriptor(payload.peer)) {
          return
        }

        handlePeerLeft({
          type: 'peer.left',
          roomKey: payload.roomKey,
          peer: payload.peer,
        })
        return
      }

      case 'signal.offer':
      case 'signal.answer':
      case 'signal.candidate': {
        if (typeof payload.roomKey !== 'string' || !isSignalPeerDescriptor(payload.from)) {
          return
        }

        const signalPayload = {
          roomKey: payload.roomKey,
          from: payload.from,
          description: payload.description as RTCSessionDescriptionInit | undefined,
          candidate: payload.candidate as RTCIceCandidateInit | undefined,
        } satisfies SignalPayload

        if (payload.type === 'signal.offer') {
          await handleSignalOffer(signalPayload)
          return
        }

        if (payload.type === 'signal.answer') {
          await handleSignalAnswer(signalPayload)
          return
        }

        await handleSignalCandidate(signalPayload)
        return
      }

      case 'error': {
        if (typeof payload.message === 'string') {
          roomErrorMessage.value = payload.message
        }

        if (typeof payload.requestId === 'string') {
          pendingRoomSubscriptions.delete(payload.requestId)
        }

        syncConnectionState()
        return
      }

      default:
        return
    }
  }

  async function ensureWebSocket() {
    if (!authToken.value) {
      return
    }

    if (ws && ws.readyState === WebSocket.OPEN && wsConnected.value) {
      return
    }

    if (wsConnectPromise) {
      return wsConnectPromise
    }

    const token = authToken.value
    allowSocketReconnect = true
    wsConnectPromise = new Promise<void>((resolve, reject) => {
      resolveWsConnect = resolve
      rejectWsConnect = reject
    })

    const socket = new WebSocket(buildBackendWsUrl(token))
    ws = socket

    socket.onopen = () => {
      // Wait for session.ready before resolving.
    }

    socket.onmessage = (event) => {
      if (typeof event.data !== 'string') {
        return
      }

      void handleWsMessage(event.data)
    }

    socket.onerror = () => {
      if (!wsConnected.value) {
        clearWsPromise(new Error('信令连接失败。'))
      }
    }

    socket.onclose = () => {
      const wasConnected = wsConnected.value

      if (ws === socket) {
        ws = null
      }

      if (!wasConnected) {
        clearWsPromise(new Error('信令连接已关闭。'))
      }

      resetSignalState()

      if (allowSocketReconnect && authToken.value) {
        scheduleSocketReconnect()
      }
    }

    return wsConnectPromise
  }

  function buildRoomSubscription(conversationId: string) {
    if (conversationId.startsWith('group:')) {
      return {
        type: 'room.subscribe',
        requestId: conversationId,
        roomType: 'group',
        groupId: conversationId.slice('group:'.length),
      } as const
    }

    const friend = findFriendByConversationId(conversationId)
    if (!friend) {
      return null
    }

    return {
      type: 'room.subscribe',
      requestId: conversationId,
      roomType: 'direct',
      peerAddress: friend.friend.address,
    } as const
  }

  function subscribeConversation(conversationId: string) {
    if (!wsConnected.value) {
      return
    }

    if (joinedRooms.has(conversationId) || pendingRoomSubscriptions.has(conversationId)) {
      return
    }

    const payload = buildRoomSubscription(conversationId)
    if (!payload) {
      return
    }

    pendingRoomSubscriptions.add(conversationId)

    try {
      sendWsPayload(payload)
    } catch {
      pendingRoomSubscriptions.delete(conversationId)
    }

    syncConnectionState()
  }

  async function syncSubscriptions() {
    if (!wsConnected.value) {
      return
    }

    const desiredRoomIds = new Set(sortedConversations.value.map((item) => item.id))

    for (const joinedRoomId of [...joinedRooms]) {
      if (desiredRoomIds.has(joinedRoomId)) {
        continue
      }

      try {
        sendWsPayload({
          type: 'room.leave',
          roomKey: joinedRoomId,
        })
      } catch {
        // Ignore leave failures during refresh.
      }

      joinedRooms.delete(joinedRoomId)
      pendingRoomSubscriptions.delete(joinedRoomId)
      closeConversationRuntimes(joinedRoomId)
      clearConversationPeers(joinedRoomId)
    }

    for (const pendingRoomId of [...pendingRoomSubscriptions]) {
      if (!desiredRoomIds.has(pendingRoomId)) {
        pendingRoomSubscriptions.delete(pendingRoomId)
      }
    }

    for (const conversation of sortedConversations.value) {
      subscribeConversation(conversation.id)
    }
  }

  function ensureConversationSelection() {
    const availableConversationIds = new Set(
      sortedConversations.value.map((conversation) => conversation.id),
    )

    if (
      currentConversationId.value &&
      availableConversationIds.has(currentConversationId.value)
    ) {
      return
    }

    currentConversationId.value = sortedConversations.value[0]?.id ?? null
  }

  async function refreshDirectory() {
    if (!authToken.value) {
      return
    }

    const [mePayload, friendsPayload, groupsPayload] = await Promise.all([
      fetchMe(authToken.value),
      fetchFriends(authToken.value),
      fetchGroups(authToken.value),
    ])

    me.value = mePayload.user
    acceptedFriends.value = friendsPayload.friends
    pendingInbound.value = friendsPayload.pendingInbound
    pendingOutbound.value = friendsPayload.pendingOutbound
    groups.value = groupsPayload.groups
    ensureConversationSelection()
  }

  async function bootstrapAuthenticatedState() {
    if (!authToken.value) {
      return
    }

    await Promise.all([refreshDirectory(), ensureIceServers()])
    await ensureWebSocket()
    await syncSubscriptions()
    startDirectoryRefreshLoop()
    syncConnectionState()
  }

  async function connectWithIdentity(nextIdentity: WalletIdentity) {
    const previousToken = authToken.value
    const nextSession = await createBackendSession(nextIdentity)

    if (previousToken && previousToken !== nextSession.token) {
      try {
        await revokeBackendSession(previousToken)
      } catch {
        // Ignore failures when replacing an existing session.
      }
    }

    shutdownSocket(true)
    stopDirectoryRefreshLoop()

    identity.value = nextIdentity
    authToken.value = nextSession.token
    authExpiresAt.value = nextSession.expiresAt
    me.value = nextSession.user
    acceptedFriends.value = []
    pendingInbound.value = []
    pendingOutbound.value = []
    groups.value = []
    walletErrorMessage.value = ''
    roomErrorMessage.value = ''

    try {
      await bootstrapAuthenticatedState()
    } catch (error) {
      identity.value = null
      authToken.value = null
      authExpiresAt.value = null
      me.value = null
      acceptedFriends.value = []
      pendingInbound.value = []
      pendingOutbound.value = []
      groups.value = []
      currentConversationId.value = null
      iceServers.value = appConfig.fallbackIceServers
      turnExpiresAt = 0
      stopDirectoryRefreshLoop()
      clearPersistedSession()
      saveSessionIdentity(null)
      throw error
    }
  }

  async function initialize() {
    walletErrorMessage.value = ''
    roomErrorMessage.value = ''

    if (!identity.value || !authToken.value) {
      authToken.value = null
      authExpiresAt.value = null
      stopDirectoryRefreshLoop()
      syncConnectionState()
      return
    }

    const expiresAt = parseIsoDate(authExpiresAt.value ?? '')
    if (expiresAt && expiresAt.getTime() <= Date.now()) {
      await disconnectWallet()
      return
    }

    try {
      await bootstrapAuthenticatedState()
    } catch (error) {
      roomErrorMessage.value = stringifyError(error, '初始化聊天状态失败。')
      await disconnectWallet()
    }
  }

  async function connectWallet() {
    walletBusy.value = true
    walletErrorMessage.value = ''

    try {
      await connectWithIdentity(await connectWalletIdentity())
    } catch (error) {
      walletErrorMessage.value = stringifyError(error, '连接钱包失败。')
    } finally {
      walletBusy.value = false
    }
  }

  async function connectTestIdentity() {
    walletBusy.value = true
    walletErrorMessage.value = ''

    try {
      await connectWithIdentity(await createTestIdentity())
    } catch (error) {
      walletErrorMessage.value = stringifyError(error, '启用测试身份失败。')
    } finally {
      walletBusy.value = false
    }
  }

  async function disconnectWallet() {
    const token = authToken.value

    shutdownSocket(true)
    stopDirectoryRefreshLoop()

    if (token) {
      try {
        await revokeBackendSession(token)
      } catch {
        // Ignore backend revoke failures on logout.
      }
    }

    identity.value = null
    authToken.value = null
    authExpiresAt.value = null
    me.value = null
    acceptedFriends.value = []
    pendingInbound.value = []
    pendingOutbound.value = []
    groups.value = []
    currentConversationId.value = null
    iceServers.value = appConfig.fallbackIceServers
    turnExpiresAt = 0
    walletErrorMessage.value = ''
    roomErrorMessage.value = ''
    clearPersistedSession()
    saveSessionIdentity(null)
    syncConnectionState()
  }

  async function selectConversation(conversationId: string) {
    currentConversationId.value = conversationId
    roomErrorMessage.value = ''
    subscribeConversation(conversationId)

    for (const peer of conversationPeers.value[conversationId] ?? []) {
      await ensurePeerRuntime(conversationId, peer)
    }

    syncConnectionState()
  }

  async function reconnectCurrentConversation() {
    const conversationId = currentConversationId.value

    if (!conversationId) {
      return
    }

    roomErrorMessage.value = ''

    if (joinedRooms.has(conversationId)) {
      try {
        sendWsPayload({
          type: 'room.leave',
          roomKey: conversationId,
        })
      } catch {
        // Ignore explicit leave failures during reconnect.
      }
    }

    joinedRooms.delete(conversationId)
    pendingRoomSubscriptions.delete(conversationId)
    closeConversationRuntimes(conversationId)
    clearConversationPeers(conversationId)

    if (!wsConnected.value) {
      await ensureWebSocket()
    }

    subscribeConversation(conversationId)
  }

  async function sendMessage(text: string) {
    if (!identity.value) {
      roomErrorMessage.value = '请先连接身份。'
      return false
    }

    if (!currentConversation.value) {
      roomErrorMessage.value = '请先选择一个会话。'
      return false
    }

    const normalizedText = clampText(text, appConfig.maxMessageLength).trim()
    if (!normalizedText) {
      return false
    }

    const readyRuntimes = getReadyRuntimes(currentConversation.value.id)
    if (!readyRuntimes.length) {
      roomErrorMessage.value =
        currentConversation.value.kind === 'private'
          ? '对方当前不在线，或 P2P 通道尚未建立。'
          : '当前没有可用群成员在线，或 P2P 通道尚未建立。'
      return false
    }

    sendBusy.value = true
    roomErrorMessage.value = ''

    const createdAt = new Date().toISOString()
    const unsignedMessage = {
      id: generateUuid(),
      roomId: currentConversation.value.id,
      senderAddress: identity.value.address,
      senderLabel: shortAddress(identity.value.address),
      sessionId: identity.value.sessionId,
      text: normalizedText,
      createdAt,
    }

    try {
      const authTag = await createMessageAuthTag(unsignedMessage, identity.value)
      const wireMessage = {
        ...unsignedMessage,
        authTag,
      } satisfies ChatWireMessage

      appendMessage(currentConversation.value.id, {
        id: wireMessage.id,
        roomId: wireMessage.roomId,
        senderAddress: wireMessage.senderAddress,
        senderLabel: wireMessage.senderLabel,
        text: wireMessage.text,
        createdAt: wireMessage.createdAt,
        direction: 'outbound',
        status: 'sending',
      })

      let sentCount = 0
      const payload = JSON.stringify(wireMessage)

      for (const runtime of readyRuntimes) {
        try {
          runtime.channel?.send(payload)
          sentCount += 1
        } catch {
          // Ignore individual peer send failures and keep fan-out best effort.
        }
      }

      updateMessageStatus(
        currentConversation.value.id,
        wireMessage.id,
        sentCount > 0 ? 'sent' : 'failed',
      )

      if (!sentCount) {
        roomErrorMessage.value = '消息发送失败，当前 P2P 通道不可用。'
        return false
      }

      return true
    } catch (error) {
      roomErrorMessage.value = stringifyError(error, '消息发送失败。')
      return false
    } finally {
      sendBusy.value = false
    }
  }

  async function sendFriendRequest(address: string) {
    if (!authToken.value || !identity.value) {
      roomErrorMessage.value = '请先连接身份。'
      return false
    }

    const normalizedAddress = address.trim()
    if (!normalizedAddress) {
      roomErrorMessage.value = '请输入好友地址。'
      return false
    }

    if (normalizedAddress.toLowerCase() === identity.value.address.toLowerCase()) {
      roomErrorMessage.value = '不能添加自己为好友。'
      return false
    }

    try {
      await sendFriendRequestApi(authToken.value, normalizedAddress)
      await refreshDirectory()
      roomErrorMessage.value = ''
      return true
    } catch (error) {
      roomErrorMessage.value = stringifyError(error, '发送好友请求失败。')
      return false
    }
  }

  async function acceptFriendRequest(friendshipId: number) {
    if (!authToken.value) {
      roomErrorMessage.value = '请先连接身份。'
      return false
    }

    const pendingRequest = pendingInbound.value.find(
      (item) => item.id === friendshipId,
    )

    try {
      await acceptFriendRequestApi(authToken.value, { friendshipId })
      await refreshDirectory()
      roomErrorMessage.value = ''

      const conversationId = pendingRequest
        ? getDirectConversationIdForAddress(pendingRequest.friend.address)
        : null

      if (conversationId) {
        await selectConversation(conversationId)
      }

      return true
    } catch (error) {
      roomErrorMessage.value = stringifyError(error, '接受好友请求失败。')
      return false
    }
  }

  async function createGroup(name: string, memberAddresses: string[]) {
    if (!authToken.value) {
      roomErrorMessage.value = '请先连接身份。'
      return false
    }

    const normalizedName = name.trim()
    if (!normalizedName) {
      roomErrorMessage.value = '群名称不能为空。'
      return false
    }

    const uniqueMembers = [...new Set(memberAddresses.map((item) => item.trim()).filter(Boolean))]

    try {
      const result = await createGroupApi(authToken.value, normalizedName, uniqueMembers)
      await refreshDirectory()
      roomErrorMessage.value = ''
      await selectConversation(createGroupConversationId(result.group.id))
      return true
    } catch (error) {
      roomErrorMessage.value = stringifyError(error, '创建群聊失败。')
      return false
    }
  }

  watch(
    [authToken, authExpiresAt, currentConversationId, messagesByConversation],
    () => {
      persistState()
    },
    { deep: true },
  )

  watch(
    identity,
    (nextIdentity) => {
      saveSessionIdentity(nextIdentity)
    },
    { deep: true },
  )

  watch(currentConversationId, () => {
    syncConnectionState()
  })

  return {
    acceptedFriends,
    canSendCurrentConversation,
    connectTestIdentity,
    connectWallet,
    connectionState,
    createGroup,
    currentConversation,
    currentConversationId,
    currentMessages,
    disconnectWallet,
    groups,
    identity,
    initialize,
    maxMessageLength,
    peerProfiles,
    pendingInbound,
    pendingOutbound,
    reconnectCurrentConversation,
    roomErrorMessage,
    selectConversation,
    sendBusy,
    sendFriendRequest,
    sendMessage,
    sortedConversations,
    testIdentityEnabled,
    transportLabel,
    walletBusy,
    walletErrorMessage,
    acceptFriendRequest,
  }
})
