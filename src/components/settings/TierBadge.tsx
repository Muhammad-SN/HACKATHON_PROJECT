'use client'

export default function TierBadge({ tier }: { tier: 'free' | 'premium' }) {
  const isPremium = tier === 'premium'
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      padding: 'var(--space-1) var(--space-3)',
      borderRadius: 'var(--radius-full)',
      fontSize: 'var(--text-xs)', fontWeight: 700,
      letterSpacing: '0.05em', textTransform: 'uppercase' as const,
      background: isPremium ? 'var(--color-accent)' : 'var(--color-surface)',
      color: isPremium ? 'var(--color-text-on-primary)' : 'var(--color-text-muted)',
      border: isPremium ? 'none' : '1px solid var(--color-border)',
    }}>
      {isPremium ? 'Premium' : 'Free'}
    </span>
  )
}
