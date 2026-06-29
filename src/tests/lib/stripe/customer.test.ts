import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockCreate = vi.fn()

vi.mock('stripe', () => ({
  default: vi.fn().mockImplementation(() => ({
    customers: { create: mockCreate },
  })),
}))

vi.mock('@/lib/db/billing', () => ({
  getStripeCustomerId:  vi.fn(),
  saveStripeCustomerId: vi.fn(),
}))

import { getOrCreateStripeCustomer } from '@/lib/stripe/customer'
import { getStripeCustomerId, saveStripeCustomerId } from '@/lib/db/billing'

const mockGet  = getStripeCustomerId  as ReturnType<typeof vi.fn>
const mockSave = saveStripeCustomerId as ReturnType<typeof vi.fn>

beforeEach(() => vi.clearAllMocks())

describe('getOrCreateStripeCustomer', () => {
  it('returns existing customer ID without calling Stripe create', async () => {
    mockGet.mockResolvedValueOnce('cus_existing')
    const id = await getOrCreateStripeCustomer('user-1', 'user@example.com')
    expect(id).toBe('cus_existing')
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it('creates a new customer and saves ID when none exists', async () => {
    mockGet.mockResolvedValueOnce(null)
    mockCreate.mockResolvedValueOnce({ id: 'cus_new' })
    mockSave.mockResolvedValueOnce(undefined)
    const id = await getOrCreateStripeCustomer('user-1', 'user@example.com')
    expect(id).toBe('cus_new')
    expect(mockSave).toHaveBeenCalledWith('user-1', 'cus_new')
  })

  it('passes email to Stripe when creating', async () => {
    mockGet.mockResolvedValueOnce(null)
    mockCreate.mockResolvedValueOnce({ id: 'cus_new' })
    mockSave.mockResolvedValueOnce(undefined)
    await getOrCreateStripeCustomer('user-1', 'test@example.com')
    expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({ email: 'test@example.com' }))
  })
})
