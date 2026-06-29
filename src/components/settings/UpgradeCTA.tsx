'use client'
import { useState } from 'react'

export default function UpgradeCTA() {
  const [loading, setLoading] = useState(false)

  async function handleUpgrade() {
    setLoading(true)
    try {
      const res  = await fetch('/api/billing/checkout', { method: 'POST' })
      const body = (await res.json()) as { data: { url: string } }
      window.location.href = body.data.url
    } catch {
      setLoading(false)
    }
  }

  return (
    <div style={{ background: 'var(--color-surface)', borderRadius: 'var(--radius-xl)', padding: 'var(--space-6)', border: '1px solid var(--color-border)', marginBottom: 'var(--space-6)' }}>
      <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-xl)', color: 'var(--color-primary)', margin: '0 0 var(--space-2) 0' }}>
        Upgrade to Premium
      </h3>
      <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', margin: '0 0 var(--space-4) 0' }}>
        Unlock high-stakes exams, Sonnet-powered explanations, and unlimited uploads for $19/mo.
      </p>
      <button onClick={() => { void handleUpgrade() }} disabled={loading}
        style={{ padding: 'var(--space-3) var(--space-6)', background: loading ? 'var(--color-border)' : 'var(--color-primary)', color: 'var(--color-text-on-primary)', borderRadius: 'var(--radius-md)', fontWeight: 700, fontSize: 'var(--text-sm)', border: 'none', cursor: loading ? 'default' : 'pointer' }}>
        {loading ? 'Redirecting…' : 'Upgrade — $19/mo'}
      </button>
    </div>
  )
}
