import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextResponse } from 'next/server'

const { mockRequireAdmin } = vi.hoisted(() => ({
  mockRequireAdmin: vi.fn(),
}))

vi.mock('@/lib/api/auth-guard', () => ({
  requireAdmin: mockRequireAdmin,
}))
vi.mock('@/lib/db/admin', () => ({
  getReviewQueue:     vi.fn().mockResolvedValue([]),
  getAuditLog:        vi.fn().mockResolvedValue([]),
  saveClassification: vi.fn().mockResolvedValue(undefined),
  publishExam:        vi.fn().mockResolvedValue(undefined),
  logAdminAction:     vi.fn().mockResolvedValue(undefined),
}))
vi.mock('@/lib/access/classifier', () => ({
  classifyExam: vi.fn().mockResolvedValue('low'),
}))
vi.mock('@/lib/db/pool', () => ({
  getPool: vi.fn().mockReturnValue({
    query: vi.fn().mockResolvedValue({
      rows: [{ name: 'Test Exam', description: '', classification_source: 'manual' }],
    }),
  }),
}))

import { GET  as queueGET }    from '@/app/api/admin/review-queue/route'
import { POST as classifyPOST } from '@/app/api/admin/classify/route'
import { POST as publishPOST }  from '@/app/api/admin/publish/route'

beforeEach(() => vi.clearAllMocks())

describe('GET /api/admin/review-queue', () => {
  it('returns 403 when user is not admin', async () => {
    mockRequireAdmin.mockResolvedValueOnce({
      user: null,
      error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
    })
    const res = await queueGET(new Request('http://localhost'))
    expect(res.status).toBe(403)
  })

  it('returns empty queue when no pending exams', async () => {
    mockRequireAdmin.mockResolvedValueOnce({ user: { id: 'admin-1', role: 'admin' }, error: null })
    const res = await queueGET(new Request('http://localhost'))
    const body = (await res.json()) as { data: { queue: unknown[] } }
    expect(Array.isArray(body.data.queue)).toBe(true)
  })
})

describe('POST /api/admin/classify', () => {
  it('returns 403 when user is not admin', async () => {
    mockRequireAdmin.mockResolvedValueOnce({
      user: null,
      error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
    })
    const req = new Request('http://localhost', {
      method:  'POST',
      body:    JSON.stringify({ examId: '00000000-0000-0000-0000-000000000001', stakesLevel: 'low' }),
      headers: { 'Content-Type': 'application/json' },
    })
    expect((await classifyPOST(req)).status).toBe(403)
  })

  it('classifies and returns 200', async () => {
    mockRequireAdmin.mockResolvedValueOnce({ user: { id: 'admin-1' }, error: null })
    const req = new Request('http://localhost', {
      method:  'POST',
      body:    JSON.stringify({ examId: '00000000-0000-0000-0000-000000000001', stakesLevel: 'low' }),
      headers: { 'Content-Type': 'application/json' },
    })
    expect((await classifyPOST(req)).status).toBe(200)
  })
})

describe('POST /api/admin/publish', () => {
  it('returns 403 when user is not admin', async () => {
    mockRequireAdmin.mockResolvedValueOnce({
      user: null,
      error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
    })
    const req = new Request('http://localhost', {
      method:  'POST',
      body:    JSON.stringify({ examId: '00000000-0000-0000-0000-000000000001' }),
      headers: { 'Content-Type': 'application/json' },
    })
    expect((await publishPOST(req)).status).toBe(403)
  })

  it('publishes exam and returns 200', async () => {
    mockRequireAdmin.mockResolvedValueOnce({ user: { id: 'admin-1' }, error: null })
    const req = new Request('http://localhost', {
      method:  'POST',
      body:    JSON.stringify({ examId: '00000000-0000-0000-0000-000000000001' }),
      headers: { 'Content-Type': 'application/json' },
    })
    expect((await publishPOST(req)).status).toBe(200)
  })
})
