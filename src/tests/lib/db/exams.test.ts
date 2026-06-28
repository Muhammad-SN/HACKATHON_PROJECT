import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockQuery = vi.fn()
vi.mock('@/lib/db/pool', () => ({
  getPool: vi.fn(() => ({ query: mockQuery })),
}))

import { searchPublicExams, enrollUserInExam, getUserExamCount } from '@/lib/db/exams'

describe('searchPublicExams', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns mapped results for a non-empty query', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        { id: 'e1', name: 'Bar Exam', stakes_level: 'high', domain: 'legal', question_count: 42 },
      ],
    })
    const results = await searchPublicExams('bar')
    expect(results).toHaveLength(1)
    expect(results[0]).toEqual({
      id: 'e1',
      name: 'Bar Exam',
      stakesLevel: 'high',
      domain: 'legal',
      questionCount: 42,
    })
  })

  it('calls query with no params for empty string', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] })
    await searchPublicExams('')
    expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining('ORDER BY'), [])
  })

  it('calls query with trimmed param for non-empty string', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] })
    await searchPublicExams('  python  ')
    expect(mockQuery).toHaveBeenCalledWith(expect.any(String), ['python'])
  })

  it('returns empty array when no rows match', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] })
    const results = await searchPublicExams('zzznomatch')
    expect(results).toEqual([])
  })
})

describe('enrollUserInExam', () => {
  beforeEach(() => vi.clearAllMocks())

  it('inserts into user_exams with correct params', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] })
    await enrollUserInExam('u1', 'e1')
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO user_exams'),
      ['u1', 'e1']
    )
  })
})

describe('getUserExamCount', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns count from db', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ count: 3 }] })
    const count = await getUserExamCount('u1')
    expect(count).toBe(3)
  })

  it('returns 0 when rows is empty', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] })
    const count = await getUserExamCount('u1')
    expect(count).toBe(0)
  })
})
