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
