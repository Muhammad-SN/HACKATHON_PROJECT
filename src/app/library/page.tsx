import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { listCommunityExams, listMyExams } from '@/lib/db/library'
import ExamCard from '@/components/library/ExamCard'
import LibraryFilter from '@/components/library/LibraryFilter'
import { Suspense } from 'react'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Library' }
export const dynamic = 'force-dynamic'

export default async function LibraryPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; search?: string }>
}) {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const { tab = 'community', search } = await searchParams

  const exams =
    tab === 'mine'
      ? await listMyExams(session.user.id)
      : await listCommunityExams(search)

  return (
    <main
      style={{
        minHeight:  '100dvh',
        background: 'var(--color-bg)',
        padding:    'var(--space-8) var(--space-4)',
        fontFamily: 'var(--font-body)',
      }}
    >
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>
        <h1
          style={{
            fontFamily:   'var(--font-display)',
            fontSize:     'var(--text-3xl)',
            color:        'var(--color-text)',
            marginBottom: 'var(--space-6)',
          }}
        >
          Exam Library
        </h1>

        <Suspense>
          <LibraryFilter />
        </Suspense>

        {exams.length === 0 ? (
          <p
            style={{
              color:     'var(--color-text-muted)',
              textAlign: 'center',
              padding:   'var(--space-12) 0',
            }}
          >
            {tab === 'mine'
              ? 'You have no exams yet. Upload one to get started.'
              : 'No exams found.'}
          </p>
        ) : (
          <div
            style={{
              display:             'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
              gap:                 'var(--space-4)',
            }}
          >
            {exams.map((exam) => (
              <ExamCard key={exam.id} exam={exam} />
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
