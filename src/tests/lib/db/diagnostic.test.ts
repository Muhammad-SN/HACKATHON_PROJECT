import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockQuery = vi.fn()
vi.mock('@/lib/db/pool', () => ({
  getPool: vi.fn(() => ({ query: mockQuery })),
}))

import {
  createDiagnosticSession,
  getUnansweredQuestions,
  recordAnswer,
  getSessionAnswers,
  completeDiagnosticSession,
  seedTopicMastery,
} from '@/lib/db/diagnostic'
import type { IrtAnswer } from '@/lib/engines/cold-start'

const UUID = '00000000-0000-0000-0000-000000000001'

describe('createDiagnosticSession', () => {
  beforeEach(() => vi.clearAllMocks())
  it('returns session id from inserted row', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: UUID }] })
    const id = await createDiagnosticSession('u1', 'e1')
    expect(id).toBe(UUID)
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO study_sessions'),
      expect.arrayContaining(['u1', 'e1', 'diagnostic'])
    )
  })
})

describe('getUnansweredQuestions', () => {
  beforeEach(() => vi.clearAllMocks())
  it('maps DB rows to IrtQuestion shape', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: UUID, difficulty: 0.5, discrimination: 1.2, topic_id: 't1' }],
    })
    const qs = await getUnansweredQuestions('session1', 'exam1')
    expect(qs).toHaveLength(1)
    expect(qs[0]).toEqual({ id: UUID, difficulty: 0.5, discrimination: 1.2, topicId: 't1' })
  })
  it('returns empty array when no rows', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] })
    expect(await getUnansweredQuestions('s1', 'e1')).toEqual([])
  })
})

describe('recordAnswer', () => {
  beforeEach(() => vi.clearAllMocks())
  it('inserts into answer_events with correct params', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] })
    await recordAnswer('s1', 'u1', 'q1', 2, true, 4500)
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO answer_events'),
      ['s1', 'u1', 'q1', 2, true, 4500]
    )
  })
})

describe('getSessionAnswers', () => {
  beforeEach(() => vi.clearAllMocks())
  it('returns IrtAnswer array from DB', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ is_correct: true, difficulty: 0.5, discrimination: 1.0, topic_id: 't1', question_id: 'q1' }],
    })
    const answers = await getSessionAnswers('s1')
    expect(answers).toHaveLength(1)
    const first = answers[0]!
    expect(first.correct).toBe(true)
    expect(first.question.difficulty).toBe(0.5)
  })
})

describe('completeDiagnosticSession', () => {
  beforeEach(() => vi.clearAllMocks())
  it('sets ended_at on the session', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] })
    await completeDiagnosticSession('s1')
    expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining('ended_at'), ['s1'])
  })
})

describe('seedTopicMastery', () => {
  beforeEach(() => vi.clearAllMocks())
  it('upserts one row per unique topic', async () => {
    const answers: IrtAnswer[] = [
      { question: { id: 'q1', difficulty: 0.5, discrimination: 1.0, topicId: 't1' }, correct: true },
      { question: { id: 'q2', difficulty: 0.5, discrimination: 1.0, topicId: 't1' }, correct: false },
      { question: { id: 'q3', difficulty: 0.5, discrimination: 1.0, topicId: 't2' }, correct: true },
    ]
    mockQuery.mockResolvedValue({ rows: [] })
    await seedTopicMastery('u1', answers)
    expect(mockQuery).toHaveBeenCalledTimes(2)
  })
  it('does nothing for empty answers', async () => {
    await seedTopicMastery('u1', [])
    expect(mockQuery).not.toHaveBeenCalled()
  })
})
