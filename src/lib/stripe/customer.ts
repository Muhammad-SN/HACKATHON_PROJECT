import { getStripe } from './client'
import { getStripeCustomerId, saveStripeCustomerId } from '@/lib/db/billing'

export async function getOrCreateStripeCustomer(userId: string, email: string): Promise<string> {
  const existing = await getStripeCustomerId(userId)
  if (existing) return existing

  const customer = await getStripe().customers.create({ email, metadata: { userId } })
  await saveStripeCustomerId(userId, customer.id)
  return customer.id
}
