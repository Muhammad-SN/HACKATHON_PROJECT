// src/tests/lib/db/progress.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db/pool', () => ({
  getPool: vi.fn().mockReturnValue({ query: vi.fn() }),
}))

import { getPool } from '@/lib/db/pool'
import { getUserTopicMastery, getWeakTopics } from '@/lib/db/progress'

const mockQuery = (getPool as ReturnType<typeof vi.fn>)().query as ReturnType<typeof vi.fn>
beforeEach(() => vi.clearAllMocks())

describe('getUserTopicMastery', () => {
  it('maps DB rows to TopicMasteryRow shape', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{
        topic_id: 't-1', topic_name: 'Cardiology',
        mastery_probability: '0.72', weight: '0.3', attempts: '5',
      }],
    })
    const rows = await getUserTopicMastery('user-1', 'exam-1')
    expect(rows).toHaveLength(1)
    expect(rows[0]?.mastery).toBeCloseTo(0.72)
    expect(rows[0]?.topicName).toBe('Cardiology')
  })

  it('returns empty array when no topics exist', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] })
    const rows = await getUserTopicMastery('user-1', 'exam-1')
    expect(rows).toHaveLength(0)
  })
})

describe('getWeakTopics', () => {
  it('calls query with ORDER BY mastery ASC and correct params', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] })
    await getWeakTopics('user-1', 'exam-1', 3)
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('ASC'), ['user-1', 'exam-1', 3]
    )
  })
})
