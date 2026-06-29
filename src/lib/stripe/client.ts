import Stripe from 'stripe'

let instance: Stripe | null = null

export function getStripe(): Stripe {
  if (!instance) {
    const key = process.env['STRIPE_SECRET_KEY'] ?? ''
    instance = new Stripe(key, { apiVersion: '2025-05-28.basil' })
  }
  return instance
}
