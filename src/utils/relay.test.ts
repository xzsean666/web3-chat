import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const nostrState = vi.hoisted(() => ({
  createEventMock: vi.fn(async (topic: string, content: string) =>
    JSON.stringify(['EVENT', { id: `id-${topic}`, content, tags: [['x', topic]] }]),
  ),
  subscribeMock: vi.fn((subId: string, topic: string) =>
    JSON.stringify(['REQ', subId, { '#x': [topic] }]),
  ),
}))

vi.mock('trystero/nostr', () => ({
  createEvent: nostrState.createEventMock,
  subscribe: nostrState.subscribeMock,
}))

import { selectReachableRelayUrls } from './relay'

type MockMode = 'ok' | 'open-error' | 'timeout' | 'no-delivery'

type MockBehavior = {
  mode: MockMode
  openDelayMs?: number
  publishDelayMs?: number
}

class MockWebSocket {
  static behaviors = new Map<string, MockBehavior>()
  static socketsByUrl = new Map<string, Set<MockWebSocket>>()

  private listeners: Record<string, Array<(event?: unknown) => void>> = {
    open: [],
    error: [],
    close: [],
    message: [],
  }

  private closed = false
  private subscriptions: Array<{ subId: string; topic: string }> = []
  private opened = false
  readonly url: string

  constructor(url: string) {
    this.url = url
    const behavior = MockWebSocket.behaviors.get(url) ?? { mode: "ok" }
    const sockets = MockWebSocket.socketsByUrl.get(url) ?? new Set<MockWebSocket>()
    sockets.add(this)
    MockWebSocket.socketsByUrl.set(url, sockets)

    if (behavior.mode === "timeout") {
      return
    }

    setTimeout(() => {
      if (this.closed) {
        return
      }

      if (behavior.mode === "open-error") {
        this.emit("error")
        return
      }

      this.opened = true
      this.emit("open")
    }, behavior.openDelayMs ?? 0)
  }

  addEventListener(type: string, handler: (event?: unknown) => void) {
    this.listeners[type]?.push(handler)
  }

  send(data: string) {
    if (!this.opened || this.closed) {
      return
    }

    const behavior = MockWebSocket.behaviors.get(this.url) ?? { mode: "ok" }
    const payload = JSON.parse(data) as unknown[]

    if (payload[0] === "REQ") {
      this.subscriptions.push({
        subId: String(payload[1]),
        topic: String((payload[2] as Record<string, string[]>)["#x"]?.[0] ?? ""),
      })
      return
    }

    if (payload[0] !== "EVENT" || behavior.mode === "no-delivery") {
      return
    }

    const eventPayload = payload[1] as Record<string, unknown>
    const topic = Array.isArray(eventPayload.tags)
      ? ((eventPayload.tags.find(
          (tag) => Array.isArray(tag) && tag[0] === "x",
        ) as string[] | undefined)?.[1] ?? "")
      : ""

    for (const socket of MockWebSocket.socketsByUrl.get(this.url) ?? []) {
      for (const subscription of socket.subscriptions) {
        if (subscription.topic !== topic) {
          continue
        }

        setTimeout(() => {
          socket.emit("message", {
            data: JSON.stringify(['EVENT', subscription.subId, eventPayload]),
          })
        }, behavior.publishDelayMs ?? 0)
      }
    }
  }

  close() {
    if (this.closed) {
      return
    }

    this.closed = true
    this.emit("close", { code: 1000 })
    MockWebSocket.socketsByUrl.get(this.url)?.delete(this)
  }

  private emit(type: string, event?: unknown) {
    for (const handler of this.listeners[type] ?? []) {
      handler(event)
    }
  }
}

describe('relay selection', () => {
  beforeEach(() => {
    vi.stubGlobal('WebSocket', MockWebSocket as unknown as typeof WebSocket)
    MockWebSocket.behaviors.clear()
    MockWebSocket.socketsByUrl.clear()
    nostrState.createEventMock.mockClear()
    nostrState.subscribeMock.mockClear()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('keeps the configured relay order for overlap stability', async () => {
    MockWebSocket.behaviors.set('wss://slow.example', { mode: "ok", publishDelayMs: 30 })
    MockWebSocket.behaviors.set('wss://fast.example', { mode: "ok", publishDelayMs: 5 })
    MockWebSocket.behaviors.set('wss://mid.example', { mode: "ok", publishDelayMs: 12 })

    const result = await selectReachableRelayUrls(
      ['wss://slow.example', 'wss://fast.example', 'wss://mid.example'],
      { timeoutMs: 400, maxCount: 2, cacheTtlMs: 0 },
    )

    expect(result.selectedUrls).toEqual([
      'wss://slow.example',
      'wss://fast.example',
    ])
    expect(result.reachableRelays.map((relay) => relay.url)).toEqual([
      'wss://fast.example',
      'wss://mid.example',
      'wss://slow.example',
    ])
    expect(result.usedFallback).toBe(false)
  })

  it('produces the same selected relay order across different latency profiles', async () => {
    MockWebSocket.behaviors.set('wss://relay-a.example', { mode: "ok", publishDelayMs: 40 })
    MockWebSocket.behaviors.set('wss://relay-b.example', { mode: "ok", publishDelayMs: 5 })
    MockWebSocket.behaviors.set('wss://relay-c.example', { mode: "ok", publishDelayMs: 20 })

    const firstResult = await selectReachableRelayUrls(
      ['wss://relay-a.example', 'wss://relay-b.example', 'wss://relay-c.example'],
      { timeoutMs: 400, maxCount: 3, cacheTtlMs: 0 },
    )

    MockWebSocket.behaviors.set('wss://relay-a.example', { mode: "ok", publishDelayMs: 10 })
    MockWebSocket.behaviors.set('wss://relay-b.example', { mode: "ok", publishDelayMs: 50 })
    MockWebSocket.behaviors.set('wss://relay-c.example', { mode: "ok", publishDelayMs: 15 })

    const secondResult = await selectReachableRelayUrls(
      ['wss://relay-a.example', 'wss://relay-b.example', 'wss://relay-c.example'],
      { timeoutMs: 400, maxCount: 3, cacheTtlMs: 0 },
    )

    expect(firstResult.selectedUrls).toEqual([
      'wss://relay-a.example',
      'wss://relay-b.example',
      'wss://relay-c.example',
    ])
    expect(secondResult.selectedUrls).toEqual([
      'wss://relay-a.example',
      'wss://relay-b.example',
      'wss://relay-c.example',
    ])
  })

  it('falls back to the original relay order when probes fail', async () => {
    MockWebSocket.behaviors.set('wss://error.example', { mode: "open-error" })
    MockWebSocket.behaviors.set('wss://timeout.example', { mode: "timeout" })
    MockWebSocket.behaviors.set('wss://backup.example', { mode: "no-delivery" })

    const result = await selectReachableRelayUrls(
      ['wss://error.example', 'wss://timeout.example', 'wss://backup.example'],
      { timeoutMs: 30, maxCount: 2, cacheTtlMs: 0 },
    )

    expect(result.selectedUrls).toEqual([
      'wss://error.example',
      'wss://timeout.example',
    ])
    expect(result.reachableRelays).toEqual([])
    expect(result.failedRelays).toHaveLength(3)
    expect(result.usedFallback).toBe(true)
  })
})
