'use client'
import { useState, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

export default function LibraryFilter() {
  const router              = useRouter()
  const searchParams        = useSearchParams()
  const [, startTransition] = useTransition()
  const [search, setSearch] = useState(searchParams.get('search') ?? '')
  const activeTab           = searchParams.get('tab') ?? 'community'

  function applyFilter(tab: string, s: string) {
    const params = new URLSearchParams()
    params.set('tab', tab)
    if (s) params.set('search', s)
    startTransition(() => router.push(`/library?${params.toString()}`))
  }

  return (
    <div style={{ marginBottom: 'var(--space-6)' }}>
      <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-4)' }}>
        {(['community', 'mine'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => applyFilter(tab, search)}
            style={{
              padding:      'var(--space-2) var(--space-4)',
              borderRadius: 'var(--radius-md)',
              fontSize:     'var(--text-sm)',
              fontWeight:   600,
              border:       'none',
              cursor:       'pointer',
              background:   activeTab === tab ? 'var(--color-primary)'         : 'var(--color-surface)',
              color:        activeTab === tab ? 'var(--color-text-on-primary)' : 'var(--color-text-muted)',
            }}
          >
            {tab === 'community' ? 'Community' : 'My Exams'}
          </button>
        ))}
      </div>
      {activeTab === 'community' && (
        <input
          type="search"
          placeholder="Search exams…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && applyFilter('community', search)}
          style={{
            width:        '100%',
            padding:      'var(--space-3) var(--space-4)',
            borderRadius: 'var(--radius-md)',
            border:       '1px solid var(--color-border)',
            background:   'var(--color-surface)',
            color:        'var(--color-text)',
            fontSize:     'var(--text-sm)',
            boxSizing:    'border-box' as const,
          }}
        />
      )}
    </div>
  )
}
