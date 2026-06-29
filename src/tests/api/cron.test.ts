import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockClient, mockPool } = vi.hoisted(() => ({
  mockClient: {
    query:   vi.fn(),
    release: vi.fn(),
  },
  mockPool: {
    connect: vi.fn(),
  },
}))

vi.mock('@/lib/db/pool', () => ({
  getPool: () => mockPool,
}))

import { GET } from '@/app/api/cron/purge-deleted/route'

beforeEach(() => {
  vi.clearAllMocks()
  mockPool.connect.mockResolvedValue(mockClient)
  mockClient.query.mockResolvedValue({ rows: [] })
  process.env['CRON_SECRET'] = 'test-cron-secret'
})

describe('GET /api/cron/purge-deleted', () => {
  it('returns 401 when Authorization header is missing', async () => {
    const req = new Request('http://localhost/api/cron/purge-deleted')
    const res = await GET(req)
    expect(res.status).toBe(401)
  })

  it('returns 401 when Authorization token is wrong', async () => {
    const req = new Request('http://localhost/api/cron/purge-deleted', {
      headers: { Authorization: 'Bearer wrong-secret' },
    })
    const res = await GET(req)
    expect(res.status).toBe(401)
  })

  it('returns 200 with purged:0 when no users are past 30 days', async () => {
    mockClient.query.mockResolvedValueOnce({ rows: [] })
    const req = new Request('http://localhost/api/cron/purge-deleted', {
      headers: { Authorization: 'Bearer test-cron-secret' },
    })
    const res = await GET(req)
    const body = (await res.json()) as { data: { purged: number } }
    expect(res.status).toBe(200)
    expect(body.data.purged).toBe(0)
  })

  it('calls BEGIN/COMMIT for each expired user and returns correct count', async () => {
    mockClient.query
      .mockResolvedValueOnce({ rows: [{ id: 'user-1' }, { id: 'user-2' }] })
      .mockResolvedValue({ rows: [] })
    const req = new Request('http://localhost/api/cron/purge-deleted', {
      headers: { Authorization: 'Bearer test-cron-secret' },
    })
    const res = await GET(req)
    const body = (await res.json()) as { data: { purged: number } }
    expect(res.status).toBe(200)
    expect(body.data.purged).toBe(2)
    const calls = (mockClient.query.mock.calls as unknown[][]).map((c) => c[0])
    const beginCount = calls.filter((c) => c === 'BEGIN').length
    expect(beginCount).toBe(2)
    const commitCount = calls.filter((c) => c === 'COMMIT').length
    expect(commitCount).toBe(2)
  })
})
