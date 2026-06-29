'use client'
import type { TopicRow } from './MasteryHeatMap'

export default function WeakAreaCard({ topic, examId }: { topic: TopicRow; examId: string }) {
  const pct = Math.round(topic.mastery * 100)

  return (
    <div
      style={{
        background: 'var(--color-surface-dark)',
        borderRadius: 'var(--radius-md)',
        padding: 'var(--space-4) var(--space-6)',
        marginBottom: 'var(--space-3)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        border: '1px solid var(--color-border-dark)',
        borderLeft: '4px solid var(--color-weak)',
      }}
    >
      <div>
        <p style={{ fontWeight: 600, color: 'var(--color-text-dark)', margin: 0 }}>
          {topic.topicName}
        </p>
        <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted-dark)', margin: 'var(--space-1) 0 0 0' }}>
          {pct}% mastery · {topic.attempts} attempt{topic.attempts !== 1 ? 's' : ''}
        </p>
      </div>
      <a
        href={`/study/new?examId=${examId}`}
        style={{
          padding: 'var(--space-2) var(--space-4)',
          background: 'var(--color-primary-dark)',
          color: 'var(--color-text-on-primary)',
          borderRadius: 'var(--radius-md)',
          fontSize: 'var(--text-sm)',
          fontWeight: 600,
          textDecoration: 'none',
          flexShrink: 0,
        }}
      >
        Study
      </a>
    </div>
  )
}
