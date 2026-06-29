'use client'

import { useEffect } from 'react'

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <main style={{
      minHeight:      '100dvh',
      display:        'flex',
      flexDirection:  'column',
      alignItems:     'center',
      justifyContent: 'center',
      gap:            'var(--space-4)',
      padding:        'var(--space-8)',
      background:     'var(--color-bg)',
      fontFamily:     'var(--font-body)',
      textAlign:      'center',
    }}>
      <span style={{ fontSize: '2.5rem' }} aria-hidden="true">🔒</span>
      <h2 style={{
        fontFamily: 'var(--font-display)',
        fontSize:   'var(--text-2xl)',
        color:      'var(--color-text)',
        margin:     0,
      }}>
        Admin panel error
      </h2>
      <p style={{
        fontSize:   'var(--text-sm)',
        color:      'var(--color-text-muted)',
        maxWidth:   '380px',
        margin:     0,
        lineHeight: 'var(--leading-normal)',
      }}>
        An error occurred in the admin panel. Check logs for details.
      </p>
      <button
        type="button"
        onClick={reset}
        style={{
          padding:      'var(--space-3) var(--space-6)',
          background:   'var(--color-primary)',
          color:        'var(--color-text-on-primary)',
          border:       'none',
          borderRadius: 'var(--radius-md)',
          fontSize:     'var(--text-sm)',
          fontWeight:   600,
          cursor:       'pointer',
          fontFamily:   'var(--font-body)',
        }}
      >
        Try again
      </button>
    </main>
  )
}
