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
