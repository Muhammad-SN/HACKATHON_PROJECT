'use client'

export default function ReadinessIsland({
  predictedScore,
  confidenceInterval,
}: {
  predictedScore: number
  confidenceInterval: number
}) {
  const score = Math.round(predictedScore)
  const ci    = Math.round(confidenceInterval)

  const scoreColor =
    score >= 75 ? 'var(--color-mastered)' :
    score >= 50 ? 'var(--color-accent)'   :
    'var(--color-weak)'

  return (
    <div
      style={{
        background: 'var(--color-surface-dark)',
        borderRadius: 'var(--radius-xl)',
        padding: 'var(--space-8)',
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-8)',
        boxShadow: 'var(--shadow-lg)',
        border: '1px solid var(--color-border-dark)',
      }}
    >
      <div style={{ textAlign: 'center', flexShrink: 0 }}>
        <div
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'var(--text-hero)',
            color: scoreColor,
            lineHeight: 1,
          }}
        >
          {score}
        </div>
        <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted-dark)', marginTop: 'var(--space-1)' }}>
          / 100
        </div>
      </div>

      <div>
        <p style={{ fontSize: 'var(--text-lg)', color: 'var(--color-text-dark)', fontWeight: 600, margin: '0 0 var(--space-2) 0' }}>
          Predicted Exam Score
        </p>
        {ci > 0 && (
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted-dark)', margin: '0 0 var(--space-2) 0' }}>
            ±{ci} points confidence interval
          </p>
        )}
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted-dark)', margin: 0 }}>
          Based on your topic mastery across all studied questions.
        </p>
      </div>
    </div>
  )
}
