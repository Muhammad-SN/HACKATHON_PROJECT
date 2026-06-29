'use client'
import StakesBadge from './StakesBadge'
import type { ExamRow } from '@/lib/db/library'

export default function ExamCard({ exam }: { exam: ExamRow }) {
  return (
    <div
      style={{
        background:    'var(--color-surface)',
        borderRadius:  'var(--radius-lg)',
        padding:       'var(--space-4)',
        border:        '1px solid var(--color-border)',
        display:       'flex',
        flexDirection: 'column',
        gap:           'var(--space-3)',
      }}
    >
      <div
        style={{
          display:        'flex',
          alignItems:     'flex-start',
          justifyContent: 'space-between',
          gap:            'var(--space-3)',
        }}
      >
        <h3
          style={{
            fontFamily: 'var(--font-display)',
            fontSize:   'var(--text-lg)',
            color:      'var(--color-text)',
            margin:     0,
            flex:       1,
          }}
        >
          {exam.title}
        </h3>
        <StakesBadge stakes={exam.stakesLevel} />
      </div>

      {exam.description && (
        <p
          style={{
            fontSize:        'var(--text-sm)',
            color:           'var(--color-text-muted)',
            margin:          0,
            display:         '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical' as const,
            overflow:        'hidden',
          }}
        >
          {exam.description}
        </p>
      )}

      <div
        style={{
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'space-between',
          marginTop:      'auto',
        }}
      >
        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
          {exam.questionCount} question{exam.questionCount !== 1 ? 's' : ''} &middot; by {exam.ownerName}
        </span>
        <a
          href={`/diagnostic?examId=${exam.id}`}
          style={{
            padding:        'var(--space-2) var(--space-4)',
            background:     'var(--color-primary)',
            color:          'var(--color-text-on-primary)',
            borderRadius:   'var(--radius-md)',
            fontSize:       'var(--text-sm)',
            fontWeight:     600,
            textDecoration: 'none',
          }}
        >
          Study
        </a>
      </div>
    </div>
  )
}
