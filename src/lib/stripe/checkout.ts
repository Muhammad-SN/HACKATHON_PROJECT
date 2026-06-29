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
