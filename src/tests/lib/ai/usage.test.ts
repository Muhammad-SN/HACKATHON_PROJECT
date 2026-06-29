import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockQuery = vi.hoisted(() => vi.fn())
vi.mock('@/lib/db/pool', () => ({
  getPool: () => ({ query: mockQuery }),
}))

import { trackUsage } from '@/lib/ai/usage'

describe('trackUsage', () => {
  beforeEach(() => { mockQuery.mockReset() })

  it('inserts a usage event row with correct parameters', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] })

    await trackUsage('user-123', 'socratic_explanation', 'claude-haiku-4-5-20251001', 150, 80)

    expect(mockQuery).toHaveBeenCalledOnce()
    const [sql, params] = mockQuery.mock.calls[0] as [string, unknown[]]
    expect(sql).toContain('INSERT INTO usage_events')
    expect(params).toEqual(['user-123', 'socratic_explanation', 'claude-haiku-4-5-20251001', 150, 80])
  })

  it('includes all 5 required columns in the INSERT statement', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] })
    await trackUsage('u', 'ev', 'model', 1, 2)
    const [sql] = mockQuery.mock.calls[0] as [string, unknown[]]
    expect(sql).toMatch(/user_id/i)
    expect(sql).toMatch(/event_type/i)
    expect(sql).toMatch(/model/i)
    expect(sql).toMatch(/input_tokens/i)
    expect(sql).toMatch(/output_tokens/i)
  })

  it('propagates database errors without swallowing them', async () => {
    mockQuery.mockRejectedValueOnce(new Error('connection refused'))
    await expect(trackUsage('u', 'ev', 'model', 1, 2)).rejects.toThrow('connection refused')
  })
})
