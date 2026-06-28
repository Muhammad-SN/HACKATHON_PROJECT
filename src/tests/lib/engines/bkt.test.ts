import { describe, it, expect } from 'vitest'
import { updateMastery, isMastered } from '@/lib/engines/bkt'

describe('BKT updateMastery', () => {
  it('increases mastery after correct answer', () => {
    const updated = updateMastery(0.5, true)
    expect(updated).toBeGreaterThan(0.5)
  })

  it('decreases mastery after wrong answer', () => {
    const updated = updateMastery(0.9, false)
    expect(updated).toBeLessThan(0.9)
  })

  it('clamps output to [0,1]', () => {
    const high = updateMastery(1.0, true)
    const low = updateMastery(0.0, false)
    expect(high).toBeLessThanOrEqual(1)
    expect(low).toBeGreaterThanOrEqual(0)
  })

  it('converges toward 1.0 with repeated correct answers', () => {
    let m = 0.3
    for (let i = 0; i < 30; i++) m = updateMastery(m, true)
    expect(m).toBeGreaterThan(0.85)
  })
})

describe('isMastered', () => {
  it('returns true above threshold', () => expect(isMastered(0.9)).toBe(true))
  it('returns false below threshold', () => expect(isMastered(0.7)).toBe(false))
  it('respects custom threshold', () => expect(isMastered(0.7, 0.6)).toBe(true))
})
