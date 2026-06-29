// src/tests/api/billing.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/api/auth-guard', () => ({
  requireAuth: vi.fn().mockResolvedValue({
    user: { id: 'user-1', email: 'user@example.com', tier: 'free' }, error: null,
  }),
}))
vi.mock('@/lib/stripe/customer', () => ({
  getOrCreateStripeCustomer: vi.fn().mockResolvedValue('cus_test'),
}))
vi.mock('@/lib/stripe/checkout', () => ({
  createSubscriptionCheckout: vi.fn().mockResolvedValue('https://checkout.stripe.com/sub'),
  createExamPurchaseCheckout: vi.fn().mockResolvedValue('https://checkout.stripe.com/exam'),
}))
vi.mock('@/lib/stripe/portal', () => ({
  createBillingPortalSession: vi.fn().mockResolvedValue('https://billing.stripe.com/portal'),
}))
vi.mock('@/lib/db/billing', () => ({
  getUserTier: vi.fn().mockResolvedValue('free'),
}))

import { POST as checkoutPOST } from '@/app/api/billing/checkout/route'
import { POST as portalPOST }   from '@/app/api/billing/portal/route'

beforeEach(() => vi.clearAllMocks())

describe('POST /api/billing/checkout', () => {
  it('returns a Stripe checkout URL', async () => {
    const req = new Request('http://localhost', { method: 'POST', body: '{}', headers: { 'Content-Type': 'application/json' } })
    const body = (await (await checkoutPOST(req)).json()) as { data: { url: string } }
    expect(body.data.url).toContain('checkout.stripe.com')
  })

  it('returns 200 on success', async () => {
    const req = new Request('http://localhost', { method: 'POST', body: '{}', headers: { 'Content-Type': 'application/json' } })
    expect((await checkoutPOST(req)).status).toBe(200)
  })
})

describe('POST /api/billing/portal', () => {
  it('returns a Stripe billing portal URL', async () => {
    const req = new Request('http://localhost', { method: 'POST', body: '{}', headers: { 'Content-Type': 'application/json' } })
    const body = (await (await portalPOST(req)).json()) as { data: { url: string } }
    expect(body.data.url).toContain('billing.stripe.com')
  })

  it('returns 200 on success', async () => {
    const req = new Request('http://localhost', { method: 'POST', body: '{}', headers: { 'Content-Type': 'application/json' } })
    expect((await portalPOST(req)).status).toBe(200)
  })
})
