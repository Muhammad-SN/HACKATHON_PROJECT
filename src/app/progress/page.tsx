import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import ReadinessIsland from '@/components/progress/ReadinessIsland'
import MasteryHeatMap, { type TopicRow } from '@/components/progress/MasteryHeatMap'
import WeakAreaCard from '@/components/progress/WeakAreaCard'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Progress' }

export default async function ProgressPage({
  searchParams,
}: {
  searchParams: Promise<{ examId?: string }>
}) {
  const session = await auth()
  if (!session) redirect('/login')

  const { examId } = await searchParams
  if (!examId) redirect('/dashboard')

  const base = process.env['NEXT_PUBLIC_APP_URL'] ?? 'http://localhost:3000'

  const [readinessRes, masteryRes] = await Promise.all([
    fetch(`${base}/api/progress/readiness?examId=${examId}`, { cache: 'no-store' }).catch(() => null),
    fetch(`${base}/api/progress/mastery?examId=${examId}`, { cache: 'no-store' }).catch(() => null),
  ])

  const readiness = readinessRes?.ok
    ? ((await readinessRes.json()) as { data: { predictedScore: number; confidenceInterval: number } }).data
    : { predictedScore: 0, confidenceInterval: 0 }

  const masteryData = masteryRes?.ok
    ? ((await masteryRes.json()) as { data: { topics: TopicRow[]; weakTopics: TopicRow[] } }).data
    : { topics: [], weakTopics: [] }

  return (
    <main
      style={{
        minHeight: '100dvh',
        background: 'var(--color-bg-dark)',
        padding: 'var(--space-8) var(--space-4)',
        color: 'var(--color-text-dark)',
        fontFamily: 'var(--font-body)',
      }}
    >
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>
        <h1
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'var(--text-3xl)',
            color: 'var(--color-text-dark)',
            marginBottom: 'var(--space-8)',
          }}
        >
          Your Progress
        </h1>

        <ReadinessIsland
          predictedScore={readiness.predictedScore}
          confidenceInterval={readiness.confidenceInterval}
        />

        <div style={{ marginTop: 'var(--space-8)' }}>
          <MasteryHeatMap topics={masteryData.topics} />
        </div>

        {masteryData.weakTopics.length > 0 && (
          <div style={{ marginTop: 'var(--space-8)' }}>
            <h2 style={{ fontSize: 'var(--text-xl)', color: 'var(--color-text-dark)', marginBottom: 'var(--space-4)', fontWeight: 600 }}>
              Focus Areas
            </h2>
            {masteryData.weakTopics.map((topic) => (
              <WeakAreaCard key={topic.topicId} topic={topic} examId={examId} />
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
