import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export default async function HomePage() {
  const session = await auth()
  if (session) redirect('/dashboard')

  return (
    <main
      style={{
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 'var(--space-6)',
        padding: 'var(--space-8)',
        textAlign: 'center',
      }}
    >
      <h1
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 'var(--text-hero)',
          lineHeight: 'var(--leading-tight)',
          maxWidth: '14ch',
        }}
      >
        Prepare smarter. Pass faster.
      </h1>
      <p
        style={{
          color: 'var(--color-text-muted)',
          fontSize: 'var(--text-lg)',
          maxWidth: '48ch',
        }}
      >
        AI-powered adaptive exam prep that knows exactly what you need to study next.
      </p>
      <div
        style={{
          display: 'flex',
          gap: 'var(--space-3)',
          flexWrap: 'wrap',
          justifyContent: 'center',
        }}
      >
        <Link
          href="/register"
          style={{
            padding: 'var(--space-3) var(--space-8)',
            background: 'var(--color-primary)',
            color: 'var(--color-text-on-primary)',
            borderRadius: 'var(--radius-md)',
            fontWeight: 600,
          }}
        >
          Get started free
        </Link>
        <Link
          href="/login"
          style={{
            padding: 'var(--space-3) var(--space-8)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--color-text)',
          }}
        >
          Sign in
        </Link>
      </div>
    </main>
  )
}
