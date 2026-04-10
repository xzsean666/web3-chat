import { describe, expect, it } from 'vitest'
import { clampText, formatDateTime, formatTime } from './format'

describe('format utils', () => {
  it('trims whitespace and caps length', () => {
    expect(clampText('   hello world   ', 5)).toBe('hello')
  })

  it('does not blow up for malformed dates', () => {
    const invalid = 'not-a-valid-date'

    expect(formatDateTime(invalid)).toBe('无效时间')
    expect(formatTime(invalid)).toBe('无效时间')
  })
})
