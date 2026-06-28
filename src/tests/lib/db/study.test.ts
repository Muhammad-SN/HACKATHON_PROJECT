import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db/pool', () => ({
  getPool: vi.fn().mockReturnValue({
    query: vi.fn(),
  }),
}))

import { getPool } from '@/lib/db/pool'
import {
  createStudySession,
  getDueQuestions,
  upsertQuestionSchedule,
  updateTopicMastery,
  recordStudyAnswer,
} from '@/lib/db/study'

const mockPool = getPool as ReturnType<typeof vi.fn>

function getQuery() {
  return mockPool().query as ReturnType<typeof vi.fn>
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('createStudySession', () => {
  it('returns session id', async () => {
    getQuery().mockResolvedValueOnce({ rows: [{ id: 'sess-1' }] })
    const id = await createStudySession('user-1', 'exam-1')
    expect(id).toBe('sess-1')
    expect(getQuery()).toHaveBeenCalledWith(expect.stringContaining('adaptive'), ['user-1', 'exam-1'])
  })
})

describe('upsertQuestionSchedule', () => {
  it('calls query with correct params', async () => {
    getQuery().mockResolvedValueOnce({ rows: [] })
    const update = { intervalDays: 6, easeFactor: 2.5, repetitionCount: 1, nextReviewAt: new Date('2025-01-07') }
    await upsertQuestionSchedule('user-1', 'q-1', update)
    expect(getQuery()).toHaveBeenCalledWith(
      expect.stringContaining('ON CONFLICT'),
      ['user-1', 'q-1', update.nextReviewAt, 6, 2.5, 1]
    )
  })
})

describe('updateTopicMastery', () => {
  it('calls query with mastery value', async () => {
    getQuery().mockResolvedValueOnce({ rows: [] })
    await updateTopicMastery('user-1', 'topic-1', 0.75)
    expect(getQuery()).toHaveBeenCalledWith(
      expect.stringContaining('mastery_probability'),
      ['user-1', 'topic-1', 0.75]
    )
  })
})

describe('recordStudyAnswer', () => {
  it('inserts answer event', async () => {
    getQuery().mockResolvedValueOnce({ rows: [] })
    await recordStudyAnswer('sess-1', 'user-1', 'q-1', 2, true, 5000)
    expect(getQuery()).toHaveBeenCalledWith(
      expect.stringContaining('answer_events'),
      ['sess-1', 'user-1', 'q-1', 2, true, 5000]
    )
  })
})

describe('getDueQuestions', () => {
  it('maps rows to StudyQuestionWithSchedule', async () => {
    getQuery().mockResolvedValueOnce({
      rows: [{
        id: 'q-1', topic_id: 't-1', difficulty: '0.5', discrimination: '1.0',
        interval_days: '1', ease_factor: '2.5', repetition_count: '0',
        next_review_at: new Date('2025-01-01'), topic_mastery: '0.4',
      }],
    })
    const qs = await getDueQuestions('user-1', 'exam-1')
    expect(qs).toHaveLength(1)
    expect(qs[0]?.topicMastery).toBe(0.4)
    expect(qs[0]?.schedule.easeFactor).toBe(2.5)
  })
})
