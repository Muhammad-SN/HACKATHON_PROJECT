import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Pricing — CogniPrep' }

const FREE_FEATURES = [
  'Unlimited low-stakes exams',
  'Adaptive study sessions',
  'BKT mastery tracking',
  'Socratic AI explanations (Haiku)',
  'Community exam library',
  'Upload up to 3 documents',
]

const PREMIUM_FEATURES = [
  'Everything in Free',
  'High-stakes exam access',
  'Socratic AI explanations (Sonnet)',
  'Unlimited document uploads',
  'Priority question generation',
  'Early access to new features',
]

export default function PricingPage() {
  return (
    <main style={{ minHeight: '100dvh', background: 'var(--color-bg)', padding: 'var(--space-16) var(--space-4)', fontFamily: 'var(--font-body)' }}>
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 'var(--space-12)' }}>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-hero)', color: 'var(--color-primary)', marginBottom: 'var(--space-4)' }}>
            Simple pricing
          </h1>
          <p style={{ fontSize: 'var(--text-lg)', color: 'var(--color-text-muted)' }}>
            Start free. Upgrade when you need serious exam prep.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-6)' }}>
          {/* Free */}
          <div style={{ background: 'var(--color-surface)', borderRadius: 'var(--radius-xl)', padding: 'var(--space-8)', border: '1px solid var(--color-border)' }}>
            <p style={{ fontWeight: 700, fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 'var(--space-2)' }}>Free</p>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-3xl)', color: 'var(--color-text)', marginBottom: 'var(--space-6)' }}>$0</div>
            <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 var(--space-8) 0' }}>
              {FREE_FEATURES.map((f) => (
                <li key={f} style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-3)', fontSize: 'var(--text-sm)', color: 'var(--color-text)' }}>
                  <span style={{ color: 'var(--color-mastered)', fontWeight: 700 }}>✓</span> {f}
                </li>
              ))}
            </ul>
            <a href="/register" style={{ display: 'block', textAlign: 'center', padding: 'var(--space-3) var(--space-6)', background: 'var(--color-surface)', color: 'var(--color-primary)', borderRadius: 'var(--radius-md)', fontWeight: 700, fontSize: 'var(--text-sm)', border: '2px solid var(--color-primary)', textDecoration: 'none' }}>
              Get started free
            </a>
          </div>

          {/* Premium */}
          <div style={{ background: 'var(--color-primary)', borderRadius: 'var(--radius-xl)', padding: 'var(--space-8)', position: 'relative' }}>
            <span style={{ position: 'absolute', top: 'var(--space-4)', right: 'var(--space-4)', background: 'var(--color-accent)', color: 'var(--color-text-on-primary)', fontSize: 'var(--text-xs)', fontWeight: 700, padding: 'var(--space-1) var(--space-3)', borderRadius: 'var(--radius-full)' }}>
              Most popular
            </span>
            <p style={{ fontWeight: 700, fontSize: 'var(--text-sm)', color: 'rgba(255,255,255,0.7)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 'var(--space-2)' }}>Premium</p>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-3xl)', color: 'var(--color-text-on-primary)', marginBottom: 'var(--space-6)' }}>
              $19<span style={{ fontSize: 'var(--text-base)', opacity: 0.8 }}>/mo</span>
            </div>
            <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 var(--space-8) 0' }}>
              {PREMIUM_FEATURES.map((f) => (
                <li key={f} style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-3)', fontSize: 'var(--text-sm)', color: 'var(--color-text-on-primary)' }}>
                  <span style={{ fontWeight: 700 }}>✓</span> {f}
                </li>
              ))}
            </ul>
            <form action="/api/billing/checkout" method="POST">
              <button type="submit" style={{ display: 'block', width: '100%', textAlign: 'center', padding: 'var(--space-3) var(--space-6)', background: 'var(--color-text-on-primary)', color: 'var(--color-primary)', borderRadius: 'var(--radius-md)', fontWeight: 700, fontSize: 'var(--text-sm)', border: 'none', cursor: 'pointer' }}>
                Upgrade to Premium
              </button>
            </form>
          </div>
        </div>
      </div>
    </main>
  )
}
