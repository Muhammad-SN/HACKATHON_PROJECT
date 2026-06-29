// src/tests/lib/engines/readiness.test.ts
import { describe, it, expect } from 'vitest'
import { predictedScore, confidenceInterval } from '@/lib/engines/readiness'

describe('predictedScore', () => {
  it('returns 0 for empty topic list', () => {
    expect(predictedScore([])).toBe(0)
  })

  it('computes weighted average × 100 for uniform weights', () => {
    const topics = [
      { mastery: 0.8, weight: 0.5 },
      { mastery: 0.6, weight: 0.5 },
    ]
    expect(predictedScore(topics)).toBeCloseTo(70, 1)
  })

  it('gives more influence to higher-weight topics', () => {
    const topics = [
      { mastery: 1.0, weight: 0.9 },
      { mastery: 0.0, weight: 0.1 },
    ]
    expect(predictedScore(topics)).toBeGreaterThan(80)
  })

  it('clamps result to [0, 100]', () => {
    const topics = [{ mastery: 1.5, weight: 1.0 }]
    expect(predictedScore(topics)).toBeLessThanOrEqual(100)
  })
})

describe('confidenceInterval', () => {
  it('returns 0 for empty topic list', () => {
    expect(confidenceInterval([], 0)).toBe(0)
  })

  it('returns 0 when totalAttempts is 0', () => {
    const topics = [{ mastery: 0.8, weight: 0.5 }]
    expect(confidenceInterval(topics, 0)).toBe(0)
  })

  it('returns a positive number for non-zero attempts and variance', () => {
    const topics = [
      { mastery: 0.8, weight: 0.5 },
      { mastery: 0.4, weight: 0.5 },
    ]
    expect(confidenceInterval(topics, 10)).toBeGreaterThan(0)
  })
})
