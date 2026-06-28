import { describe, it, expect, beforeEach } from 'vitest'

function createRateLimiter() {
  const map = new Map<string, { count: number; resetAt: number }>()

  function check(key: string, limit: number, nowMs = Date.now()): boolean {
    const entry = map.get(key)
    if (!entry || entry.resetAt < nowMs) {
      map.set(key, { count: 1, resetAt: nowMs + 60_000 })
      return true
    }
    if (entry.count >= limit) return false
    entry.count++
    return true
  }

  return { check }
}

describe('rate limiter', () => {
  let rl: ReturnType<typeof createRateLimiter>
  beforeEach(() => { rl = createRateLimiter() })

  it('allows requests up to the limit', () => {
    for (let i = 0; i < 10; i++) expect(rl.check('k', 10)).toBe(true)
  })

  it('blocks the (limit+1)th request', () => {
    for (let i = 0; i < 10; i++) rl.check('k', 10)
    expect(rl.check('k', 10)).toBe(false)
  })

  it('resets after the window', () => {
    for (let i = 0; i < 10; i++) rl.check('k', 10)
    expect(rl.check('k', 10, Date.now() + 61_000)).toBe(true)
  })

  it('independent keys do not share counters', () => {
    for (let i = 0; i < 10; i++) rl.check('a', 10)
    expect(rl.check('a', 10)).toBe(false)
    expect(rl.check('b', 10)).toBe(true)
  })
})
