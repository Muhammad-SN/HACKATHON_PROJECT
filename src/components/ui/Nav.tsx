'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const HIDDEN_PATHS = ['/login', '/register', '/onboarding', '/dashboard']

const NAV_LINKS = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/library',   label: 'Library'   },
  { href: '/upload',    label: 'Upload'     },
  { href: '/progress',  label: 'Progress'   },
  { href: '/settings',  label: 'Settings'   },
]

export default function Nav() {
  const pathname = usePathname()

  if (HIDDEN_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'))) {
    return null
  }

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(href + '/')
  }

  return (
    <nav
      role="navigation"
      aria-label="Main navigation"
      style={{
        display:         'flex',
        alignItems:      'center',
        justifyContent:  'space-between',
        padding:         'var(--space-3) var(--space-8)',
        background:      'var(--color-surface)',
        borderBottom:    '1px solid var(--color-border)',
        fontFamily:      'var(--font-body)',
      }}
    >
      <Link
        href="/dashboard"
        style={{
          fontFamily:  'var(--font-display)',
          fontSize:    'var(--text-lg)',
          fontWeight:  700,
          color:       'var(--color-primary)',
          textDecoration: 'none',
        }}
      >
        CogniPrep
      </Link>
      <div className="cogni-nav-links" style={{ display: 'flex', gap: 'var(--space-6)', alignItems: 'center' }}>
        {NAV_LINKS.map(({ href, label }) => (
          <Link
            key={href}
            href={href}
            aria-current={isActive(href) ? 'page' : undefined}
            style={{
              fontSize:       'var(--text-sm)',
              fontWeight:     isActive(href) ? 600 : 400,
              color:          isActive(href) ? 'var(--color-primary)' : 'var(--color-text-muted)',
              textDecoration: 'none',
              borderBottom:   isActive(href) ? '2px solid var(--color-primary)' : '2px solid transparent',
              paddingBottom:  'var(--space-1)',
              transition:     'color 0.15s ease, border-color 0.15s ease',
            }}
          >
            {label}
          </Link>
        ))}
      </div>
    </nav>
  )
}
