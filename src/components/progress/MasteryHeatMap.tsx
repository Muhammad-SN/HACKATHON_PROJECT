'use client'

export interface TopicRow {
  topicId: string
  topicName: string
  mastery: number
  weight: number
  attempts: number
}

function masteryColor(mastery: number): string {
  if (mastery >= 0.85) return 'var(--color-mastered)'
  if (mastery >= 0.60) return 'var(--color-accent)'
  if (mastery >= 0.35) return 'var(--color-learning)'
  return 'var(--color-weak)'
}

function masteryLabel(mastery: number): string {
  if (mastery >= 0.85) return 'Mastered'
  if (mastery >= 0.60) return 'Learning'
  if (mastery >= 0.35) return 'Developing'
  return 'Weak'
}

export default function MasteryHeatMap({ topics }: { topics: TopicRow[] }) {
  if (topics.length === 0) {
    return (
      <p style={{ color: 'var(--color-text-muted-dark)', fontSize: 'var(--text-sm)' }}>
        No topic mastery data yet. Complete a diagnostic or study session to see your map.
      </p>
    )
  }

  return (
    <div>
      <h2 style={{ fontSize: 'var(--text-xl)', color: 'var(--color-text-dark)', marginBottom: 'var(--space-4)', fontWeight: 600 }}>
        Topic Mastery
      </h2>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
          gap: 'var(--space-3)',
        }}
      >
        {topics.map((topic) => (
          <div
            key={topic.topicId}
            style={{
              background: 'var(--color-surface-dark)',
              borderRadius: 'var(--radius-md)',
              padding: 'var(--space-4)',
              border: '1px solid var(--color-border-dark)',
              borderLeft: `4px solid ${masteryColor(topic.mastery)}`,
            }}
          >
            <p style={{ fontWeight: 600, color: 'var(--color-text-dark)', margin: '0 0 var(--space-2) 0', fontSize: 'var(--text-sm)' }}>
              {topic.topicName}
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <div style={{ flex: 1, height: '6px', background: 'var(--color-border-dark)', borderRadius: 'var(--radius-full)', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${Math.round(topic.mastery * 100)}%`, background: masteryColor(topic.mastery), borderRadius: 'var(--radius-full)' }} />
              </div>
              <span style={{ fontSize: 'var(--text-xs)', color: masteryColor(topic.mastery), fontWeight: 700, flexShrink: 0 }}>
                {masteryLabel(topic.mastery)}
              </span>
            </div>
            {topic.attempts > 0 && (
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted-dark)', margin: 'var(--space-1) 0 0 0' }}>
                {topic.attempts} attempt{topic.attempts !== 1 ? 's' : ''}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
