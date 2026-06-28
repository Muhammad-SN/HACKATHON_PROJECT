import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/api/auth-guard', () => ({ requireAuth: vi.fn() }))
vi.mock('@/lib/db/exams', () => ({ searchPublicExams: vi.fn() }))

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { requireAuth } from '@/lib/api/auth-guard'
import { searchPublicExams } from '@/lib/db/exams'
import { GET } from '@/app/api/onboarding/search/route'

const mockRequireAuth = vi.mocked(requireAuth)
const mockSearch = vi.mocked(searchPublicExams)

const authed = {
  user: { id: 'u1', email: 'a@b.com', name: null, image: null, tier: 'free' as const, role: 'user' as const },
  error: null,
}

function createMockRequest(url: string): NextRequest {
  const req = new Request(url)
  const nextUrl = new URL(url)
  return Object.assign(req, { nextUrl }) as NextRequest
}

describe('GET /api/onboarding/search', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when unauthenticated', async () => {
    mockRequireAuth.mockResolvedValueOnce({
      user: null,
      error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    })
    const req = createMockRequest('http://localhost/api/onboarding/search?q=bar')
    const res = await GET(req)
    expect(res.status).toBe(401)
  })

  it('passes q param to searchPublicExams', async () => {
    mockRequireAuth.mockResolvedValueOnce(authed)
    mockSearch.mockResolvedValueOnce([])
    const req = createMockRequest('http://localhost/api/onboarding/search?q=python')
    await GET(req)
    expect(mockSearch).toHaveBeenCalledWith('python')
  })

  it('passes empty string when q param is absent', async () => {
    mockRequireAuth.mockResolvedValueOnce(authed)
    mockSearch.mockResolvedValueOnce([])
    const req = createMockRequest('http://localhost/api/onboarding/search')
    await GET(req)
    expect(mockSearch).toHaveBeenCalledWith('')
  })

  it('returns results in success envelope', async () => {
    mockRequireAuth.mockResolvedValueOnce(authed)
    const fakeResults = [
      { id: 'e1', name: 'Bar Exam', stakesLevel: 'high' as const, domain: 'legal', questionCount: 5 },
    ]
    mockSearch.mockResolvedValueOnce(fakeResults)
    const req = createMockRequest('http://localhost/api/onboarding/search?q=bar')
    const res = await GET(req)
    expect(res.status).toBe(200)
    const body = await res.json() as { success: boolean; data: unknown[]; error: null }
    expect(body.success).toBe(true)
    expect(body.data).toEqual(fakeResults)
    expect(body.error).toBeNull()
  })
})
