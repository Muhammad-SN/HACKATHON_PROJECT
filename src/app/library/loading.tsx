export default function LibraryLoading() {
  return (
    <main style={{
      minHeight:  '100dvh',
      background: 'var(--color-bg)',
      padding:    'var(--space-8) var(--space-4)',
      fontFamily: 'var(--font-body)',
    }}>
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>
        <div style={{
          width:        '200px',
          height:       '40px',
          background:   'var(--color-border)',
          borderRadius: 'var(--radius-md)',
          marginBottom: 'var(--space-6)',
        }} />
        <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-4)' }}>
          {[0, 1].map((i) => (
            <div key={i} style={{
              width:        '100px',
              height:       '36px',
              background:   'var(--color-border)',
              borderRadius: 'var(--radius-md)',
            }} />
          ))}
        </div>
        <div style={{
          display:             'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap:                 'var(--space-4)',
        }}>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} style={{
              height:       '160px',
              background:   'var(--color-surface)',
              border:       '1px solid var(--color-border)',
              borderRadius: 'var(--radius-lg)',
            }} />
          ))}
        </div>
      </div>
    </main>
  )
}
