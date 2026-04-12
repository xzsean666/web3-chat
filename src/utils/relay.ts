type NostrProbeModule = typeof import('trystero/nostr')

export type RelayProbeResult = {
  url: string
  ok: boolean
  latencyMs: number
  reason?: string
}

export type RelaySelectionResult = {
  selectedUrls: string[]
  reachableRelays: RelayProbeResult[]
  failedRelays: RelayProbeResult[]
  usedFallback: boolean
}

const DEFAULT_RELAY_CACHE_TTL_MS = 60_000
const PROBE_PUBLISH_DELAY_MS = 150

type RelaySelectionOptions = {
  timeoutMs: number
  maxCount: number
  cacheTtlMs?: number
}

let relaySelectionCache:
  | {
      cacheKey: string
      cachedAt: number
      result: RelaySelectionResult
    }
  | null = null
let nostrProbeModulePromise: Promise<NostrProbeModule> | null = null

function loadNostrProbeModule() {
  nostrProbeModulePromise ??= import('trystero/nostr')
  return nostrProbeModulePromise
}

function createProbeId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 12)}`
}

export async function probeRelayUrl(
  url: string,
  timeoutMs: number,
): Promise<RelayProbeResult> {
  const startedAt = Date.now()

  if (typeof WebSocket === 'undefined') {
    return {
      url,
      ok: false,
      latencyMs: 0,
      reason: 'websocket-unavailable',
    }
  }

  try {
    const { createEvent, subscribe } = await loadNostrProbeModule()
    const subscriber = new WebSocket(url)
    const publisher = new WebSocket(url)
    const topic = createProbeId('topic')
    const subId = createProbeId('sub')
    const marker = createProbeId('marker')

    return await new Promise((resolve) => {
      let settled = false
      let subscriberOpen = false
      let publisherOpen = false
      let published = false

      const finish = (result: RelayProbeResult) => {
        if (settled) {
          return
        }

        settled = true
        window.clearTimeout(timer)

        try {
          subscriber.close()
        } catch {
          // Ignore close errors on probe sockets.
        }

        try {
          publisher.close()
        } catch {
          // Ignore close errors on probe sockets.
        }

        resolve(result)
      }

      const fail = (reason: string) => {
        finish({
          url,
          ok: false,
          latencyMs: Date.now() - startedAt,
          reason,
        })
      }

      const maybePublish = () => {
        if (!subscriberOpen || !publisherOpen || published) {
          return
        }

        published = true
        window.setTimeout(() => {
          void (async () => {
            try {
              publisher.send(await createEvent(topic, marker))
            } catch (error) {
              fail(error instanceof Error ? error.message : String(error))
            }
          })()
        }, PROBE_PUBLISH_DELAY_MS)
      }

      const timer = window.setTimeout(() => {
        fail('timeout')
      }, timeoutMs)

      subscriber.addEventListener('open', () => {
        subscriberOpen = true
        subscriber.send(subscribe(subId, topic))
        maybePublish()
      })

      publisher.addEventListener('open', () => {
        publisherOpen = true
        maybePublish()
      })

      subscriber.addEventListener('message', (event) => {
        try {
          const payload = JSON.parse(String(event.data)) as unknown

          if (!Array.isArray(payload) || payload.length < 2) {
            return
          }

          if (payload[0] === "NOTICE") {
            fail(`notice:${String(payload[1] ?? "unknown")}`)
            return
          }

          if (
            payload[0] === "EVENT" &&
            payload[2] &&
            typeof payload[2] === "object" &&
            "content" in payload[2] &&
            payload[2].content === marker
          ) {
            finish({
              url,
              ok: true,
              latencyMs: Date.now() - startedAt,
            })
          }
        } catch {
          // Ignore malformed probe payloads from relays.
        }
      })

      subscriber.addEventListener('error', () => {
        fail('subscriber-error')
      })
      publisher.addEventListener('error', () => {
        fail('publisher-error')
      })

      subscriber.addEventListener('close', (event) => {
        if (!settled) {
          fail(`subscriber-close:${String(event.code)}`)
        }
      })
      publisher.addEventListener('close', (event) => {
        if (!settled) {
          fail(`publisher-close:${String(event.code)}`)
        }
      })
    })
  } catch (error) {
    return {
      url,
      ok: false,
      latencyMs: Date.now() - startedAt,
      reason: error instanceof Error ? error.message : String(error),
    }
  }
}

export async function selectReachableRelayUrls(
  urls: string[],
  options: RelaySelectionOptions,
): Promise<RelaySelectionResult> {
  const uniqueUrls = [...new Set(urls.map((url) => url.trim()).filter(Boolean))]

  if (!uniqueUrls.length) {
    return {
      selectedUrls: [],
      reachableRelays: [],
      failedRelays: [],
      usedFallback: false,
    }
  }

  const maxCount = Math.max(1, Math.trunc(options.maxCount))
  const cacheTtlMs = options.cacheTtlMs ?? DEFAULT_RELAY_CACHE_TTL_MS
  const cacheKey = [uniqueUrls.join(','), String(options.timeoutMs), String(maxCount)].join('|')

  if (
    cacheTtlMs > 0 &&
    relaySelectionCache?.cacheKey === cacheKey &&
    Date.now() - relaySelectionCache.cachedAt < cacheTtlMs
  ) {
    return relaySelectionCache.result
  }

  const probeResults = await Promise.all(
    uniqueUrls.map((url) => probeRelayUrl(url, options.timeoutMs)),
  )
  const reachableRelays = probeResults
    .filter((result) => result.ok)
    .sort((left, right) => left.latencyMs - right.latencyMs)
  const failedRelays = probeResults.filter((result) => !result.ok)
  const reachableUrlSet = new Set(reachableRelays.map((result) => result.url))
  const selectedUrls = (
    reachableRelays.length
      ? uniqueUrls.filter((url) => reachableUrlSet.has(url))
      : uniqueUrls
  ).slice(0, maxCount)

  const result = {
    selectedUrls,
    reachableRelays,
    failedRelays,
    usedFallback: reachableRelays.length === 0,
  } satisfies RelaySelectionResult

  if (cacheTtlMs > 0) {
    relaySelectionCache = {
      cacheKey,
      cachedAt: Date.now(),
      result,
    }
  }

  return result
}
