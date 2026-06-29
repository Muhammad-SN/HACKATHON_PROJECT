export default function AdminLoading() {
  return (
    <main style={{
      minHeight:  '100dvh',
      background: 'var(--color-bg)',
      padding:    'var(--space-8) var(--space-4)',
      fontFamily: 'var(--font-body)',
    }}>
      <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
        <div style={{
          width:        '120px',
          height:       '40px',
          background:   'var(--color-border)',
          borderRadius: 'var(--radius-md)',
          marginBottom: 'var(--space-8)',
        }} />
        <div style={{
          height:         '300px',
          background:     'var(--color-surface)',
          border:         '1px solid var(--color-border)',
          borderRadius:   'var(--radius-lg)',
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'center',
        }}>
          <div
            style={{
              width:        '32px',
              height:       '32px',
              border:       '3px solid var(--color-border)',
              borderTop:    '3px solid var(--color-primary)',
              borderRadius: '50%',
              animation:    'spin 0.8s linear infinite',
            }}
            aria-hidden="true"
          />
        </div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </main>
  )
}
