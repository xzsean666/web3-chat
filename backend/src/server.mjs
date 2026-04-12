import { randomUUID } from 'node:crypto'
import Fastify from 'fastify'
import cors from '@fastify/cors'
import websocket from '@fastify/websocket'
import { serverConfig, isAllowedOrigin } from './config.mjs'
import {
  acceptFriendship,
  addGroupMember,
  createGroup,
  createOrUpdateFriendship,
  createSession,
  ensureUserByAddress,
  getFriendshipSummary,
  getGroupById,
  getGroupMembership,
  getSessionByTokenHash,
  getUserByAddress,
  listFriendshipsForUser,
  listGroupsForUser,
  revokeSession,
  touchSession,
  upsertUserFromIdentity,
} from './db.mjs'
import {
  buildTurnCredentials,
  createSessionToken,
  extractBearerToken,
  hashSessionToken,
  normalizeAddress,
  verifyWalletIdentity,
} from './auth.mjs'

const app = Fastify({
  logger: true,
})

const connections = new Map()
const userConnections = new Map()
const roomMembers = new Map()

function nowIso() {
  return new Date().toISOString()
}

function toSessionPayload(session) {
  return {
    tokenExpiresAt: session.expiresAt,
    sessionId: session.walletSessionId,
    sessionPublicKey: session.sessionPublicKey,
    authMethod: session.authMethod,
    chainId: session.chainId,
  }
}

function toUserPayload(user) {
  return {
    id: user.id,
    address: user.address,
    authMethod: user.authMethod,
    chainId: user.chainId,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    lastSeenAt: user.lastSeenAt,
  }
}

function isUserOnline(userId) {
  return (userConnections.get(userId)?.size ?? 0) > 0
}

function annotateFriendship(friendship) {
  return {
    ...friendship,
    online: isUserOnline(friendship.friend.id),
  }
}

function annotateGroup(group) {
  return {
    ...group,
    onlineMemberCount: group.members.filter((member) => isUserOnline(member.id)).length,
    members: group.members.map((member) => ({
      ...member,
      online: isUserOnline(member.id),
    })),
  }
}

function sendJson(socket, payload) {
  if (socket.readyState !== 1) {
    return
  }

  socket.send(JSON.stringify(payload))
}

function addConnection(connection) {
  connections.set(connection.id, connection)

  const userSet = userConnections.get(connection.user.id) ?? new Set()
  userSet.add(connection.id)
  userConnections.set(connection.user.id, userSet)
}

function getPeerDescriptor(connection) {
  return {
    connectionId: connection.id,
    userId: connection.user.id,
    address: connection.user.address,
    authMethod: connection.session.authMethod,
    sessionId: connection.session.walletSessionId,
    sessionPublicKey: connection.session.sessionPublicKey,
    connectedAt: connection.connectedAt,
  }
}

function createDirectRoomKey(addressA, addressB) {
  return `direct:${[addressA.toLowerCase(), addressB.toLowerCase()].sort().join(':')}`
}

function createGroupRoomKey(groupId) {
  return `group:${groupId}`
}

function getRoomMemberMap(roomKey) {
  let members = roomMembers.get(roomKey)

  if (!members) {
    members = new Map()
    roomMembers.set(roomKey, members)
  }

  return members
}

function leaveRoom(connection, roomKey, notify = true) {
  const subscription = connection.rooms.get(roomKey)
  if (!subscription) {
    return
  }

  connection.rooms.delete(roomKey)
  const members = roomMembers.get(roomKey)

  if (!members) {
    return
  }

  members.delete(connection.id)

  if (members.size === 0) {
    roomMembers.delete(roomKey)
    return
  }

  if (!notify) {
    return
  }

  for (const peer of members.values()) {
    sendJson(peer.socket, {
      type: 'peer.left',
      roomKey,
      peer: getPeerDescriptor(connection),
    })
  }
}

function removeConnection(connection) {
  for (const roomKey of [...connection.rooms.keys()]) {
    leaveRoom(connection, roomKey)
  }

  connections.delete(connection.id)

  const userSet = userConnections.get(connection.user.id)
  if (!userSet) {
    return
  }

  userSet.delete(connection.id)
  if (userSet.size === 0) {
    userConnections.delete(connection.user.id)
  }
}

function sendError(socket, code, message, requestId = null) {
  sendJson(socket, {
    type: 'error',
    code,
    message,
    requestId,
  })
}

function getRequestOrigin(request) {
  return typeof request.headers.origin === 'string' ? request.headers.origin : null
}

function authenticateHttp(request, reply) {
  const token = extractBearerToken(request.headers.authorization)

  if (!token) {
    reply.code(401)
    return null
  }

  const now = nowIso()
  const session = getSessionByTokenHash(hashSessionToken(token), now)

  if (!session) {
    reply.code(401)
    return null
  }

  touchSession(session, now)
  return session
}

async function resolveDirectRoom(connection, payload) {
  if (typeof payload.peerAddress !== 'string') {
    throw new Error('peerAddress 缺失。')
  }

  const peerAddress = normalizeAddress(payload.peerAddress)
  const peerUser = getUserByAddress(peerAddress)

  if (!peerUser) {
    throw new Error('目标地址还未注册。')
  }

  const friendship = getFriendshipSummary(connection.user.id, peerUser.id)

  if (!friendship || friendship.status !== 'accepted') {
    throw new Error('仅允许与已接受的好友建立私聊连接。')
  }

  return {
    roomType: 'direct',
    roomKey: createDirectRoomKey(connection.user.address, peerUser.address),
    peerAddress: peerUser.address,
  }
}

function resolveGroupRoom(connection, payload) {
  if (typeof payload.groupId !== 'string' || !payload.groupId.trim()) {
    throw new Error('groupId 缺失。')
  }

  const membership = getGroupMembership(payload.groupId, connection.user.id)
  if (!membership) {
    throw new Error('当前用户不在该群组中。')
  }

  return {
    roomType: 'group',
    roomKey: createGroupRoomKey(payload.groupId),
    groupId: payload.groupId,
  }
}

async function resolveRoom(connection, payload) {
  if (!payload || typeof payload !== 'object') {
    throw new Error('房间请求格式无效。')
  }

  if (payload.roomType === 'direct') {
    return resolveDirectRoom(connection, payload)
  }

  if (payload.roomType === 'group') {
    return resolveGroupRoom(connection, payload)
  }

  throw new Error('不支持的 roomType。')
}

function handleRoomSubscribe(connection, socket, payload) {
  return Promise.resolve(resolveRoom(connection, payload)).then((room) => {
    const roomKey = room.roomKey

    if (connection.rooms.has(roomKey)) {
      const peers = Array.from(getRoomMemberMap(roomKey).values())
        .filter((peer) => peer.id !== connection.id)
        .map(getPeerDescriptor)

      sendJson(socket, {
        type: 'room.subscribed',
        roomKey,
        roomType: room.roomType,
        peers,
      })
      return
    }

    connection.rooms.set(roomKey, room)
    const members = getRoomMemberMap(roomKey)
    const peers = Array.from(members.values()).map(getPeerDescriptor)

    members.set(connection.id, connection)

    sendJson(socket, {
      type: 'room.subscribed',
      roomKey,
      roomType: room.roomType,
      peers,
    })

    for (const peer of members.values()) {
      if (peer.id === connection.id) {
        continue
      }

      sendJson(peer.socket, {
        type: 'peer.joined',
        roomKey,
        peer: getPeerDescriptor(connection),
      })
    }
  })
}

function handleSignalMessage(connection, payload) {
  const { roomKey, targetConnectionId } = payload

  if (typeof roomKey !== 'string' || !connection.rooms.has(roomKey)) {
    throw new Error('当前连接未订阅该房间。')
  }

  if (typeof targetConnectionId !== 'string') {
    throw new Error('targetConnectionId 缺失。')
  }

  const target = connections.get(targetConnectionId)
  if (!target || !target.rooms.has(roomKey)) {
    throw new Error('目标连接不在线，或未加入该房间。')
  }

  sendJson(target.socket, {
    ...payload,
    from: getPeerDescriptor(connection),
  })
}

await app.register(cors, {
  origin(origin, callback) {
    if (!origin || isAllowedOrigin(origin)) {
      callback(null, true)
      return
    }

    callback(new Error('Origin is not allowed'), false)
  },
})

await app.register(websocket)

app.get('/healthz', async () => ({
  ok: true,
  now: nowIso(),
}))

app.post('/api/auth/sessions', async (request, reply) => {
  const requestOrigin = getRequestOrigin(request)
  if (requestOrigin && !isAllowedOrigin(requestOrigin)) {
    reply.code(403)
    return { error: '当前来源不被允许。' }
  }

  const verified = await verifyWalletIdentity(request.body, {
    expectedOrigin: requestOrigin,
  })

  if (!verified.ok) {
    reply.code(401)
    return { error: verified.reason }
  }

  const now = nowIso()
  const expiresAt = new Date(Date.now() + serverConfig.sessionTtlMs).toISOString()
  const user = upsertUserFromIdentity(verified.identity, now)
  const token = createSessionToken()
  const session = createSession(
    user,
    verified.identity,
    hashSessionToken(token),
    now,
    expiresAt,
  )

  return {
    token,
    expiresAt,
    user: toUserPayload(user),
    session: toSessionPayload(session),
  }
})

app.delete('/api/auth/sessions/current', async (request, reply) => {
  const token = extractBearerToken(request.headers.authorization)
  if (!token) {
    reply.code(204)
    return null
  }

  revokeSession(hashSessionToken(token), nowIso())
  reply.code(204)
  return null
})

app.get('/api/me', async (request, reply) => {
  const session = authenticateHttp(request, reply)
  if (!session) {
    return { error: '未授权。' }
  }

  return {
    user: toUserPayload(session.user),
    session: toSessionPayload(session),
  }
})

app.get('/api/turn-credentials', async (request, reply) => {
  const session = authenticateHttp(request, reply)
  if (!session) {
    return { error: '未授权。' }
  }

  return buildTurnCredentials(session.user.address)
})

app.get('/api/friends', async (request, reply) => {
  const session = authenticateHttp(request, reply)
  if (!session) {
    return { error: '未授权。' }
  }

  const friendships = listFriendshipsForUser(session.user.id).map(annotateFriendship)

  return {
    friends: friendships.filter((item) => item.status === 'accepted'),
    pendingInbound: friendships.filter(
      (item) => item.status === 'pending' && item.direction === 'inbound',
    ),
    pendingOutbound: friendships.filter(
      (item) => item.status === 'pending' && item.direction === 'outbound',
    ),
  }
})

app.post('/api/friends/requests', async (request, reply) => {
  const session = authenticateHttp(request, reply)
  if (!session) {
    return { error: '未授权。' }
  }

  if (!request.body || typeof request.body.address !== 'string') {
    reply.code(400)
    return { error: 'address 缺失。' }
  }

  let targetAddress
  try {
    targetAddress = normalizeAddress(request.body.address)
  } catch {
    reply.code(400)
    return { error: 'address 格式无效。' }
  }

  const now = nowIso()
  const targetUser = ensureUserByAddress(targetAddress, now)
  const result = createOrUpdateFriendship(session.user.id, targetUser.id, now)

  return {
    friendshipId: result.id,
    status: result.status,
  }
})

app.post('/api/friends/accept', async (request, reply) => {
  const session = authenticateHttp(request, reply)
  if (!session) {
    return { error: '未授权。' }
  }

  const body = request.body ?? {}
  let targetUserId = null
  let friendshipId = null

  if (typeof body.friendshipId === 'number') {
    friendshipId = body.friendshipId
  } else if (typeof body.friendshipId === 'string') {
    const parsedFriendshipId = Number.parseInt(body.friendshipId, 10)
    friendshipId = Number.isFinite(parsedFriendshipId) ? parsedFriendshipId : null
  }

  if (typeof body.address === 'string') {
    try {
      const targetUser = getUserByAddress(normalizeAddress(body.address))
      targetUserId = targetUser?.id ?? null
    } catch {
      reply.code(400)
      return { error: 'address 格式无效。' }
    }
  }

  const accepted = acceptFriendship(session.user.id, nowIso(), {
    friendshipId: friendshipId ?? undefined,
    targetUserId,
  })

  if (!accepted) {
    reply.code(404)
    return { error: '未找到待接受的好友请求。' }
  }

  return {
    friendshipId: accepted.id,
    status: accepted.status,
    respondedAt: accepted.responded_at,
  }
})

app.get('/api/groups', async (request, reply) => {
  const session = authenticateHttp(request, reply)
  if (!session) {
    return { error: '未授权。' }
  }

  return {
    groups: listGroupsForUser(session.user.id).map(annotateGroup),
  }
})

app.post('/api/groups', async (request, reply) => {
  const session = authenticateHttp(request, reply)
  if (!session) {
    return { error: '未授权。' }
  }

  const body = request.body ?? {}
  if (typeof body.name !== 'string' || !body.name.trim()) {
    reply.code(400)
    return { error: '群名称不能为空。' }
  }

  const memberAddresses = Array.isArray(body.memberAddresses)
    ? body.memberAddresses.filter((item) => typeof item === 'string')
    : []

  const now = nowIso()
  const memberUserIds = []

  for (const address of memberAddresses) {
    try {
      const user = ensureUserByAddress(normalizeAddress(address), now)
      memberUserIds.push(user.id)
    } catch {
      reply.code(400)
      return { error: `无效群成员地址: ${address}` }
    }
  }

  const group = createGroup({
    id: randomUUID(),
    name: body.name.trim(),
    ownerUserId: session.user.id,
    memberUserIds,
    now,
  })

  return {
    group: annotateGroup(group),
  }
})

app.post('/api/groups/:groupId/members', async (request, reply) => {
  const session = authenticateHttp(request, reply)
  if (!session) {
    return { error: '未授权。' }
  }

  const { groupId } = request.params
  const membership = getGroupMembership(groupId, session.user.id)
  if (!membership) {
    reply.code(403)
    return { error: '当前用户不在该群组中。' }
  }

  if (membership.role !== 'owner') {
    reply.code(403)
    return { error: '只有群主可以添加成员。' }
  }

  if (!request.body || typeof request.body.address !== 'string') {
    reply.code(400)
    return { error: 'address 缺失。' }
  }

  const group = getGroupById(groupId)
  if (!group) {
    reply.code(404)
    return { error: '群组不存在。' }
  }

  const now = nowIso()
  let targetUser
  try {
    targetUser = ensureUserByAddress(normalizeAddress(request.body.address), now)
  } catch {
    reply.code(400)
    return { error: 'address 格式无效。' }
  }

  return {
    group: annotateGroup(addGroupMember(group.id, targetUser.id, session.user.id, now)),
  }
})

app.get('/ws', { websocket: true }, (socket, request) => {
  const origin = getRequestOrigin(request)
  if (origin && !isAllowedOrigin(origin)) {
    socket.close(4403, 'Origin not allowed')
    return
  }

  const token = typeof request.query?.token === 'string' ? request.query.token : null

  if (!token) {
    socket.close(4401, 'Missing token')
    return
  }

  const session = getSessionByTokenHash(hashSessionToken(token), nowIso())
  if (!session) {
    socket.close(4401, 'Invalid token')
    return
  }

  const connection = {
    id: randomUUID(),
    socket,
    session,
    user: session.user,
    connectedAt: nowIso(),
    rooms: new Map(),
  }

  addConnection(connection)
  touchSession(session, nowIso())

  sendJson(socket, {
    type: 'session.ready',
    self: getPeerDescriptor(connection),
  })

  socket.on('message', (raw) => {
    let message

    try {
      message = JSON.parse(raw.toString())
    } catch {
      sendError(socket, 'BAD_JSON', '消息必须是合法 JSON。')
      return
    }

    if (!message || typeof message.type !== 'string') {
      sendError(socket, 'BAD_MESSAGE', '消息缺少 type 字段。')
      return
    }

    try {
      if (message.type === 'ping') {
        sendJson(socket, { type: 'pong', ts: nowIso() })
        return
      }

      if (message.type === 'room.subscribe') {
        handleRoomSubscribe(connection, socket, message).catch((error) => {
          sendError(socket, 'ROOM_SUBSCRIBE_FAILED', error.message, message.requestId)
        })
        return
      }

      if (message.type === 'room.leave') {
        if (typeof message.roomKey !== 'string') {
          throw new Error('roomKey 缺失。')
        }

        leaveRoom(connection, message.roomKey)
        sendJson(socket, {
          type: 'room.left',
          roomKey: message.roomKey,
        })
        return
      }

      if (
        message.type === 'signal.offer' ||
        message.type === 'signal.answer' ||
        message.type === 'signal.candidate'
      ) {
        handleSignalMessage(connection, message)
        return
      }

      throw new Error('不支持的消息类型。')
    } catch (error) {
      sendError(socket, 'MESSAGE_REJECTED', error.message, message.requestId)
    }
  })

  socket.on('close', () => {
    removeConnection(connection)
  })

  socket.on('error', () => {
    removeConnection(connection)
  })
})

try {
  await app.listen({
    host: serverConfig.host,
    port: serverConfig.port,
  })
} catch (error) {
  app.log.error(error)
  process.exit(1)
}
