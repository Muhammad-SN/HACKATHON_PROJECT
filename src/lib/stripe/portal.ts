import { getStripe } from './client'

export async function createBillingPortalSession(customerId: string): Promise<string> {
  const appUrl = process.env['NEXT_PUBLIC_APP_URL'] ?? 'http://localhost:3000'

  const session = await getStripe().billingPortal.sessions.create({
    customer:   customerId,
    return_url: `${appUrl}/settings`,
  })

  return session.url
}
