import { describe, it, expect, vi, beforeEach } from 'vitest'
vi.mock('@/lib/api/auth-guard', () => ({ requireAuth: vi.fn() }))
vi.mock('@/lib/db/diagnostic', () => ({
  recordAnswer: vi.fn(), getSessionAnswers: vi.fn(), getUnansweredQuestions: vi.fn(),
  completeDiagnosticSession: vi.fn(), seedTopicMastery: vi.fn(),
}))
const mockQuery = vi.fn()
vi.mock('@/lib/db/pool', () => ({ getPool: vi.fn(() => ({ query: mockQuery })) }))
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api/auth-guard'
import { recordAnswer, getSessionAnswers, getUnansweredQuestions, completeDiagnosticSession, seedTopicMastery } from '@/lib/db/diagnostic'
import { POST } from '@/app/api/diagnostic/answer/route'
const mockAuth = vi.mocked(requireAuth)
const mockRecord = vi.mocked(recordAnswer)
const mockGetAnswers = vi.mocked(getSessionAnswers)
const mockGetQs = vi.mocked(getUnansweredQuestions)
const mockComplete = vi.mocked(completeDiagnosticSession)
const mockSeed = vi.mocked(seedTopicMastery)
const authed = { user: { id: 'u1', email: 'a@b.com', name: null, image: null, tier: 'free' as const, role: 'user' as const }, error: null }
const VALID_UUID = '00000000-0000-0000-0000-000000000001'
const VALID_UUID2 = '00000000-0000-0000-0000-000000000002'
function makeReq(body: unknown) {
  return new Request('http://localhost/api/diagnostic/answer', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
}
const validBody = { sessionId: VALID_UUID, questionId: VALID_UUID2, chosenIndex: 1, timeSpentMs: 3000 }
describe('POST /api/diagnostic/answer', () => {
  beforeEach(() => vi.clearAllMocks())
  it('returns 401 when unauthenticated', async () => {
    mockAuth.mockResolvedValueOnce({ user: null, error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) })
    expect((await POST(makeReq(validBody))).status).toBe(401)
  })
  it('returns 422 for invalid body', async () => {
    mockAuth.mockResolvedValueOnce(authed)
    expect((await POST(makeReq({ sessionId: 'bad' }))).status).toBe(422)
  })
  it('returns 404 when session not found', async () => {
    mockAuth.mockResolvedValueOnce(authed)
    mockQuery.mockResolvedValueOnce({ rows: [] })
    expect((await POST(makeReq(validBody))).status).toBe(404)
  })
  it('returns done:true and seeds mastery when CAT stops', async () => {
    mockAuth.mockResolvedValueOnce(authed)
    mockQuery.mockResolvedValueOnce({ rows: [{ exam_id: 'exam1', ended_at: null }] })
    mockQuery.mockResolvedValueOnce({ rows: [{ correct_index: 1 }] })
    mockRecord.mockResolvedValueOnce(undefined)
    const bigAnswers = Array.from({ length: 20 }, (_, i) => ({
      correct: true, question: { id: `q${i}`, difficulty: 0.5, discrimination: 1.0, topicId: 't1' },
    }))
    mockGetAnswers.mockResolvedValueOnce(bigAnswers)
    mockGetQs.mockResolvedValueOnce([])
    mockComplete.mockResolvedValueOnce(undefined)
    mockSeed.mockResolvedValueOnce(undefined)
    const body = await (await POST(makeReq(validBody))).json() as { data: { done: boolean; isCorrect: boolean } }
    expect(body.data.done).toBe(true)
    expect(body.data.isCorrect).toBe(true)
    expect(mockComplete).toHaveBeenCalled()
    expect(mockSeed).toHaveBeenCalled()
  })
})
