import { auth } from '@/auth'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const rateLimitMap = new Map<string, { count: number; resetAt: number }>()

function getRateLimit(pathname: string): number {
  if (pathname.startsWith('/api/auth'))     return 10
  if (pathname.startsWith('/api/upload'))   return 5
  if (pathname.startsWith('/api/webhooks')) return 100
  if (pathname.startsWith('/api/admin'))    return 30
  if (
    pathname === '/api/study/answer' ||
    pathname === '/api/diagnostic/answer'
  ) return 60
  return 120
}

function checkRateLimit(key: string, limit: number): boolean {
  const now = Date.now()
  const entry = rateLimitMap.get(key)
  if (!entry || entry.resetAt < now) {
    rateLimitMap.set(key, { count: 1, resetAt: now + 60_000 })
    return true
  }
  if (entry.count >= limit) return false
  entry.count++
  return true
}

const PUBLIC_PATHS = new Set(['/login', '/register', '/pricing', '/'])

export default auth((req: NextRequest & { auth: unknown }) => {
  const { pathname } = req.nextUrl

  if (
    pathname.startsWith('/_next') ||
    pathname === '/api/health' ||
    pathname === '/api/onboarding/search'
  ) {
    return NextResponse.next()
  }

  if (pathname.startsWith('/api/')) {
    const ip =
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
    if (!checkRateLimit(`${ip}:${pathname}`, getRateLimit(pathname))) {
      return NextResponse.json(
        { error: 'rate_limit_exceeded', retryAfter: 60 },
        { status: 429 }
      )
    }
  }

  if (
    PUBLIC_PATHS.has(pathname) ||
    pathname.startsWith('/api/auth')
  ) {
    return NextResponse.next()
  }

  // next-auth v5 augments req.auth at runtime
  if (!(req as any).auth) {
    const url = new URL('/login', req.url)
    url.searchParams.set('callbackUrl', pathname)
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
})

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|webp|svg)$).*)',
  ],
}
