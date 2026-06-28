import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/api/auth-guard', () => ({
  requireAuth: vi.fn().mockResolvedValue({ user: { id: 'user-1', tier: 'free' }, error: null }),
}))
vi.mock('@/lib/db/study', () => ({
  createStudySession: vi.fn().mockResolvedValue('sess-1'),
  getDueQuestions: vi.fn().mockResolvedValue([]),
  fetchStudyQuestion: vi.fn(),
  upsertQuestionSchedule: vi.fn().mockResolvedValue(undefined),
  updateTopicMastery: vi.fn().mockResolvedValue(undefined),
  recordStudyAnswer: vi.fn().mockResolvedValue(undefined),
  getStudySessionOwner: vi.fn().mockResolvedValue('user-1'),
}))
vi.mock('@/lib/db/pool', () => ({
  getPool: vi.fn().mockReturnValue({
    query: vi.fn().mockResolvedValue({ rows: [] }),
  }),
}))
vi.mock('@/lib/engines/selector', () => ({
  selectNextStudyQuestion: vi.fn().mockReturnValue(null),
}))

import { POST as startPOST } from '@/app/api/study/start/route'
import { POST as answerPOST } from '@/app/api/study/answer/route'
import { getDueQuestions, fetchStudyQuestion } from '@/lib/db/study'
import { selectNextStudyQuestion } from '@/lib/engines/selector'

const mockGetDue = getDueQuestions as ReturnType<typeof vi.fn>
const mockFetch = fetchStudyQuestion as ReturnType<typeof vi.fn>
const mockSelect = selectNextStudyQuestion as ReturnType<typeof vi.fn>

beforeEach(() => vi.clearAllMocks())

function makeReq(body: unknown) {
  return new Request('http://localhost', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/study/start', () => {
  it('returns done:true when no questions', async () => {
    mockGetDue.mockResolvedValueOnce([])
    mockSelect.mockReturnValueOnce(null)
    const res = await startPOST(makeReq({ examId: '00000000-0000-0000-0000-000000000001' }))
    const body = await res.json() as { data: { done: boolean } }
    expect(body.data.done).toBe(true)
  })

  it('returns 422 on invalid examId', async () => {
    const res = await startPOST(makeReq({ examId: 'not-a-uuid' }))
    expect(res.status).toBe(422)
  })
})

describe('POST /api/study/answer', () => {
  it('returns 404 for unknown question', async () => {
    mockFetch.mockResolvedValueOnce(null)
    const res = await answerPOST(makeReq({
      sessionId: '00000000-0000-0000-0000-000000000001',
      questionId: '00000000-0000-0000-0000-000000000002',
      chosenIndex: 0,
      timeSpentMs: 5000,
    }))
    expect(res.status).toBe(404)
  })

  it('returns 422 on invalid chosenIndex', async () => {
    const res = await answerPOST(makeReq({
      sessionId: '00000000-0000-0000-0000-000000000001',
      questionId: '00000000-0000-0000-0000-000000000002',
      chosenIndex: 10,
      timeSpentMs: 5000,
    }))
    expect(res.status).toBe(422)
  })
})
