import { describe, it, expect, vi, beforeEach } from 'vitest'
vi.mock('@/lib/api/auth-guard', () => ({ requireAuth: vi.fn() }))
vi.mock('@/lib/db/diagnostic', () => ({ createDiagnosticSession: vi.fn(), getUnansweredQuestions: vi.fn() }))
const mockQuery = vi.fn()
vi.mock('@/lib/db/pool', () => ({ getPool: vi.fn(() => ({ query: mockQuery })) }))
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api/auth-guard'
import { createDiagnosticSession, getUnansweredQuestions } from '@/lib/db/diagnostic'
import { POST } from '@/app/api/diagnostic/start/route'
const mockAuth = vi.mocked(requireAuth)
const mockCreate = vi.mocked(createDiagnosticSession)
const mockGetQs = vi.mocked(getUnansweredQuestions)
const authed = { user: { id: 'u1', email: 'a@b.com', name: null, image: null, tier: 'free' as const, role: 'user' as const }, error: null }
const VALID_UUID = '00000000-0000-0000-0000-000000000001'
function makeReq(body: unknown) {
  return new Request('http://localhost/api/diagnostic/start', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
}
describe('POST /api/diagnostic/start', () => {
  beforeEach(() => vi.clearAllMocks())
  it('returns 401 when unauthenticated', async () => {
    mockAuth.mockResolvedValueOnce({ user: null, error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) })
    expect((await POST(makeReq({ examId: VALID_UUID }))).status).toBe(401)
  })
  it('returns 422 for non-UUID examId', async () => {
    mockAuth.mockResolvedValueOnce(authed)
    expect((await POST(makeReq({ examId: 'not-a-uuid' }))).status).toBe(422)
  })
  it('returns done:true when exam has no questions', async () => {
    mockAuth.mockResolvedValueOnce(authed)
    mockCreate.mockResolvedValueOnce('session1')
    mockGetQs.mockResolvedValueOnce([])
    const body = await (await POST(makeReq({ examId: VALID_UUID }))).json() as { data: { done: boolean } }
    expect(body.data.done).toBe(true)
  })
  it('returns sessionId and first question on success', async () => {
    mockAuth.mockResolvedValueOnce(authed)
    mockCreate.mockResolvedValueOnce('session1')
    mockGetQs.mockResolvedValueOnce([{ id: 'q1', difficulty: 0.5, discrimination: 1.0, topicId: 't1' }])
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'q1', stem: 'What is X?', options: ['A','B','C','D'], correct_index: 1, topic_id: 't1' }] })
    const body = await (await POST(makeReq({ examId: VALID_UUID }))).json() as { data: { sessionId: string; question: { stem: string }; done: boolean } }
    expect(body.data.sessionId).toBe('session1')
    expect(body.data.question.stem).toBe('What is X?')
    expect(body.data.done).toBe(false)
  })
})
