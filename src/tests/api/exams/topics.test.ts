import { describe, it, expect, vi, beforeEach } from 'vitest'
vi.mock('@/lib/api/auth-guard', () => ({ requireAuth: vi.fn() }))
const mockQuery = vi.fn()
vi.mock('@/lib/db/pool', () => ({ getPool: vi.fn(() => ({ query: mockQuery })) }))
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api/auth-guard'
import { GET } from '@/app/api/exams/[examId]/topics/route'
const mockRequireAuth = vi.mocked(requireAuth)
const authed = { user: { id: 'u1', email: 'a@b.com', name: null, image: null, tier: 'free' as const, role: 'user' as const }, error: null }
describe('GET /api/exams/[examId]/topics', () => {
  beforeEach(() => vi.clearAllMocks())
  it('returns 401 when unauthenticated', async () => {
    mockRequireAuth.mockResolvedValueOnce({ user: null, error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) })
    const res = await GET({} as any, { params: Promise.resolve({ examId: 'e1' }) })
    expect(res.status).toBe(401)
  })
  it('returns topics in success envelope', async () => {
    mockRequireAuth.mockResolvedValueOnce(authed)
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 't1', name: 'Contracts', weight: 0.3 }] })
    const res = await GET({} as any, { params: Promise.resolve({ examId: 'exam1' }) })
    expect(res.status).toBe(200)
    const body = await res.json() as { success: boolean; data: { topics: { name: string }[] } }
    expect(body.success).toBe(true)
    expect(body.data.topics[0]!.name).toBe('Contracts')
  })
  it('returns empty topics array when exam has none', async () => {
    mockRequireAuth.mockResolvedValueOnce(authed)
    mockQuery.mockResolvedValueOnce({ rows: [] })
    const res = await GET({} as any, { params: Promise.resolve({ examId: 'exam1' }) })
    const body = await res.json() as { data: { topics: unknown[] } }
    expect(body.data.topics).toEqual([])
  })
})
