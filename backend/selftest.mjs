import { randomBytes } from 'node:crypto'
import assert from 'node:assert/strict'
import * as Hex from 'ox/Hex'
import * as P256 from 'ox/P256'
import * as PublicKey from 'ox/PublicKey'
import * as Signature from 'ox/Signature'

const BASE_URL = 'http://127.0.0.1:8787'
const WS_URL = 'ws://127.0.0.1:8787/ws'
const APP_ID = 'web3-wallet-chat'
const ORIGIN = 'http://localhost:5173'
const DOMAIN = 'localhost:5173'
const CHAIN_ID = 31337
const encoder = new TextEncoder()

function bytesToBase64(bytes) {
  return Buffer.from(bytes).toString('base64')
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

function toPayloadHex(payload) {
  return Hex.fromBytes(encoder.encode(JSON.stringify(sortObjectKeys(payload))))
}

async function deriveTestAddress(seed) {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(seed))
  return `0x${Buffer.from(digest).subarray(0, 20).toString('hex')}`
}

async function createGuestIdentity() {
  const keyPair = P256.createKeyPair({ as: 'Bytes' })
  const sessionPublicKey = bytesToBase64(PublicKey.toBytes(keyPair.publicKey))
  const nonce = randomBytes(8).toString('hex')
  const sessionId = crypto.randomUUID()
  const issuedAt = new Date().toISOString()
  const address = await deriveTestAddress(`${sessionPublicKey}:${sessionId}`)
  const messagePayload = {
    type: 'web3-chat-test-identity',
    version: 1,
    address,
    chainId: CHAIN_ID,
    sessionId,
    nonce,
    issuedAt,
    domain: DOMAIN,
    origin: ORIGIN,
    uri: ORIGIN,
    appId: APP_ID,
    sessionPublicKey,
  }
  const signature = Signature.toHex(
    P256.sign({
      payload: toPayloadHex(messagePayload),
      privateKey: keyPair.privateKey,
      hash: true,
    }),
  )

  return {
    authMethod: 'guest',
    address,
    chainId: CHAIN_ID,
    signature,
    message: JSON.stringify(messagePayload),
    issuedAt,
    nonce,
    sessionId,
    domain: DOMAIN,
    origin: ORIGIN,
    uri: ORIGIN,
    appId: APP_ID,
    sessionPublicKey,
  }
}

async function postJson(path, token, body) {
  const response = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      origin: ORIGIN,
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  })

  return {
    status: response.status,
    json: await response.json(),
  }
}

async function getJson(path, token) {
  const response = await fetch(`${BASE_URL}${path}`, {
    headers: {
      origin: ORIGIN,
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
  })

  return {
    status: response.status,
    json: await response.json(),
  }
}

function createWsClient(token) {
  const ws = new WebSocket(`${WS_URL}?token=${encodeURIComponent(token)}`)
  const queue = []
  const waiters = []

  ws.addEventListener('message', (event) => {
    const data = JSON.parse(
      typeof event.data === 'string'
        ? event.data
        : Buffer.from(event.data).toString(),
    )
    queue.push(data)

    for (let index = 0; index < waiters.length; index += 1) {
      const waiter = waiters[index]
      if (!waiter.predicate(data)) {
        continue
      }

      waiters.splice(index, 1)
      clearTimeout(waiter.timer)
      queue.splice(queue.indexOf(data), 1)
      waiter.resolve(data)
      return
    }
  })

  return {
    ws,
    async open() {
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(
          () => reject(new Error('WebSocket open timeout')),
          3000,
        )
        ws.addEventListener(
          'open',
          () => {
            clearTimeout(timeout)
            resolve()
          },
          { once: true },
        )
        ws.addEventListener(
          'error',
          (event) => {
            clearTimeout(timeout)
            reject(event.error ?? new Error('WebSocket error'))
          },
          { once: true },
        )
      })
    },
    send(payload) {
      ws.send(JSON.stringify(payload))
    },
    waitFor(predicate, label, timeoutMs = 3000) {
      const queued = queue.find(predicate)
      if (queued) {
        queue.splice(queue.indexOf(queued), 1)
        return Promise.resolve(queued)
      }

      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          const index = waiters.findIndex((item) => item.resolve === resolve)
          if (index >= 0) {
            waiters.splice(index, 1)
          }
          reject(new Error(`Timeout waiting for ${label}`))
        }, timeoutMs)

        waiters.push({ predicate, resolve, timer })
      })
    },
    close() {
      ws.close()
    },
  }
}

const aliceIdentity = await createGuestIdentity()
const bobIdentity = await createGuestIdentity()

const aliceLogin = await postJson('/api/auth/sessions', null, aliceIdentity)
assert.equal(aliceLogin.status, 200, `alice login failed: ${JSON.stringify(aliceLogin)}`)
const bobLogin = await postJson('/api/auth/sessions', null, bobIdentity)
assert.equal(bobLogin.status, 200, `bob login failed: ${JSON.stringify(bobLogin)}`)

const aliceToken = aliceLogin.json.token
const bobToken = bobLogin.json.token

const me = await getJson('/api/me', aliceToken)
assert.equal(me.status, 200)
assert.equal(me.json.user.address.toLowerCase(), aliceIdentity.address.toLowerCase())

const turnCredentials = await getJson('/api/turn-credentials', aliceToken)
assert.equal(turnCredentials.status, 200)
assert.ok(turnCredentials.json.iceServers.length >= 1)

const friendRequest = await postJson('/api/friends/requests', aliceToken, {
  address: bobIdentity.address,
})
assert.equal(friendRequest.status, 200)
assert.equal(friendRequest.json.status, 'pending')

const bobFriendsBefore = await getJson('/api/friends', bobToken)
assert.equal(bobFriendsBefore.status, 200)
assert.equal(bobFriendsBefore.json.pendingInbound.length, 1)

const acceptRequest = await postJson('/api/friends/accept', bobToken, {
  friendshipId: bobFriendsBefore.json.pendingInbound[0].id,
})
assert.equal(acceptRequest.status, 200)
assert.equal(acceptRequest.json.status, 'accepted')

const aliceFriendsAfter = await getJson('/api/friends', aliceToken)
assert.equal(aliceFriendsAfter.status, 200)
assert.equal(aliceFriendsAfter.json.friends.length, 1)

const groupCreate = await postJson('/api/groups', aliceToken, {
  name: 'Test Group',
  memberAddresses: [bobIdentity.address],
})
assert.equal(groupCreate.status, 200)
assert.equal(groupCreate.json.group.members.length, 2)

const aliceWs = createWsClient(aliceToken)
const bobWs = createWsClient(bobToken)
await Promise.all([aliceWs.open(), bobWs.open()])

const aliceReady = await aliceWs.waitFor(
  (message) => message.type === 'session.ready',
  'alice session.ready',
)
const bobReady = await bobWs.waitFor(
  (message) => message.type === 'session.ready',
  'bob session.ready',
)

aliceWs.send({
  type: 'room.subscribe',
  roomType: 'direct',
  peerAddress: bobIdentity.address,
})
const aliceSubscribed = await aliceWs.waitFor(
  (message) => message.type === 'room.subscribed' && message.roomType === 'direct',
  'alice room.subscribed',
)
assert.equal(aliceSubscribed.peers.length, 0)

bobWs.send({
  type: 'room.subscribe',
  roomType: 'direct',
  peerAddress: aliceIdentity.address,
})
const bobSubscribed = await bobWs.waitFor(
  (message) => message.type === 'room.subscribed' && message.roomType === 'direct',
  'bob room.subscribed',
)
assert.equal(bobSubscribed.peers[0].connectionId, aliceReady.self.connectionId)

const alicePeerJoined = await aliceWs.waitFor(
  (message) =>
    message.type === 'peer.joined' &&
    message.peer.connectionId === bobReady.self.connectionId,
  'alice peer.joined',
)
assert.equal(alicePeerJoined.peer.address.toLowerCase(), bobIdentity.address.toLowerCase())

aliceWs.send({
  type: 'signal.offer',
  roomKey: aliceSubscribed.roomKey,
  targetConnectionId: bobReady.self.connectionId,
  description: {
    type: 'offer',
    sdp: 'fake-sdp',
  },
})

const bobOffer = await bobWs.waitFor(
  (message) => message.type === 'signal.offer',
  'bob signal.offer',
)
assert.equal(bobOffer.from.connectionId, aliceReady.self.connectionId)
assert.equal(bobOffer.description.type, 'offer')

aliceWs.close()
bobWs.close()

console.log(
  JSON.stringify(
    {
      ok: true,
      alice: aliceIdentity.address,
      bob: bobIdentity.address,
      groupId: groupCreate.json.group.id,
      roomKey: aliceSubscribed.roomKey,
      turnServers: turnCredentials.json.iceServers.length,
    },
    null,
    2,
  ),
)
