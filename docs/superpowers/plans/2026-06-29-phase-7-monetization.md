# Monetization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Stripe-powered subscription checkout, per-exam purchases, a Stripe webhook handler, Billing Portal, `/pricing` page, and `/settings` page with tier management.

**Architecture:** Stripe SDK wrappers live in `src/lib/stripe/`. All DB billing queries live in `src/lib/db/billing.ts`. The webhook at `/api/webhooks/stripe` is the **only** place `users.tier` is set to `'premium'` — it verifies the Stripe signature using the raw request body before touching the DB. Checkout and Portal routes are thin: auth → lazy customer creation → Stripe API → return URL. `/pricing` is a public static page. `/settings` is auth-gated and reads tier + purchase history directly from the DB layer.

**Critical constraints (from CLAUDE.md):**
- Webhook must call `stripe.webhooks.constructEvent(rawBody, sig, secret)` — read body as text, never parse JSON first
- `users.stripe_customer_id` is created lazily on first Stripe interaction, never at registration
- The webhook handler is the **only** place that sets `users.tier = 'premium'`
- High-stakes exam access is gated by `user_exam_purchases`, not by subscription tier
- All Stripe events flow through `/api/webhooks/stripe` only

**Tech Stack:** Next.js 15 App Router, Stripe SDK (`stripe`), Aurora PostgreSQL (`pg` pool), Zod, Vitest

---

## File Map

| File | Role |
|------|------|
| `src/lib/stripe/client.ts` | Stripe SDK singleton |
| `src/lib/stripe/customer.ts` | `getOrCreateStripeCustomer` — lazy customer creation |
| `src/lib/stripe/checkout.ts` | `createSubscriptionCheckout`, `createExamPurchaseCheckout` |
| `src/lib/stripe/portal.ts` | `createBillingPortalSession` |
| `src/lib/db/billing.ts` | All billing DB queries |
| `src/app/api/webhooks/stripe/route.ts` | Stripe webhook — sig verify + event dispatch |
| `src/app/api/billing/checkout/route.ts` | POST — subscription checkout session |
| `src/app/api/billing/portal/route.ts` | POST — billing portal session |
| `src/app/api/exams/[examId]/purchase/route.ts` | POST — per-exam purchase checkout |
| `src/app/pricing/page.tsx` | Public pricing comparison page |
| `src/app/settings/page.tsx` | Auth-gated settings page |
| `src/components/settings/TierBadge.tsx` | Free/premium badge component |
| `src/components/settings/UpgradeCTA.tsx` | Upgrade prompt for free users |
| `src/components/settings/PurchaseHistoryTable.tsx` | Lists per-exam purchases |
| `src/tests/lib/stripe/customer.test.ts` | 3 unit tests for lazy customer creation |
| `src/tests/lib/db/billing.test.ts` | 5 unit tests for billing DB functions |
| `src/tests/api/webhooks.test.ts` | 4 unit tests for webhook handler |
| `src/tests/api/billing.test.ts` | 4 unit tests for checkout + portal routes |

---

### Task 1: Stripe SDK Wrappers

**Files:**
- Create: `src/lib/stripe/client.ts`
- Create: `src/lib/stripe/customer.ts`
- Create: `src/lib/stripe/checkout.ts`
- Create: `src/lib/stripe/portal.ts`
- Test: `src/tests/lib/stripe/customer.test.ts`

**Required env vars:** `STRIPE_SECRET_KEY`, `STRIPE_PREMIUM_PRICE_ID`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_APP_URL`

- [ ] **Step 1: Write the failing tests**

```typescript
// src/tests/lib/stripe/customer.test.ts
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
```

- [ ] **Step 2: Run test to verify it fails**

```powershell
pnpm test src/tests/lib/stripe/customer.test.ts 2>&1 | Select-String "Tests:|passed|failed|error"
```

Expected: FAIL — "Cannot find module '@/lib/stripe/customer'"

- [ ] **Step 3: Implement `src/lib/stripe/client.ts`**

```typescript
import Stripe from 'stripe'

let instance: Stripe | null = null

export function getStripe(): Stripe {
  if (!instance) {
    const key = process.env['STRIPE_SECRET_KEY']
    if (!key) throw new Error('STRIPE_SECRET_KEY is not set')
    instance = new Stripe(key, { apiVersion: '2025-05-28.basil' })
  }
  return instance
}
```

- [ ] **Step 4: Implement `src/lib/stripe/customer.ts`**

```typescript
import { getStripe } from './client'
import { getStripeCustomerId, saveStripeCustomerId } from '@/lib/db/billing'

export async function getOrCreateStripeCustomer(userId: string, email: string): Promise<string> {
  const existing = await getStripeCustomerId(userId)
  if (existing) return existing

  const customer = await getStripe().customers.create({ email, metadata: { userId } })
  await saveStripeCustomerId(userId, customer.id)
  return customer.id
}
```

- [ ] **Step 5: Implement `src/lib/stripe/checkout.ts`**

```typescript
import { getStripe } from './client'

export async function createSubscriptionCheckout(
  customerId: string,
  userId: string
): Promise<string> {
  const appUrl  = process.env['NEXT_PUBLIC_APP_URL'] ?? 'http://localhost:3000'
  const priceId = process.env['STRIPE_PREMIUM_PRICE_ID']
  if (!priceId) throw new Error('STRIPE_PREMIUM_PRICE_ID is not set')

  const session = await getStripe().checkout.sessions.create({
    customer:    customerId,
    mode:        'subscription',
    line_items:  [{ price: priceId, quantity: 1 }],
    success_url: `${appUrl}/settings?upgraded=1`,
    cancel_url:  `${appUrl}/pricing`,
    metadata:    { userId },
  })

  if (!session.url) throw new Error('Stripe did not return a checkout URL')
  return session.url
}

export async function createExamPurchaseCheckout(
  customerId: string,
  userId: string,
  examId: string,
  examTitle: string,
  priceUsd: number
): Promise<string> {
  const appUrl = process.env['NEXT_PUBLIC_APP_URL'] ?? 'http://localhost:3000'

  const session = await getStripe().checkout.sessions.create({
    customer: customerId,
    mode:     'payment',
    line_items: [{
      quantity:   1,
      price_data: {
        currency:     'usd',
        unit_amount:  Math.round(priceUsd * 100),
        product_data: { name: examTitle },
      },
    }],
    success_url: `${appUrl}/library?purchased=1`,
    cancel_url:  `${appUrl}/library`,
    metadata:    { userId, examId, type: 'exam_purchase' },
  })

  if (!session.url) throw new Error('Stripe did not return a checkout URL')
  return session.url
}
```

- [ ] **Step 6: Implement `src/lib/stripe/portal.ts`**

```typescript
import { getStripe } from './client'

export async function createBillingPortalSession(customerId: string): Promise<string> {
  const appUrl = process.env['NEXT_PUBLIC_APP_URL'] ?? 'http://localhost:3000'

  const session = await getStripe().billingPortal.sessions.create({
    customer:   customerId,
    return_url: `${appUrl}/settings`,
  })

  return session.url
}
```

- [ ] **Step 7: Run tests to verify they pass**

```powershell
pnpm test src/tests/lib/stripe/customer.test.ts 2>&1 | Select-String "Tests:|passed|failed"
```

Expected: 3 passed

- [ ] **Step 8: Commit**

```powershell
git add src/lib/stripe/ src/tests/lib/stripe/
git commit -m "feat: add Stripe SDK wrappers for customer, checkout, and billing portal"
```

---

### Task 2: Billing DB Functions

**Files:**
- Create: `src/lib/db/billing.ts`
- Test: `src/tests/lib/db/billing.test.ts`

DB tables: `users` (columns: `stripe_customer_id`, `tier`), `user_exam_purchases` (columns: `user_id`, `exam_id`, `stripe_session_id`, `created_at`)

- [ ] **Step 1: Write the failing tests**

```typescript
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
```

- [ ] **Step 2: Run test to verify it fails**

```powershell
pnpm test src/tests/lib/db/billing.test.ts 2>&1 | Select-String "Tests:|passed|failed|error"
```

Expected: FAIL — "Cannot find module '@/lib/db/billing'"

- [ ] **Step 3: Implement `src/lib/db/billing.ts`**

```typescript
import { getPool } from '@/lib/db/pool'

export async function getStripeCustomerId(userId: string): Promise<string | null> {
  const { rows } = await getPool().query(
    `SELECT stripe_customer_id FROM users WHERE id = $1 AND stripe_customer_id IS NOT NULL`,
    [userId]
  )
  return rows.length > 0 ? (rows[0] as { stripe_customer_id: string }).stripe_customer_id : null
}

export async function saveStripeCustomerId(userId: string, customerId: string): Promise<void> {
  await getPool().query(
    `UPDATE users SET stripe_customer_id = $2 WHERE id = $1`,
    [userId, customerId]
  )
}

export async function setUserPremium(userId: string): Promise<void> {
  await getPool().query(
    `UPDATE users SET tier = 'premium' WHERE id = $1`,
    [userId]
  )
}

export async function setUserFree(userId: string): Promise<void> {
  await getPool().query(
    `UPDATE users SET tier = 'free' WHERE id = $1`,
    [userId]
  )
}

export async function recordExamPurchase(
  userId: string, examId: string, stripeSessionId: string
): Promise<void> {
  await getPool().query(
    `INSERT INTO user_exam_purchases (user_id, exam_id, stripe_session_id)
     VALUES ($1, $2, $3)
     ON CONFLICT (user_id, exam_id) DO NOTHING`,
    [userId, examId, stripeSessionId]
  )
}

export async function hasExamAccess(userId: string, examId: string): Promise<boolean> {
  const { rows } = await getPool().query(
    `SELECT id FROM user_exam_purchases WHERE user_id = $1 AND exam_id = $2`,
    [userId, examId]
  )
  return rows.length > 0
}

export interface PurchaseRow {
  examId: string
  examTitle: string
  purchasedAt: Date
  stripeSessionId: string
}

export async function getPurchaseHistory(userId: string): Promise<PurchaseRow[]> {
  const { rows } = await getPool().query(
    `SELECT p.exam_id, e.title AS exam_title, p.created_at AS purchased_at, p.stripe_session_id
     FROM user_exam_purchases p
     JOIN exams e ON e.id = p.exam_id
     WHERE p.user_id = $1
     ORDER BY p.created_at DESC`,
    [userId]
  )
  return rows.map((r) => ({
    examId:          r.exam_id           as string,
    examTitle:       r.exam_title        as string,
    purchasedAt:     new Date(r.purchased_at as string),
    stripeSessionId: r.stripe_session_id as string,
  }))
}

export async function getUserTier(userId: string): Promise<'free' | 'premium'> {
  const { rows } = await getPool().query(
    `SELECT tier FROM users WHERE id = $1`,
    [userId]
  )
  return rows.length > 0 ? (rows[0] as { tier: 'free' | 'premium' }).tier : 'free'
}
```

- [ ] **Step 4: Run tests to verify they pass**

```powershell
pnpm test src/tests/lib/db/billing.test.ts 2>&1 | Select-String "Tests:|passed|failed"
```

Expected: 5 passed

- [ ] **Step 5: Commit**

```powershell
git add src/lib/db/billing.ts src/tests/lib/db/billing.test.ts
git commit -m "feat: add billing DB functions for Stripe customer, tier, and exam purchase"
```

---

### Task 3: Stripe Webhook Handler

**Files:**
- Create: `src/app/api/webhooks/stripe/route.ts`
- Test: `src/tests/api/webhooks.test.ts`

This is the **only** place `users.tier` is set to `'premium'`. Raw body must be read with `req.text()` before any JSON parsing. Signature verified with `stripe.webhooks.constructEvent`.

- [ ] **Step 1: Write the failing tests**

```typescript
// src/tests/api/webhooks.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockConstructEvent = vi.fn()
const mockSetPremium     = vi.fn()
const mockSetFree        = vi.fn()
const mockRecordPurchase = vi.fn()

vi.mock('@/lib/stripe/client', () => ({
  getStripe: vi.fn().mockReturnValue({
    webhooks: { constructEvent: mockConstructEvent },
  }),
}))
vi.mock('@/lib/db/billing', () => ({
  setUserPremium:     mockSetPremium,
  setUserFree:        mockSetFree,
  recordExamPurchase: mockRecordPurchase,
}))

import { POST } from '@/app/api/webhooks/stripe/route'

beforeEach(() => vi.clearAllMocks())

function makeReq(body: string, sig = 'valid-sig') {
  return new Request('http://localhost/api/webhooks/stripe', {
    method:  'POST',
    headers: { 'stripe-signature': sig },
    body,
  })
}

describe('POST /api/webhooks/stripe', () => {
  it('returns 400 when signature verification fails', async () => {
    mockConstructEvent.mockImplementation(() => { throw new Error('Invalid signature') })
    expect((await POST(makeReq('{}'))).status).toBe(400)
  })

  it('sets user premium on checkout.session.completed with subscription mode', async () => {
    mockConstructEvent.mockReturnValueOnce({
      type: 'checkout.session.completed',
      data: { object: { metadata: { userId: 'user-1' }, mode: 'subscription', id: 'sess_1' } },
    })
    const res = await POST(makeReq('{}'))
    expect(res.status).toBe(200)
    expect(mockSetPremium).toHaveBeenCalledWith('user-1')
  })

  it('records exam purchase on checkout.session.completed with payment mode', async () => {
    mockConstructEvent.mockReturnValueOnce({
      type: 'checkout.session.completed',
      data: { object: { metadata: { userId: 'user-1', examId: 'exam-1', type: 'exam_purchase' }, mode: 'payment', id: 'sess_2' } },
    })
    const res = await POST(makeReq('{}'))
    expect(res.status).toBe(200)
    expect(mockRecordPurchase).toHaveBeenCalledWith('user-1', 'exam-1', 'sess_2')
  })

  it('sets user free on customer.subscription.deleted', async () => {
    mockConstructEvent.mockReturnValueOnce({
      type: 'customer.subscription.deleted',
      data: { object: { metadata: { userId: 'user-1' } } },
    })
    const res = await POST(makeReq('{}'))
    expect(res.status).toBe(200)
    expect(mockSetFree).toHaveBeenCalledWith('user-1')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```powershell
pnpm test src/tests/api/webhooks.test.ts 2>&1 | Select-String "Tests:|passed|failed|error"
```

Expected: FAIL — module not found

- [ ] **Step 3: Implement `src/app/api/webhooks/stripe/route.ts`**

```typescript
import { NextResponse } from 'next/server'
import { getStripe } from '@/lib/stripe/client'
import { setUserPremium, setUserFree, recordExamPurchase } from '@/lib/db/billing'
import type Stripe from 'stripe'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const sig    = req.headers.get('stripe-signature')
  const secret = process.env['STRIPE_WEBHOOK_SECRET']

  if (!sig || !secret) {
    return NextResponse.json({ error: 'Missing signature or secret' }, { status: 400 })
  }

  const rawBody = await req.text()

  let event: Stripe.Event
  try {
    event = getStripe().webhooks.constructEvent(rawBody, sig, secret)
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Invalid signature' },
      { status: 400 }
    )
  }

  try {
    await handleEvent(event)
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Handler error' },
      { status: 500 }
    )
  }

  return NextResponse.json({ received: true })
}

async function handleEvent(event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session
      const userId  = session.metadata?.['userId']
      if (!userId) return

      if (session.mode === 'subscription') {
        await setUserPremium(userId)
      } else if (session.mode === 'payment' && session.metadata?.['type'] === 'exam_purchase') {
        const examId = session.metadata['examId']
        if (examId) await recordExamPurchase(userId, examId, session.id)
      }
      break
    }

    case 'customer.subscription.deleted': {
      const sub    = event.data.object as Stripe.Subscription
      const userId = sub.metadata?.['userId']
      if (userId) await setUserFree(userId)
      break
    }

    default:
      break
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```powershell
pnpm test src/tests/api/webhooks.test.ts 2>&1 | Select-String "Tests:|passed|failed"
pnpm type-check
```

Expected: 4 passed, type-check clean

- [ ] **Step 5: Commit**

```powershell
git add src/app/api/webhooks/ src/tests/api/webhooks.test.ts
git commit -m "feat: add Stripe webhook handler with signature verification and event dispatch"
```

---

### Task 4: Billing API Routes

**Files:**
- Create: `src/app/api/billing/checkout/route.ts`
- Create: `src/app/api/billing/portal/route.ts`
- Create: `src/app/api/exams/[examId]/purchase/route.ts`
- Test: `src/tests/api/billing.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
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
```

- [ ] **Step 2: Run test to verify it fails**

```powershell
pnpm test src/tests/api/billing.test.ts 2>&1 | Select-String "Tests:|passed|failed|error"
```

Expected: FAIL

- [ ] **Step 3: Implement `src/app/api/billing/checkout/route.ts`**

```typescript
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api/auth-guard'
import { getOrCreateStripeCustomer } from '@/lib/stripe/customer'
import { createSubscriptionCheckout } from '@/lib/stripe/checkout'

export async function POST(req: Request) {
  const { user, error } = await requireAuth()
  if (error) return error

  await req.json().catch(() => ({}))

  const customerId = await getOrCreateStripeCustomer(user!.id, user!.email ?? '')
  const url        = await createSubscriptionCheckout(customerId, user!.id)

  return NextResponse.json({ success: true, data: { url }, error: null })
}
```

- [ ] **Step 4: Implement `src/app/api/billing/portal/route.ts`**

```typescript
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api/auth-guard'
import { getOrCreateStripeCustomer } from '@/lib/stripe/customer'
import { createBillingPortalSession } from '@/lib/stripe/portal'

export async function POST(req: Request) {
  const { user, error } = await requireAuth()
  if (error) return error

  await req.json().catch(() => ({}))

  const customerId = await getOrCreateStripeCustomer(user!.id, user!.email ?? '')
  const url        = await createBillingPortalSession(customerId)

  return NextResponse.json({ success: true, data: { url }, error: null })
}
```

- [ ] **Step 5: Implement `src/app/api/exams/[examId]/purchase/route.ts`**

```typescript
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api/auth-guard'
import { getOrCreateStripeCustomer } from '@/lib/stripe/customer'
import { createExamPurchaseCheckout } from '@/lib/stripe/checkout'
import { getPool } from '@/lib/db/pool'

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ examId: string }> }
) {
  const { user, error } = await requireAuth()
  if (error) return error

  const { examId } = await params
  if (!examId) return NextResponse.json({ error: 'Missing examId' }, { status: 422 })

  const { rows } = await getPool().query(
    `SELECT title, purchase_price FROM exams WHERE id = $1 AND stakes_level = 'high'`,
    [examId]
  )
  if (rows.length === 0) {
    return NextResponse.json({ error: 'Exam not found or not purchasable' }, { status: 404 })
  }

  const exam       = rows[0] as { title: string; purchase_price: string }
  const customerId = await getOrCreateStripeCustomer(user!.id, user!.email ?? '')
  const url        = await createExamPurchaseCheckout(
    customerId, user!.id, examId, exam.title, parseFloat(exam.purchase_price)
  )

  return NextResponse.json({ success: true, data: { url }, error: null })
}
```

- [ ] **Step 6: Run tests to verify they pass**

```powershell
pnpm test src/tests/api/billing.test.ts 2>&1 | Select-String "Tests:|passed|failed"
pnpm type-check
```

Expected: 4 passed, type-check clean

- [ ] **Step 7: Commit**

```powershell
git add src/app/api/billing/ src/app/api/exams/[examId]/purchase/ src/tests/api/billing.test.ts
git commit -m "feat: add billing checkout, portal, and exam purchase API routes"
```

---

### Task 5: Pricing Page

**Files:**
- Create: `src/app/pricing/page.tsx`

Public page — no auth required. Shows Free vs Premium comparison with a CTA that posts to `/api/billing/checkout`.

- [ ] **Step 1: Implement `src/app/pricing/page.tsx`**

```tsx
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Pricing — CogniPrep' }

const FREE_FEATURES = [
  'Unlimited low-stakes exams',
  'Adaptive study sessions',
  'BKT mastery tracking',
  'Socratic AI explanations (Haiku)',
  'Community exam library',
  'Upload up to 3 documents',
]

const PREMIUM_FEATURES = [
  'Everything in Free',
  'High-stakes exam access',
  'Socratic AI explanations (Sonnet)',
  'Unlimited document uploads',
  'Priority question generation',
  'Early access to new features',
]

export default function PricingPage() {
  return (
    <main style={{ minHeight: '100dvh', background: 'var(--color-bg)', padding: 'var(--space-16) var(--space-4)', fontFamily: 'var(--font-body)' }}>
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 'var(--space-12)' }}>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-hero)', color: 'var(--color-primary)', marginBottom: 'var(--space-4)' }}>
            Simple pricing
          </h1>
          <p style={{ fontSize: 'var(--text-lg)', color: 'var(--color-text-muted)' }}>
            Start free. Upgrade when you need serious exam prep.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-6)' }}>
          {/* Free */}
          <div style={{ background: 'var(--color-surface)', borderRadius: 'var(--radius-xl)', padding: 'var(--space-8)', border: '1px solid var(--color-border)' }}>
            <p style={{ fontWeight: 700, fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 'var(--space-2)' }}>Free</p>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-3xl)', color: 'var(--color-text)', marginBottom: 'var(--space-6)' }}>$0</div>
            <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 var(--space-8) 0' }}>
              {FREE_FEATURES.map((f) => (
                <li key={f} style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-3)', fontSize: 'var(--text-sm)', color: 'var(--color-text)' }}>
                  <span style={{ color: 'var(--color-mastered)', fontWeight: 700 }}>✓</span> {f}
                </li>
              ))}
            </ul>
            <a href="/register" style={{ display: 'block', textAlign: 'center', padding: 'var(--space-3) var(--space-6)', background: 'var(--color-surface)', color: 'var(--color-primary)', borderRadius: 'var(--radius-md)', fontWeight: 700, fontSize: 'var(--text-sm)', border: '2px solid var(--color-primary)', textDecoration: 'none' }}>
              Get started free
            </a>
          </div>

          {/* Premium */}
          <div style={{ background: 'var(--color-primary)', borderRadius: 'var(--radius-xl)', padding: 'var(--space-8)', position: 'relative' }}>
            <span style={{ position: 'absolute', top: 'var(--space-4)', right: 'var(--space-4)', background: 'var(--color-accent)', color: 'var(--color-text-on-primary)', fontSize: 'var(--text-xs)', fontWeight: 700, padding: 'var(--space-1) var(--space-3)', borderRadius: 'var(--radius-full)' }}>
              Most popular
            </span>
            <p style={{ fontWeight: 700, fontSize: 'var(--text-sm)', color: 'rgba(255,255,255,0.7)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 'var(--space-2)' }}>Premium</p>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-3xl)', color: 'var(--color-text-on-primary)', marginBottom: 'var(--space-6)' }}>
              $19<span style={{ fontSize: 'var(--text-base)', opacity: 0.8 }}>/mo</span>
            </div>
            <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 var(--space-8) 0' }}>
              {PREMIUM_FEATURES.map((f) => (
                <li key={f} style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-3)', fontSize: 'var(--text-sm)', color: 'var(--color-text-on-primary)' }}>
                  <span style={{ fontWeight: 700 }}>✓</span> {f}
                </li>
              ))}
            </ul>
            <form action="/api/billing/checkout" method="POST">
              <button type="submit" style={{ display: 'block', width: '100%', textAlign: 'center', padding: 'var(--space-3) var(--space-6)', background: 'var(--color-text-on-primary)', color: 'var(--color-primary)', borderRadius: 'var(--radius-md)', fontWeight: 700, fontSize: 'var(--text-sm)', border: 'none', cursor: 'pointer' }}>
                Upgrade to Premium
              </button>
            </form>
          </div>
        </div>
      </div>
    </main>
  )
}
```

- [ ] **Step 2: Type-check**

```powershell
pnpm type-check
```

Expected: no errors

- [ ] **Step 3: Commit**

```powershell
git add src/app/pricing/
git commit -m "feat: add pricing page with Free vs Premium comparison"
```

---

### Task 6: Settings Page

**Files:**
- Create: `src/components/settings/TierBadge.tsx`
- Create: `src/components/settings/UpgradeCTA.tsx`
- Create: `src/components/settings/PurchaseHistoryTable.tsx`
- Create: `src/app/settings/page.tsx`

Auth-gated. Shows tier badge, upgrade CTA (free users), Stripe portal link (premium users), and exam purchase history.

- [ ] **Step 1: Implement `src/components/settings/TierBadge.tsx`**

```tsx
'use client'

export default function TierBadge({ tier }: { tier: 'free' | 'premium' }) {
  const isPremium = tier === 'premium'
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      padding: 'var(--space-1) var(--space-3)',
      borderRadius: 'var(--radius-full)',
      fontSize: 'var(--text-xs)', fontWeight: 700,
      letterSpacing: '0.05em', textTransform: 'uppercase' as const,
      background: isPremium ? 'var(--color-accent)' : 'var(--color-surface)',
      color: isPremium ? 'var(--color-text-on-primary)' : 'var(--color-text-muted)',
      border: isPremium ? 'none' : '1px solid var(--color-border)',
    }}>
      {isPremium ? 'Premium' : 'Free'}
    </span>
  )
}
```

- [ ] **Step 2: Implement `src/components/settings/UpgradeCTA.tsx`**

```tsx
'use client'
import { useState } from 'react'

export default function UpgradeCTA() {
  const [loading, setLoading] = useState(false)

  async function handleUpgrade() {
    setLoading(true)
    try {
      const res  = await fetch('/api/billing/checkout', { method: 'POST' })
      const body = (await res.json()) as { data: { url: string } }
      window.location.href = body.data.url
    } catch {
      setLoading(false)
    }
  }

  return (
    <div style={{ background: 'var(--color-surface)', borderRadius: 'var(--radius-xl)', padding: 'var(--space-6)', border: '1px solid var(--color-border)', marginBottom: 'var(--space-6)' }}>
      <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-xl)', color: 'var(--color-primary)', margin: '0 0 var(--space-2) 0' }}>
        Upgrade to Premium
      </h3>
      <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', margin: '0 0 var(--space-4) 0' }}>
        Unlock high-stakes exams, Sonnet-powered explanations, and unlimited uploads for $19/mo.
      </p>
      <button onClick={() => { void handleUpgrade() }} disabled={loading}
        style={{ padding: 'var(--space-3) var(--space-6)', background: loading ? 'var(--color-border)' : 'var(--color-primary)', color: 'var(--color-text-on-primary)', borderRadius: 'var(--radius-md)', fontWeight: 700, fontSize: 'var(--text-sm)', border: 'none', cursor: loading ? 'default' : 'pointer' }}>
        {loading ? 'Redirecting…' : 'Upgrade — $19/mo'}
      </button>
    </div>
  )
}
```

- [ ] **Step 3: Implement `src/components/settings/PurchaseHistoryTable.tsx`**

```tsx
'use client'
import type { PurchaseRow } from '@/lib/db/billing'

export default function PurchaseHistoryTable({ purchases }: { purchases: PurchaseRow[] }) {
  if (purchases.length === 0) {
    return <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>No exam purchases yet.</p>
  }
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--text-sm)' }}>
      <thead>
        <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
          <th style={{ textAlign: 'left', padding: 'var(--space-3) 0', color: 'var(--color-text-muted)', fontWeight: 600 }}>Exam</th>
          <th style={{ textAlign: 'right', padding: 'var(--space-3) 0', color: 'var(--color-text-muted)', fontWeight: 600 }}>Purchased</th>
        </tr>
      </thead>
      <tbody>
        {purchases.map((p) => (
          <tr key={p.stripeSessionId} style={{ borderBottom: '1px solid var(--color-border)' }}>
            <td style={{ padding: 'var(--space-3) 0', color: 'var(--color-text)' }}>{p.examTitle}</td>
            <td style={{ padding: 'var(--space-3) 0', color: 'var(--color-text-muted)', textAlign: 'right' }}>
              {p.purchasedAt.toLocaleDateString()}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
```

- [ ] **Step 4: Implement `src/app/settings/page.tsx`**

```tsx
import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { getUserTier, getPurchaseHistory } from '@/lib/db/billing'
import TierBadge from '@/components/settings/TierBadge'
import UpgradeCTA from '@/components/settings/UpgradeCTA'
import PurchaseHistoryTable from '@/components/settings/PurchaseHistoryTable'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Settings' }

export default async function SettingsPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const [tier, purchases] = await Promise.all([
    getUserTier(session.user.id),
    getPurchaseHistory(session.user.id),
  ])

  return (
    <main style={{ minHeight: '100dvh', background: 'var(--color-bg)', padding: 'var(--space-8) var(--space-4)', fontFamily: 'var(--font-body)' }}>
      <div style={{ maxWidth: '640px', margin: '0 auto' }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-3xl)', color: 'var(--color-text)', marginBottom: 'var(--space-8)' }}>
          Settings
        </h1>

        <section style={{ marginBottom: 'var(--space-8)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)', marginBottom: 'var(--space-2)' }}>
            <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 600, color: 'var(--color-text)', margin: 0 }}>Account</h2>
            <TierBadge tier={tier} />
          </div>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', margin: 0 }}>{session.user.email}</p>
        </section>

        {tier === 'free' && <UpgradeCTA />}

        {tier === 'premium' && (
          <section style={{ marginBottom: 'var(--space-8)' }}>
            <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 600, color: 'var(--color-text)', marginBottom: 'var(--space-4)' }}>Subscription</h2>
            <form action="/api/billing/portal" method="POST">
              <button type="submit" style={{ padding: 'var(--space-3) var(--space-6)', background: 'var(--color-surface)', color: 'var(--color-primary)', borderRadius: 'var(--radius-md)', fontWeight: 700, fontSize: 'var(--text-sm)', border: '1px solid var(--color-border)', cursor: 'pointer' }}>
                Manage subscription →
              </button>
            </form>
          </section>
        )}

        <section>
          <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 600, color: 'var(--color-text)', marginBottom: 'var(--space-4)' }}>Exam Purchases</h2>
          <PurchaseHistoryTable purchases={purchases} />
        </section>
      </div>
    </main>
  )
}
```

- [ ] **Step 5: Type-check**

```powershell
pnpm type-check
```

Expected: no errors

- [ ] **Step 6: Commit and push**

```powershell
git add src/app/settings/ src/components/settings/
git commit -m "feat: add settings page with tier badge, upgrade CTA, and purchase history"
git push origin master
```

---

## Self-Review

**Spec coverage:** ✅ Stripe subscription checkout, webhook with raw-body sig verification, Billing Portal, per-exam purchase, lazy customer creation, `/pricing` page, `/settings` page with tier + upgrade CTA + portal link + purchase history.

**Security audit:**
- Webhook reads `req.text()` BEFORE any JSON parsing — raw body preserved for `constructEvent`
- `stripe.webhooks.constructEvent` called on every inbound POST — no unverified events acted on
- `users.tier` only set inside the webhook handler — never in checkout or portal routes
- `stripe_customer_id` created lazily — never at registration

**Type consistency:** `PurchaseRow` exported from `billing.ts`, imported by `PurchaseHistoryTable.tsx`. `getOrCreateStripeCustomer` returns `Promise<string>` — matches all callers. `createSubscriptionCheckout(customerId, userId)` signature matches its call in the checkout route.
