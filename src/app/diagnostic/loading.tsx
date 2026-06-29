export default function DiagnosticLoading() {
  return (
    <div style={{
      minHeight:      '100dvh',
      background:     'var(--color-bg)',
      display:        'flex',
      flexDirection:  'column',
      alignItems:     'center',
      justifyContent: 'center',
      gap:            'var(--space-4)',
      fontFamily:     'var(--font-body)',
    }}>
      <div
        style={{
          width:        '40px',
          height:       '40px',
          border:       '3px solid var(--color-border)',
          borderTop:    '3px solid var(--color-accent)',
          borderRadius: '50%',
          animation:    'spin 0.8s linear infinite',
        }}
        aria-hidden="true"
      />
      <p style={{
        fontFamily: 'var(--font-display)',
        fontSize:   'var(--text-xl)',
        color:      'var(--color-text)',
        margin:     0,
      }}>
        Preparing your diagnostic…
      </p>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
