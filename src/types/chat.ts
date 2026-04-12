export type RoomKind = 'private' | 'group'

export type ConnectionState = 'idle' | 'joining' | 'ready' | 'error'

export type TransportMode = 'turn-only' | 'hybrid' | 'stun-only'

export type IdentityAuthMethod = 'wallet' | 'guest'

export interface WalletIdentity {
  authMethod?: IdentityAuthMethod
  address: `0x${string}`
  chainId: number
  signature: `0x${string}`
  message: string
  issuedAt: string
  nonce: string
  sessionId: string
  domain: string
  origin: string
  uri: string
  appId: string
  sessionPublicKey: string
  sessionPrivateKey: string
}

export interface SharedWalletIdentity
  extends Omit<WalletIdentity, 'sessionPrivateKey' | 'authMethod'> {
  authMethod: IdentityAuthMethod
  [key: string]: number | string
}

export interface HandshakeRoomContext {
  version: 1
  appId: string
  roomId: string
  roomKind: RoomKind
  peerLimit: number
  expiresAt: string
}

export interface HandshakeHello extends HandshakeRoomContext {
  [key: string]: number | string | SharedWalletIdentity
  step: 'hello'
  address: `0x${string}`
  label: string
  sessionId: string
  challenge: string
  proof: SharedWalletIdentity
}

export interface HandshakeAck extends HandshakeRoomContext {
  [key: string]: number | string | SharedWalletIdentity
  step: 'ack'
  address: `0x${string}`
  label: string
  sessionId: string
  challenge: string
  proof: SharedWalletIdentity
  responseSignature: string
}

export interface HandshakeFinalize extends HandshakeRoomContext {
  [key: string]: number | string
  step: 'finalize'
  address: `0x${string}`
  sessionId: string
  responseSignature: string
}

export interface InvitePayload {
  roomId: string
  kind: RoomKind
  title: string
  secret: string
  peerLimit: number
  expiresAt: string
}

export interface KnownRoom {
  roomId: string
  kind: RoomKind
  title: string
  secret?: string
  peerLimit: number
  expiresAt: string
  createdAt: string
  createdBy: string
  inviteLink?: string
  lastOpenedAt: string
  lastMessageAt?: string
}

export interface ChatWireMessage {
  [key: string]: string
  id: string
  roomId: string
  senderAddress: `0x${string}`
  senderLabel: string
  sessionId: string
  text: string
  createdAt: string
  authTag: string
}

export type ChatMessageStatus = 'sending' | 'sent' | 'delivered' | 'failed'

export interface ChatReceiptWire {
  [key: string]: string
  roomId: string
  messageId: string
  senderSessionId: string
  recipientSessionId: string
  receivedAt: string
}

export interface ChatMessage {
  id: string
  roomId: string
  senderAddress: string
  senderLabel: string
  text: string
  createdAt: string
  direction: 'outbound' | 'inbound' | 'system'
  peerId?: string
  status?: ChatMessageStatus
}

export interface PeerProfile {
  peerId: string
  address: `0x${string}`
  label: string
  sessionId: string
  sessionPublicKey?: string
  joinedAt: string
  verifiedAt: string
  proof?: SharedWalletIdentity
}

export interface BackendUser {
  id: number
  address: `0x${string}`
  authMethod: IdentityAuthMethod
  chainId: number | null
  createdAt: string
  updatedAt: string
  lastSeenAt: string
  online?: boolean
}

export interface FriendRecord {
  id: number
  status: 'pending' | 'accepted' | 'blocked'
  direction: 'inbound' | 'outbound'
  requesterUserId: number
  createdAt: string
  updatedAt: string
  respondedAt?: string | null
  friend: BackendUser
  online?: boolean
}

export interface GroupMember {
  id: number
  address: `0x${string}`
  addressLower: string
  authMethod: IdentityAuthMethod
  chainId: number | null
  role: 'owner' | 'member'
  joinedAt: string
  online?: boolean
}

export interface GroupRecord {
  id: string
  name: string
  createdByUserId: number
  createdAt: string
  updatedAt: string
  role?: 'owner' | 'member'
  onlineMemberCount: number
  members: GroupMember[]
}

export interface ConversationSummary {
  id: string
  title: string
  kind: RoomKind
  directAddress?: `0x${string}`
  groupId?: string
  lastMessageAt?: string
  onlineCount: number
}

export interface BackendSessionPayload {
  token: string
  expiresAt: string
  user: BackendUser
  session: {
    tokenExpiresAt: string
    sessionId: string
    sessionPublicKey: string
    authMethod: IdentityAuthMethod
    chainId: number | null
  }
}

export interface FriendsResponse {
  friends: FriendRecord[]
  pendingInbound: FriendRecord[]
  pendingOutbound: FriendRecord[]
}

export interface GroupsResponse {
  groups: GroupRecord[]
}

export interface TurnCredentialsResponse {
  ttlSeconds: number
  iceServers: RTCIceServer[]
}

export interface PersistedState {
  identity: WalletIdentity | null
  authToken: string | null
  authExpiresAt: string | null
  currentConversationId: string | null
  messagesByConversation: Record<string, ChatMessage[]>
}
