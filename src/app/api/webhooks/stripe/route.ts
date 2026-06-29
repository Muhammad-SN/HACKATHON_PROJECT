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
