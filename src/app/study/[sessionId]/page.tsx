import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import StudySession from './StudySession'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Study Session' }

export default async function StudyPage({
  params,
  searchParams,
}: {
  params: Promise<{ sessionId: string }>
  searchParams: Promise<{ examId?: string }>
}) {
  const session = await auth()
  if (!session) redirect('/login')

  const { sessionId } = await params
  const sp = await searchParams
  const examId = sp.examId ?? ''

  return (
    <main
      style={{
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: 'var(--space-8) var(--space-4)',
        background: 'var(--color-bg)',
      }}
    >
      <div style={{ maxWidth: '680px', width: '100%' }}>
        <StudySession sessionId={sessionId} examId={examId} />
      </div>
    </main>
  )
}
