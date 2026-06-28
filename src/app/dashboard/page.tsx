import { auth } from '@/auth'
import { redirect } from 'next/navigation'

export const metadata = { title: 'Dashboard' }

export default async function DashboardPage() {
  const session = await auth()
  if (!session) redirect('/login')

  return (
    <main
      style={{
        minHeight: '100dvh',
        padding: 'var(--space-8)',
        background: 'var(--color-bg)',
      }}
    >
      <h1
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 'var(--text-2xl)',
          marginBottom: 'var(--space-4)',
        }}
      >
        Welcome back, {session.user.name ?? session.user.email}
      </h1>
      <p style={{ color: 'var(--color-text-muted)' }}>
        Your personalized dashboard loads here after Plan B (Onboarding + Diagnostic) is complete.
      </p>
    </main>
  )
}
