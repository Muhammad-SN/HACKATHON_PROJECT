import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextResponse } from 'next/server'

vi.mock('@/lib/api/auth-guard', () => ({
  requireAuth: vi.fn().mockResolvedValue({
    user: { id: 'user-1', tier: 'free' }, error: null,
  }),
}))
vi.mock('@/lib/db/library', () => ({
  getExamForAccessCheck: vi.fn(),
}))
vi.mock('@/lib/db/billing', () => ({
  hasExamAccess: vi.fn(),
}))

import { GET } from '@/app/api/exams/[examId]/access/route'
import { getExamForAccessCheck } from '@/lib/db/library'
import { hasExamAccess } from '@/lib/db/billing'

const mockGetExam   = getExamForAccessCheck as ReturnType<typeof vi.fn>
const mockHasAccess = hasExamAccess         as ReturnType<typeof vi.fn>

beforeEach(() => vi.clearAllMocks())

describe('GET /api/exams/[examId]/access', () => {
  it('returns 404 when exam does not exist', async () => {
    mockGetExam.mockResolvedValueOnce(null)
    const req = new Request('http://localhost')
    const res = await GET(req, { params: Promise.resolve({ examId: 'exam-1' }) })
    expect(res.status).toBe(404)
  })

  it('returns granted:false for pending_review exam', async () => {
    mockGetExam.mockResolvedValueOnce({
      ownerId: 'owner-1', stakesLevel: 'low', isPublic: true,
      classificationSource: 'pending_review',
    })
    mockHasAccess.mockResolvedValueOnce(false)
    const req = new Request('http://localhost')
    const res = await GET(req, { params: Promise.resolve({ examId: 'exam-1' }) })
    const body = (await res.json()) as { data: { granted: boolean } }
    expect(body.data.granted).toBe(false)
  })

  it('returns granted:true for public low-stakes exam', async () => {
    mockGetExam.mockResolvedValueOnce({
      ownerId: 'owner-1', stakesLevel: 'low', isPublic: true,
      classificationSource: 'rules_list',
    })
    mockHasAccess.mockResolvedValueOnce(false)
    const req = new Request('http://localhost')
    const res = await GET(req, { params: Promise.resolve({ examId: 'exam-1' }) })
    const body = (await res.json()) as { data: { granted: boolean } }
    expect(body.data.granted).toBe(true)
  })
})
