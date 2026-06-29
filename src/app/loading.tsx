export default function RootLoading() {
  return (
    <div style={{
      minHeight:      '100dvh',
      display:        'flex',
      flexDirection:  'column',
      alignItems:     'center',
      justifyContent: 'center',
      gap:            'var(--space-4)',
      background:     'var(--color-bg)',
      fontFamily:     'var(--font-body)',
    }}>
      <div
        style={{
          width:        '40px',
          height:       '40px',
          border:       '3px solid var(--color-border)',
          borderTop:    '3px solid var(--color-primary)',
          borderRadius: '50%',
          animation:    'spin 0.8s linear infinite',
        }}
        aria-hidden="true"
      />
      <p style={{
        fontFamily: 'var(--font-display)',
        fontSize:   'var(--text-lg)',
        color:      'var(--color-text)',
        margin:     0,
      }}>
        Setting things up…
      </p>
      <p style={{
        fontSize: 'var(--text-sm)',
        color:    'var(--color-text-muted)',
        margin:   0,
      }}>
        This only takes a moment.
      </p>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
