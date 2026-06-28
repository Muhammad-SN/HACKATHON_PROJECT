import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import DiagnosticSession from './DiagnosticSession'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Diagnostic' }

export default async function DiagnosticPage({
  searchParams,
}: {
  searchParams: Promise<{ examId?: string }>
}) {
  const session = await auth()
  if (!session) redirect('/login')

  const { examId } = await searchParams
  if (!examId) redirect('/onboarding')

  return (
    <main
      style={{
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        background: 'var(--color-bg)',
        padding: 'var(--space-8) var(--space-4)',
      }}
    >
      <div style={{ maxWidth: '680px', width: '100%' }}>
        <div
          style={{
            background: 'var(--color-accent)',
            borderRadius: 'var(--radius-lg)',
            padding: 'var(--space-4) var(--space-6)',
            marginBottom: 'var(--space-8)',
            textAlign: 'center',
          }}
        >
          <p
            style={{
              color: 'var(--color-text-on-primary)',
              fontFamily: 'var(--font-body)',
              fontSize: 'var(--text-base)',
              fontWeight: 500,
              margin: 0,
            }}
          >
            Let&apos;s map what you already know. 15 quick questions, no pressure.
          </p>
        </div>

        <DiagnosticSession examId={examId} />
      </div>
    </main>
  )
}
