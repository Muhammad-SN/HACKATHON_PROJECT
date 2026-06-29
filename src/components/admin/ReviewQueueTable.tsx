'use client'
import { useState } from 'react'
import type { ReviewQueueRow } from '@/lib/db/admin'

export default function ReviewQueueTable({ queue }: { queue: ReviewQueueRow[] }) {
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError]     = useState<string | null>(null)

  if (queue.length === 0) {
    return <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>Review queue is empty.</p>
  }

  async function classify(examId: string, stakesLevel: 'low' | 'high') {
    setLoading(`classify-${examId}`)
    setError(null)
    const res = await fetch('/api/admin/classify', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ examId, stakesLevel }),
    })
    setLoading(null)
    if (!res.ok) { setError('Classification failed — please try again.'); return }
    window.location.reload()
  }

  async function publish(examId: string) {
    setLoading(`publish-${examId}`)
    setError(null)
    const res = await fetch('/api/admin/publish', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ examId }),
    })
    setLoading(null)
    if (!res.ok) { setError('Publish failed — please try again.'); return }
    window.location.reload()
  }

  return (
    <>
      {error && (
        <p style={{ color: 'var(--color-error)', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-3)' }}>
          {error}
        </p>
      )}
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--text-sm)' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
            {['Title', 'Owner', 'Questions', 'Submitted', 'Actions'].map((h) => (
              <th key={h} scope="col" style={{ textAlign: 'left', padding: 'var(--space-3) var(--space-2)', color: 'var(--color-text-muted)', fontWeight: 600 }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {queue.map((row) => (
            <tr key={row.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
              <td style={{ padding: 'var(--space-3) var(--space-2)', color: 'var(--color-text)', fontWeight: 600 }}>{row.title}</td>
              <td style={{ padding: 'var(--space-3) var(--space-2)', color: 'var(--color-text-muted)' }}>{row.ownerName}</td>
              <td style={{ padding: 'var(--space-3) var(--space-2)', color: 'var(--color-text-muted)' }}>{row.questionCount}</td>
              <td style={{ padding: 'var(--space-3) var(--space-2)', color: 'var(--color-text-muted)' }}>
                {row.createdAt.toLocaleDateString()}
              </td>
              <td style={{ padding: 'var(--space-3) var(--space-2)' }}>
                <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                  <button
                    type="button"
                    disabled={!!loading}
                    onClick={() => { void classify(row.id, 'low') }}
                    style={{ padding: 'var(--space-1) var(--space-3)', background: 'var(--color-mastered)', color: 'var(--color-text-on-primary)', borderRadius: 'var(--radius-md)', border: 'none', cursor: 'pointer', fontSize: 'var(--text-xs)', fontWeight: 600, opacity: loading ? 0.6 : 1 }}
                  >
                    Low
                  </button>
                  <button
                    type="button"
                    disabled={!!loading}
                    onClick={() => { void classify(row.id, 'high') }}
                    style={{ padding: 'var(--space-1) var(--space-3)', background: 'var(--color-weak)', color: 'var(--color-text-on-primary)', borderRadius: 'var(--radius-md)', border: 'none', cursor: 'pointer', fontSize: 'var(--text-xs)', fontWeight: 600, opacity: loading ? 0.6 : 1 }}
                  >
                    High
                  </button>
                  <button
                    type="button"
                    disabled={!!loading}
                    onClick={() => { void publish(row.id) }}
                    style={{ padding: 'var(--space-1) var(--space-3)', background: 'var(--color-primary)', color: 'var(--color-text-on-primary)', borderRadius: 'var(--radius-md)', border: 'none', cursor: 'pointer', fontSize: 'var(--text-xs)', fontWeight: 600, opacity: loading ? 0.6 : 1 }}
                  >
                    Publish
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  )
}
