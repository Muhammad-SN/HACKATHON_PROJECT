// src/tests/api/webhooks.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mocks = vi.hoisted(() => ({
  mockConstructEvent: vi.fn(),
  mockSetPremium:     vi.fn(),
  mockSetFree:        vi.fn(),
  mockRecordPurchase: vi.fn(),
}))

vi.mock('@/lib/stripe/client', () => ({
  getStripe: vi.fn().mockReturnValue({
    webhooks: { constructEvent: mocks.mockConstructEvent },
  }),
}))
vi.mock('@/lib/db/billing', () => ({
  setUserPremium:     mocks.mockSetPremium,
  setUserFree:        mocks.mockSetFree,
  recordExamPurchase: mocks.mockRecordPurchase,
}))

import { POST } from '@/app/api/webhooks/stripe/route'

beforeEach(() => {
  vi.clearAllMocks()
  process.env['STRIPE_WEBHOOK_SECRET'] = 'whsec_test'
})

function makeReq(body: string, sig = 'valid-sig') {
  return new Request('http://localhost/api/webhooks/stripe', {
    method:  'POST',
    headers: { 'stripe-signature': sig },
    body,
  })
}

describe('POST /api/webhooks/stripe', () => {
  it('returns 400 when signature verification fails', async () => {
    mocks.mockConstructEvent.mockImplementation(() => { throw new Error('Invalid signature') })
    expect((await POST(makeReq('{}'))).status).toBe(400)
  })

  it('sets user premium on checkout.session.completed with subscription mode', async () => {
    mocks.mockConstructEvent.mockReturnValueOnce({
      type: 'checkout.session.completed',
      data: { object: { metadata: { userId: 'user-1' }, mode: 'subscription', id: 'sess_1' } },
    })
    const res = await POST(makeReq('{}'))
    expect(res.status).toBe(200)
    expect(mocks.mockSetPremium).toHaveBeenCalledWith('user-1')
  })

  it('records exam purchase on checkout.session.completed with payment mode', async () => {
    mocks.mockConstructEvent.mockReturnValueOnce({
      type: 'checkout.session.completed',
      data: { object: { metadata: { userId: 'user-1', examId: 'exam-1', type: 'exam_purchase' }, mode: 'payment', id: 'sess_2' } },
    })
    const res = await POST(makeReq('{}'))
    expect(res.status).toBe(200)
    expect(mocks.mockRecordPurchase).toHaveBeenCalledWith('user-1', 'exam-1', 'sess_2')
  })

  it('sets user free on customer.subscription.deleted', async () => {
    mocks.mockConstructEvent.mockReturnValueOnce({
      type: 'customer.subscription.deleted',
      data: { object: { metadata: { userId: 'user-1' } } },
    })
    const res = await POST(makeReq('{}'))
    expect(res.status).toBe(200)
    expect(mocks.mockSetFree).toHaveBeenCalledWith('user-1')
  })
})
