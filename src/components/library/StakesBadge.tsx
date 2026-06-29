'use client'

export default function StakesBadge({ stakes }: { stakes: 'low' | 'high' }) {
  return (
    <span
      style={{
        display:       'inline-flex',
        alignItems:    'center',
        padding:       'var(--space-1) var(--space-2)',
        borderRadius:  'var(--radius-full)',
        fontSize:      'var(--text-xs)',
        fontWeight:    700,
        letterSpacing: '0.05em',
        textTransform: 'uppercase' as const,
        background:    stakes === 'high' ? 'var(--color-weak)' : 'var(--color-mastered)',
        color:         'var(--color-text-on-primary)',
      }}
    >
      {stakes === 'high' ? 'High Stakes' : 'Free'}
    </span>
  )
}
