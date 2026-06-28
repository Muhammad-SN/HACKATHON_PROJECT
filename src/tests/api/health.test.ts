import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db/pool', () => ({
  getPool: vi.fn(() => ({
    query: vi.fn().mockResolvedValue({ rows: [{ now: new Date().toISOString() }] }),
  })),
}))

import { GET } from '@/app/api/health/route'

describe('GET /api/health', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 200 with status ok', async () => {
    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json() as { status: string; db: string; ts: string }
    expect(body.status).toBe('ok')
    expect(body.db).toBe('ok')
    expect(typeof body.ts).toBe('string')
  })
})
