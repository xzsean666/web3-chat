import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { buildInviteLink } from '../utils/invite'
import type { InvitePayload, SharedWalletIdentity, WalletIdentity } from '../types/chat'

const localIdentity = {
  address: '0x1111111111111111111111111111111111111111',
  chainId: 1,
  signature: '0xabc123',
  message: 'signed-message',
  issuedAt: new Date().toISOString(),
  nonce: 'nonce-local',
  sessionId: 'session-local',
  domain: 'localhost:5173',
  origin: 'http://localhost:5173',
  uri: 'http://localhost:5173',
  appId: 'web3-wallet-chat',
  sessionPublicKey: 'public-key-local',
  sessionPrivateKey: 'private-key-local',
} satisfies WalletIdentity

const trysteroState = vi.hoisted(() => {
  const sendChatMock = vi.fn(async () => [])
  const sendReceiptMock = vi.fn(async () => [])
  const leaveMock = vi.fn(async () => undefined)
  const getPeersMock = vi.fn(() => ({}))

  let latestCallbacks: {
    onPeerHandshake?: (
      peerId: string,
      send: (data: unknown) => Promise<void>,
      receive: () => Promise<{ data: unknown }>,
      isInitiator: boolean,
    ) => Promise<void>
  } | null = null
  let chatReceiver: ((payload: unknown, peerId: string) => void) | null = null
  let receiptReceiver: ((payload: unknown, peerId: string) => void) | null = null
  let peerJoinHandler: ((peerId: string) => void) | null = null
  let currentRoomId = ''

  function reset() {
    sendChatMock.mockReset()
    sendReceiptMock.mockReset()
    leaveMock.mockReset()
    getPeersMock.mockReset()
    sendChatMock.mockResolvedValue([])
    sendReceiptMock.mockResolvedValue([])
    leaveMock.mockResolvedValue(undefined)
    getPeersMock.mockReturnValue({})
    latestCallbacks = null
    chatReceiver = null
    receiptReceiver = null
    peerJoinHandler = null
    currentRoomId = ''
  }

  reset()

  return {
    sendChatMock,
    sendReceiptMock,
    leaveMock,
    getPeersMock,
    reset,
    setLatestCallbacks(callbacks: typeof latestCallbacks) {
      latestCallbacks = callbacks
    },
    getLatestCallbacks() {
      return latestCallbacks
    },
    setChatReceiver(receiver: typeof chatReceiver) {
      chatReceiver = receiver
    },
    getChatReceiver() {
      return chatReceiver
    },
    setReceiptReceiver(receiver: typeof receiptReceiver) {
      receiptReceiver = receiver
    },
    getReceiptReceiver() {
      return receiptReceiver
    },
    setPeerJoinHandler(handler: typeof peerJoinHandler) {
      peerJoinHandler = handler
    },
    getPeerJoinHandler() {
      return peerJoinHandler
    },
    setCurrentRoomId(roomId: string) {
      currentRoomId = roomId
    },
    getCurrentRoomId() {
      return currentRoomId
    },
  }
})

vi.mock('trystero', () => ({
  joinRoom: (_config: unknown, roomId: string, callbacks: unknown) => {
    trysteroState.setLatestCallbacks(
      callbacks as {
        onPeerHandshake?: (
          peerId: string,
          send: (data: unknown) => Promise<void>,
          receive: () => Promise<{ data: unknown }>,
          isInitiator: boolean,
        ) => Promise<void>
      },
    )
    trysteroState.setCurrentRoomId(roomId)

    return {
      makeAction: (namespace: string) => {
        if (namespace === 'chat-message') {
          return [
            trysteroState.sendChatMock,
            (receiver: (payload: unknown, peerId: string) => void) => {
              trysteroState.setChatReceiver(receiver)
            },
            vi.fn(),
          ]
        }

        return [
          trysteroState.sendReceiptMock,
          (receiver: (payload: unknown, peerId: string) => void) => {
            trysteroState.setReceiptReceiver(receiver)
          },
          vi.fn(),
        ]
      },
      ping: vi.fn(),
      leave: trysteroState.leaveMock,
      getPeers: trysteroState.getPeersMock,
      addStream: vi.fn(() => []),
      removeStream: vi.fn(),
      addTrack: vi.fn(() => []),
      removeTrack: vi.fn(),
      replaceTrack: vi.fn(() => []),
      onPeerJoin: (handler: (peerId: string) => void) => {
        trysteroState.setPeerJoinHandler(handler)
      },
      onPeerLeave: vi.fn(),
      onPeerStream: vi.fn(),
      onPeerTrack: vi.fn(),
    }
  },
}))

vi.mock('../utils/wallet', () => ({
  connectWalletIdentity: vi.fn(async () => localIdentity),
  shortAddress: (address: string) => `${address.slice(0, 6)}...${address.slice(-4)}`,
  toSharedWalletIdentity: (identity: WalletIdentity) => {
    const { sessionPrivateKey: _sessionPrivateKey, ...sharedIdentity } = identity
    return sharedIdentity
  },
  verifyWalletIdentity: vi.fn(async () => true),
}))

vi.mock('../utils/security', () => ({
  createMessageAuthTag: vi.fn(async () => 'auth-tag'),
  signPayload: vi.fn(async () => 'handshake-signature'),
  verifyMessageAuthTag: vi.fn(async () => true),
  verifyPayloadSignature: vi.fn(async () => true),
}))

import { useChatAppStore } from './chatApp'

function createRemoteProof(
  suffix: string,
  address: `0x${string}`,
): SharedWalletIdentity {
  return {
    address,
    chainId: 1,
    signature: `0xproof-${suffix}`,
    message: `proof-${suffix}`,
    issuedAt: new Date().toISOString(),
    nonce: `nonce-${suffix}`,
    sessionId: `session-${suffix}`,
    domain: 'localhost:5173',
    origin: 'http://localhost:5173',
    uri: 'http://localhost:5173',
    appId: 'web3-wallet-chat',
    sessionPublicKey: `public-key-${suffix}`,
  }
}

async function triggerVerifiedPeer(
  proof: SharedWalletIdentity,
  peerId = `peer-${proof.sessionId}`,
) {
  const callbacks = trysteroState.getLatestCallbacks()
  const sentPayloads: unknown[] = []

  await callbacks?.onPeerHandshake?.(
    peerId,
    async (payload) => {
      sentPayloads.push(payload)
    },
    async () => {
      const hello = sentPayloads[0] as {
        version: 1
        appId: string
        roomId: string
        roomKind: 'private' | 'group'
        peerLimit: number
        expiresAt: string
        challenge: string
      }

      return {
        data: {
          version: hello.version,
          appId: hello.appId,
          roomId: hello.roomId,
          roomKind: hello.roomKind,
          peerLimit: hello.peerLimit,
          expiresAt: hello.expiresAt,
          step: 'ack',
          address: proof.address,
          label: `${proof.address.slice(0, 6)}...${proof.address.slice(-4)}`,
          sessionId: proof.sessionId,
          challenge: `challenge-${proof.sessionId}`,
          proof,
          responseSignature: `response-${proof.sessionId}`,
        },
      }
    },
    true,
  )

  trysteroState.getPeersMock.mockReturnValue({
    [peerId]: {} as RTCPeerConnection,
  })

  trysteroState.getPeerJoinHandler()?.(peerId)
  return peerId
}

function getLastOutboundMessage(store: ReturnType<typeof useChatAppStore>) {
  return [...store.currentMessages]
    .reverse()
    .find((message) => message.direction === 'outbound')
}

describe('chatApp store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    window.localStorage.clear()
    window.sessionStorage.clear()
    trysteroState.reset()
  })

  it('tracks outbound message delivery status', async () => {
    const store = useChatAppStore()

    await store.connectWallet()
    const room = await store.createRoom('private', '测试房间')
    const peerProof = createRemoteProof(
      'remote-a',
      '0x2222222222222222222222222222222222222222',
    )

    await triggerVerifiedPeer(peerProof)

    await expect(store.sendMessage('你好')).resolves.toBe(true)
    expect(getLastOutboundMessage(store)?.status).toBe('sent')

    trysteroState.getReceiptReceiver()?.(
      {
        roomId: room?.roomId,
        messageId: getLastOutboundMessage(store)?.id,
        senderSessionId: localIdentity.sessionId,
        recipientSessionId: peerProof.sessionId,
        receivedAt: new Date().toISOString(),
      },
      'peer-session-remote-a',
    )

    expect(getLastOutboundMessage(store)?.status).toBe('delivered')
  })

  it('marks outbound message as failed when send rejects', async () => {
    const store = useChatAppStore()
    trysteroState.sendChatMock.mockRejectedValueOnce(new Error('send failed'))

    await store.connectWallet()
    await store.createRoom('private', '失败房间')
    await triggerVerifiedPeer(
      createRemoteProof(
        'remote-b',
        '0x3333333333333333333333333333333333333333',
      ),
    )

    await expect(store.sendMessage('会失败')).resolves.toBe(false)
    expect(getLastOutboundMessage(store)?.status).toBe('failed')
    expect(store.roomErrorMessage).toBe('send failed')
  })

  it('clears session room state on disconnect', async () => {
    const store = useChatAppStore()

    await store.connectWallet()
    const room = await store.createRoom('private', '本地会话')

    expect(room?.secret).toBeTruthy()
    expect(store.sortedRooms[0]?.secret).toBeTruthy()

    await store.disconnectWallet()

    expect(store.identity).toBeNull()
    expect(store.currentRoomId).toBeNull()
    expect(store.currentMessages).toEqual([])
    expect(store.sortedRooms[0]?.secret).toBeUndefined()
    expect(store.sortedRooms[0]?.inviteLink).toBeUndefined()
  })

  it('rejects conflicting invite imports', async () => {
    const store = useChatAppStore()

    await store.connectWallet()
    const room = await store.createRoom('private', '原始房间')
    const conflictingInvite = buildInviteLink({
      roomId: room!.roomId,
      kind: 'private',
      title: '冲突房间',
      secret: 'different-secret',
      peerLimit: 2,
      expiresAt: room!.expiresAt,
    })

    await expect(store.importInvite(conflictingInvite)).resolves.toBeNull()
    expect(store.roomErrorMessage).toContain('已拒绝覆盖')
  })

  it('enforces peer limit for imported group rooms', async () => {
    const store = useChatAppStore()
    const limitedGroupInvite = buildInviteLink({
      roomId: 'group-limit-room',
      kind: 'group',
      title: '小群',
      secret: 'group-secret',
      peerLimit: 2,
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    } satisfies InvitePayload)

    await store.importInvite(limitedGroupInvite)
    await store.connectWallet()

    await triggerVerifiedPeer(
      createRemoteProof(
        'remote-c',
        '0x4444444444444444444444444444444444444444',
      ),
      'peer-one',
    )

    await expect(
      triggerVerifiedPeer(
        createRemoteProof(
          'remote-d',
          '0x5555555555555555555555555555555555555555',
        ),
        'peer-two',
      ),
    ).rejects.toThrow('该群聊房间已达到人数上限。')
  })
})
