import { afterEach, describe, expect, it, vi } from 'vitest'
import { generateCompactId, generateUuid } from './uuid'

const originalCrypto = globalThis.crypto

afterEach(() => {
  Object.defineProperty(globalThis, 'crypto', {
    configurable: true,
    value: originalCrypto,
  })
})

describe('uuid utils', () => {
  it('uses native randomUUID when available', () => {
    Object.defineProperty(globalThis, 'crypto', {
      configurable: true,
      value: {
        ...originalCrypto,
        randomUUID: vi.fn(() => '123e4567-e89b-42d3-a456-426614174000'),
      },
    })

    expect(generateUuid()).toBe('123e4567-e89b-42d3-a456-426614174000')
    expect(generateCompactId()).toBe('123e4567e89b42d3a456426614174000')
  })

  it('falls back to getRandomValues when randomUUID is missing', () => {
    Object.defineProperty(globalThis, 'crypto', {
      configurable: true,
      value: {
        getRandomValues: (bytes: Uint8Array) => {
          bytes.set([
            0x12, 0x3e, 0x45, 0x67,
            0xe8, 0x9b, 0x02, 0xd3,
            0x24, 0x56, 0x42, 0x66,
            0x14, 0x17, 0x40, 0x00,
          ])
          return bytes
        },
      },
    })

    expect(generateUuid()).toBe('123e4567-e89b-42d3-a456-426614174000')
  })
})
