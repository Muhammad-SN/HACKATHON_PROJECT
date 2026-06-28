import { describe, it, expect } from 'vitest'
import { scoreQuestion, selectNextStudyQuestion } from '@/lib/engines/selector'
import type { StudyQuestionWithSchedule } from '@/lib/engines/selector'

const now = new Date('2025-01-10T00:00:00Z')
const past = new Date('2025-01-01T00:00:00Z')
const future = new Date('2025-01-20T00:00:00Z')

function makeQ(overrides: Partial<StudyQuestionWithSchedule> = {}): StudyQuestionWithSchedule {
  return {
    id: '1',
    topicId: 'topic1',
    difficulty: 0.5,
    discrimination: 1.0,
    topicMastery: 0.5,
    schedule: { intervalDays: 1, easeFactor: 2.5, repetitionCount: 0, nextReviewAt: past },
    ...overrides,
  }
}

describe('scoreQuestion', () => {
  it('scores overdue question higher than future question', () => {
    const overdue = makeQ({ schedule: { intervalDays: 1, easeFactor: 2.5, repetitionCount: 0, nextReviewAt: past } })
    const future_ = makeQ({ schedule: { intervalDays: 1, easeFactor: 2.5, repetitionCount: 0, nextReviewAt: future } })
    expect(scoreQuestion(overdue, now)).toBeGreaterThan(scoreQuestion(future_, now))
  })

  it('scores weak topic higher than mastered topic', () => {
    const weak = makeQ({ topicMastery: 0.1 })
    const strong = makeQ({ topicMastery: 0.95 })
    expect(scoreQuestion(weak, now)).toBeGreaterThan(scoreQuestion(strong, now))
  })

  it('returns a number in [0, 1]', () => {
    const score = scoreQuestion(makeQ(), now)
    expect(score).toBeGreaterThanOrEqual(0)
    expect(score).toBeLessThanOrEqual(1)
  })
})

describe('selectNextStudyQuestion', () => {
  it('returns null for empty list', () => {
    expect(selectNextStudyQuestion([], now)).toBeNull()
  })

  it('selects the highest-scoring question', () => {
    const overdue = makeQ({ id: 'overdue', schedule: { intervalDays: 1, easeFactor: 2.5, repetitionCount: 0, nextReviewAt: past } })
    const notDue = makeQ({ id: 'future', schedule: { intervalDays: 1, easeFactor: 2.5, repetitionCount: 0, nextReviewAt: future } })
    const selected = selectNextStudyQuestion([notDue, overdue], now)
    expect(selected?.id).toBe('overdue')
  })
})
