import { describe, it, expect } from 'vitest'
import { sm2Update, qualityFromCorrect, defaultSm2Record } from '@/lib/engines/sm2'

const now = new Date('2025-01-01T00:00:00Z')

describe('sm2Update', () => {
  it('resets on incorrect answer (quality < 3)', () => {
    const rec = { intervalDays: 10, easeFactor: 2.5, repetitionCount: 3 }
    const updated = sm2Update(rec, 1, now)
    expect(updated.repetitionCount).toBe(0)
    expect(updated.intervalDays).toBe(1)
  })

  it('sets interval to 1 on first correct', () => {
    const rec = defaultSm2Record()
    const updated = sm2Update(rec, 4, now)
    expect(updated.intervalDays).toBe(1)
    expect(updated.repetitionCount).toBe(1)
  })

  it('sets interval to 6 on second correct', () => {
    const rec = { intervalDays: 1, easeFactor: 2.5, repetitionCount: 1 }
    const updated = sm2Update(rec, 4, now)
    expect(updated.intervalDays).toBe(6)
    expect(updated.repetitionCount).toBe(2)
  })

  it('grows interval multiplicatively after repetition > 1', () => {
    const rec = { intervalDays: 6, easeFactor: 2.5, repetitionCount: 2 }
    const updated = sm2Update(rec, 4, now)
    expect(updated.intervalDays).toBeGreaterThan(6)
  })

  it('nextReviewAt is in the future', () => {
    const updated = sm2Update(defaultSm2Record(), 5, now)
    expect(updated.nextReviewAt.getTime()).toBeGreaterThan(now.getTime())
  })

  it('keeps ease factor above MIN (1.3)', () => {
    let rec = defaultSm2Record()
    for (let i = 0; i < 20; i++) rec = sm2Update(rec, 0, now)
    expect(rec.easeFactor).toBeGreaterThanOrEqual(1.3)
  })
})

describe('qualityFromCorrect', () => {
  it('returns 1 for incorrect', () => expect(qualityFromCorrect(false, 5000)).toBe(1))
  it('returns 5 for fast correct', () => expect(qualityFromCorrect(true, 3000)).toBe(5))
  it('returns 3 for slow correct', () => expect(qualityFromCorrect(true, 40000)).toBe(3))
})
