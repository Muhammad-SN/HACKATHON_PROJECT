import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/api/auth-guard', () => ({ requireAuth: vi.fn() }))
vi.mock('@/lib/db/exams', () => ({ enrollUserInExam: vi.fn() }))

const mockQuery = vi.fn()
vi.mock('@/lib/db/pool', () => ({
  getPool: vi.fn(() => ({ query: mockQuery })),
}))

import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api/auth-guard'
import { enrollUserInExam } from '@/lib/db/exams'
import { POST } from '@/app/api/onboarding/enroll/route'

const mockRequireAuth = vi.mocked(requireAuth)
const mockEnroll = vi.mocked(enrollUserInExam)

const VALID_UUID = '00000000-0000-0000-0000-000000000001'

const authed = {
  user: { id: 'u1', email: 'a@b.com', name: null, image: null, tier: 'free' as const, role: 'user' as const },
  error: null,
}

function makeReq(body: unknown) {
  return new Request('http://localhost/api/onboarding/enroll', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/onboarding/enroll', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when unauthenticated', async () => {
    mockRequireAuth.mockResolvedValueOnce({
      user: null,
      error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    })
    const res = await POST(makeReq({ examId: VALID_UUID }))
    expect(res.status).toBe(401)
  })

  it('returns 422 for non-UUID examId', async () => {
    mockRequireAuth.mockResolvedValueOnce(authed)
    const res = await POST(makeReq({ examId: 'not-a-uuid' }))
    expect(res.status).toBe(422)
  })

  it('returns 400 for invalid JSON body', async () => {
    mockRequireAuth.mockResolvedValueOnce(authed)
    const req = new Request('http://localhost/api/onboarding/enroll', {
      method: 'POST',
      body: 'not-json',
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('returns 404 when exam is not found or not public', async () => {
    mockRequireAuth.mockResolvedValueOnce(authed)
    mockQuery.mockResolvedValueOnce({ rows: [] })
    const res = await POST(makeReq({ examId: VALID_UUID }))
    expect(res.status).toBe(404)
  })

  it('enrolls user and returns redirect URL on success', async () => {
    mockRequireAuth.mockResolvedValueOnce(authed)
    mockQuery.mockResolvedValueOnce({ rows: [{ id: VALID_UUID }] })
    mockEnroll.mockResolvedValueOnce(undefined)
    const res = await POST(makeReq({ examId: VALID_UUID }))
    expect(res.status).toBe(200)
    const body = await res.json() as { success: boolean; data: { redirectUrl: string }; error: null }
    expect(body.success).toBe(true)
    expect(body.data.redirectUrl).toBe(`/diagnostic?examId=${VALID_UUID}`)
    expect(mockEnroll).toHaveBeenCalledWith('u1', VALID_UUID)
  })
})
