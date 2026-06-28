import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import UploadForm from './UploadForm'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Upload Study Materials' }

export default async function UploadPage({
  searchParams,
}: {
  searchParams: Promise<{ examName?: string; mode?: string }>
}) {
  const session = await auth()
  if (!session) redirect('/login')

  const { examName = '', mode = '' } = await searchParams

  return (
    <main
      style={{
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: 'var(--space-16) var(--space-4) var(--space-8)',
        background: 'var(--color-bg)',
      }}
    >
      <div style={{ maxWidth: '640px', width: '100%' }}>
        <h1
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'var(--text-3xl)',
            color: 'var(--color-primary)',
            marginBottom: 'var(--space-2)',
            textAlign: 'center',
          }}
        >
          Upload your study materials
        </h1>
        <p
          style={{
            color: 'var(--color-text-muted)',
            textAlign: 'center',
            marginBottom: 'var(--space-8)',
            fontSize: 'var(--text-lg)',
          }}
        >
          Paste your notes or upload a PDF — we&apos;ll generate practice questions automatically.
        </p>

        <UploadForm defaultExamName={examName} aiMode={mode === 'ai'} tier={session.user.tier} />
      </div>
    </main>
  )
}
