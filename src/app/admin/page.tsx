import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { getReviewQueue, getAuditLog } from '@/lib/db/admin'
import ReviewQueueTable from '@/components/admin/ReviewQueueTable'
import AuditLogTable from '@/components/admin/AuditLogTable'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Admin' }
export const dynamic = 'force-dynamic'

export default async function AdminPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')
  if ((session.user as { role?: string }).role !== 'admin') redirect('/dashboard')

  const [queue, auditLog] = await Promise.all([getReviewQueue(), getAuditLog()])

  return (
    <main style={{
      minHeight:  '100dvh',
      background: 'var(--color-bg)',
      padding:    'var(--space-8) var(--space-4)',
      fontFamily: 'var(--font-body)',
    }}>
      <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
        <h1 style={{
          fontFamily:   'var(--font-display)',
          fontSize:     'var(--text-3xl)',
          color:        'var(--color-text)',
          marginBottom: 'var(--space-8)',
        }}>
          Admin
        </h1>

        <section style={{ marginBottom: 'var(--space-10)' }}>
          <h2 style={{ fontSize: 'var(--text-xl)', fontWeight: 600, color: 'var(--color-text)', marginBottom: 'var(--space-4)' }}>
            Review Queue ({queue.length})
          </h2>
          <ReviewQueueTable queue={queue} />
        </section>

        <section>
          <h2 style={{ fontSize: 'var(--text-xl)', fontWeight: 600, color: 'var(--color-text)', marginBottom: 'var(--space-4)' }}>
            Audit Log
          </h2>
          <AuditLogTable log={auditLog} />
        </section>
      </div>
    </main>
  )
}
