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
