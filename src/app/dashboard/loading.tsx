export default function DashboardLoading() {
  return (
    <div style={{
      minHeight:  '100dvh',
      background: 'var(--color-bg-dark)',
      fontFamily: 'var(--font-body)',
    }}>
      <div style={{
        height:       '64px',
        background:   'var(--color-surface-dark)',
        borderBottom: '1px solid var(--color-border-dark)',
      }} />
      <div style={{
        maxWidth:      '1200px',
        margin:        '0 auto',
        padding:       'var(--space-10) var(--space-8)',
        display:       'flex',
        flexDirection: 'column',
        gap:           'var(--space-8)',
      }}>
        <div style={{
          height:         '340px',
          background:     'var(--color-surface-dark)',
          borderRadius:   'var(--radius-xl)',
          border:         '1px solid var(--color-border-dark)',
          display:        'flex',
          flexDirection:  'column',
          alignItems:     'center',
          justifyContent: 'center',
          gap:            'var(--space-4)',
        }}>
          <div
            style={{
              width:        '40px',
              height:       '40px',
              border:       '3px solid var(--color-border-dark)',
              borderTop:    '3px solid var(--color-accent)',
              borderRadius: '50%',
              animation:    'spin 0.8s linear infinite',
            }}
            aria-hidden="true"
          />
          <p style={{
            color:      'var(--color-text-muted-dark)',
            fontFamily: 'var(--font-display)',
            fontSize:   'var(--text-lg)',
            margin:     0,
          }}>
            Setting things up…
          </p>
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-4)' }}>
          {[0, 1, 2].map((i) => (
            <div key={i} style={{
              flex:         1,
              height:       '140px',
              background:   'var(--color-surface-dark)',
              borderRadius: 'var(--radius-lg)',
              border:       '1px solid var(--color-border-dark)',
            }} />
          ))}
        </div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
