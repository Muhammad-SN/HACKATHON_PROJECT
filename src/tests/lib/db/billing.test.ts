// src/tests/lib/db/billing.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db/pool', () => ({
  getPool: vi.fn().mockReturnValue({ query: vi.fn() }),
}))

import { getPool } from '@/lib/db/pool'
import {
  getStripeCustomerId, saveStripeCustomerId,
  setUserPremium, recordExamPurchase, hasExamAccess,
} from '@/lib/db/billing'

const mockQuery = (getPool as ReturnType<typeof vi.fn>)().query as ReturnType<typeof vi.fn>
beforeEach(() => vi.clearAllMocks())

describe('getStripeCustomerId', () => {
  it('returns customer ID when found', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ stripe_customer_id: 'cus_abc' }] })
    expect(await getStripeCustomerId('user-1')).toBe('cus_abc')
  })

  it('returns null when not found', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] })
    expect(await getStripeCustomerId('user-1')).toBeNull()
  })
})

describe('setUserPremium', () => {
  it("updates tier to 'premium' for the given userId", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] })
    await setUserPremium('user-1')
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining("'premium'"), ['user-1']
    )
  })
})

describe('recordExamPurchase', () => {
  it('inserts a row into user_exam_purchases', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] })
    await recordExamPurchase('user-1', 'exam-1', 'sess_abc')
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('user_exam_purchases'), ['user-1', 'exam-1', 'sess_abc']
    )
  })
})

describe('hasExamAccess', () => {
  it('returns true when a purchase row exists', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'purchase-1' }] })
    expect(await hasExamAccess('user-1', 'exam-1')).toBe(true)
  })

  it('returns false when no purchase row exists', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] })
    expect(await hasExamAccess('user-1', 'exam-1')).toBe(false)
  })
})
