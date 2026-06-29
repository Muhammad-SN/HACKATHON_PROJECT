'use client'
import type { AuditLogRow } from '@/lib/db/admin'

export default function AuditLogTable({ log }: { log: AuditLogRow[] }) {
  if (log.length === 0) {
    return <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>No admin actions yet.</p>
  }

  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--text-sm)' }}>
      <thead>
        <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
          {['Admin', 'Action', 'Target', 'Date'].map((h) => (
            <th key={h} scope="col" style={{ textAlign: 'left', padding: 'var(--space-3) var(--space-2)', color: 'var(--color-text-muted)', fontWeight: 600 }}>
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {log.map((row) => (
          <tr key={row.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
            <td style={{ padding: 'var(--space-3) var(--space-2)', color: 'var(--color-text)' }}>{row.adminName}</td>
            <td style={{ padding: 'var(--space-3) var(--space-2)', color: 'var(--color-accent)', fontFamily: 'monospace' }}>{row.action}</td>
            <td style={{ padding: 'var(--space-3) var(--space-2)', color: 'var(--color-text-muted)' }}>{row.targetTitle}</td>
            <td style={{ padding: 'var(--space-3) var(--space-2)', color: 'var(--color-text-muted)' }}>
              {row.createdAt.toLocaleDateString()}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
