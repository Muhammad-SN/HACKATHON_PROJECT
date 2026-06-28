'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import type { AccountTier } from '@/types'

interface ExamResult {
  id: string
  name: string
  stakesLevel: 'low' | 'high'
  domain: string
  questionCount: number
}

function StakesBadge({ level }: { level: 'low' | 'high' }) {
  return (
    <span
      style={{
        padding: '2px 8px',
        borderRadius: 'var(--radius-sm)',
        fontSize: 'var(--text-xs)',
        fontWeight: 600,
        background: level === 'low' ? 'var(--color-mastered)' : 'var(--color-accent)',
        color: 'var(--color-text-on-primary)',
        whiteSpace: 'nowrap' as const,
      }}
    >
      {level === 'low' ? 'Free' : 'Paid Access'}
    </span>
  )
}

export default function OnboardingSearch({ tier }: { tier: AccountTier }) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<ExamResult[]>([])
  const [loading, setLoading] = useState(false)
  const [enrolling, setEnrolling] = useState<string | null>(null)
  const [hasSearched, setHasSearched] = useState(false)

  const search = useCallback(async (q: string) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/onboarding/search?q=${encodeURIComponent(q)}`)
      if (res.ok) {
        const body = (await res.json()) as { data: ExamResult[] }
        setResults(body.data ?? [])
      }
    } finally {
      setLoading(false)
      setHasSearched(true)
    }
  }, [])

  // Load top exams on mount
  useEffect(() => { void search('') }, [search])

  // Debounce typed queries (300ms)
  useEffect(() => {
    const t = setTimeout(() => { void search(query) }, 300)
    return () => clearTimeout(t)
  }, [query, search])

  async function handleEnroll(examId: string) {
    setEnrolling(examId)
    try {
      const res = await fetch('/api/onboarding/enroll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ examId }),
      })
      if (res.ok) {
        const body = (await res.json()) as { data: { redirectUrl: string } }
        router.push(body.data.redirectUrl)
      }
    } finally {
      setEnrolling(null)
    }
  }

  const noResults = hasSearched && !loading && results.length === 0

  return (
    <div>
      <input
        type="search"
        placeholder="e.g. Bar Exam, USMLE Step 1, AWS Solutions Architect..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        autoFocus
        style={{
          width: '100%',
          padding: 'var(--space-4)',
          fontSize: 'var(--text-lg)',
          border: '2px solid var(--color-border)',
          borderRadius: 'var(--radius-lg)',
          background: 'var(--color-surface)',
          color: 'var(--color-text)',
          marginBottom: 'var(--space-4)',
          outline: 'none',
          boxSizing: 'border-box' as const,
        }}
        onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--color-primary)' }}
        onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--color-border)' }}
      />

      {loading && (
        <p
          style={{
            color: 'var(--color-text-muted)',
            textAlign: 'center',
            padding: 'var(--space-8)',
            fontSize: 'var(--text-sm)',
          }}
        >
          Searching…
        </p>
      )}

      {!loading && results.length > 0 && (
        <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
          {results.map((exam) => (
            <li key={exam.id}>
              <button
                onClick={() => { void handleEnroll(exam.id) }}
                disabled={enrolling !== null}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 'var(--space-3)',
                  padding: 'var(--space-4)',
                  background: 'var(--color-surface)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-md)',
                  cursor: enrolling !== null ? 'not-allowed' : 'pointer',
                  textAlign: 'left' as const,
                  boxShadow: 'var(--shadow-sm)',
                  opacity: enrolling === exam.id ? 0.6 : 1,
                }}
              >
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span
                    style={{
                      display: 'block',
                      fontWeight: 600,
                      color: 'var(--color-text)',
                      fontSize: 'var(--text-base)',
                    }}
                  >
                    {enrolling === exam.id ? 'Enrolling…' : exam.name}
                  </span>
                  <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>
                    {exam.questionCount} questions · {exam.domain}
                  </span>
                </span>
                <StakesBadge level={exam.stakesLevel} />
              </button>
            </li>
          ))}
        </ul>
      )}

      {noResults && (
        <div
          style={{
            textAlign: 'center',
            padding: 'var(--space-12) var(--space-4)',
            background: 'var(--color-surface)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--color-border)',
          }}
        >
          <p style={{ color: 'var(--color-text-muted)', marginBottom: 'var(--space-6)', fontSize: 'var(--text-base)' }}>
            No exam found{query ? ` for "${query}"` : ''}.
          </p>
          <div
            style={{
              display: 'flex',
              gap: 'var(--space-4)',
              justifyContent: 'center',
              flexWrap: 'wrap' as const,
            }}
          >
            <a
              href={`/upload?examName=${encodeURIComponent(query)}`}
              style={{
                padding: 'var(--space-3) var(--space-6)',
                background: 'var(--color-primary)',
                color: 'var(--color-text-on-primary)',
                borderRadius: 'var(--radius-md)',
                fontWeight: 600,
                fontSize: 'var(--text-sm)',
                textDecoration: 'none',
              }}
            >
              Upload your materials
            </a>

            {tier === 'premium' ? (
              <a
                href={`/upload?examName=${encodeURIComponent(query)}&mode=ai`}
                style={{
                  padding: 'var(--space-3) var(--space-6)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-md)',
                  color: 'var(--color-text)',
                  fontSize: 'var(--text-sm)',
                  textDecoration: 'none',
                }}
              >
                Let AI generate a curriculum
              </a>
            ) : (
              <a
                href="/pricing"
                title="Upgrade to Premium to use AI curriculum generation"
                style={{
                  padding: 'var(--space-3) var(--space-6)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-md)',
                  color: 'var(--color-text-muted)',
                  fontSize: 'var(--text-sm)',
                  textDecoration: 'none',
                  opacity: 0.55,
                }}
              >
                Let AI generate a curriculum
                <span
                  style={{
                    display: 'block',
                    fontSize: 'var(--text-xs)',
                    color: 'var(--color-accent)',
                    marginTop: 'var(--space-1)',
                  }}
                >
                  Premium only — upgrade →
                </span>
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
