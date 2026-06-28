import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { getUserExamCount } from '@/lib/db/exams'
import OnboardingSearch from './OnboardingSearch'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Choose Your Exam' }

export default async function OnboardingPage() {
  const session = await auth()
  if (!session) redirect('/login')

  const count = await getUserExamCount(session.user.id)
  if (count > 0) redirect('/dashboard')

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
      <div style={{ maxWidth: '600px', width: '100%' }}>
        <h1
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'var(--text-3xl)',
            color: 'var(--color-primary)',
            marginBottom: 'var(--space-2)',
            textAlign: 'center',
            lineHeight: 1.2,
          }}
        >
          Let&apos;s set up your study plan
        </h1>
        <p
          style={{
            color: 'var(--color-text-muted)',
            textAlign: 'center',
            marginBottom: 'var(--space-8)',
            fontSize: 'var(--text-lg)',
          }}
        >
          Search for your exam or upload your study materials
        </p>

        <OnboardingSearch tier={session.user.tier} />

        <p style={{ textAlign: 'center', marginTop: 'var(--space-12)' }}>
          <a
            href="/dashboard"
            style={{
              color: 'var(--color-text-muted)',
              fontSize: 'var(--text-sm)',
              textDecoration: 'underline',
            }}
          >
            I&apos;ll add an exam later →
          </a>
        </p>
      </div>
    </main>
  )
}
