import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/auth', () => ({ auth: vi.fn() }))

import { auth } from '@/auth'
import { requireAuth, requireAdmin } from '@/lib/api/auth-guard'

const mockAuth = vi.mocked(auth)

const adminSession = {
  user: { id: 'u1', email: 'a@b.com', name: 'A', image: null, tier: 'free', role: 'admin' },
  expires: '2027-01-01'
}
const userSession = {
  user: { id: 'u2', email: 'b@c.com', name: 'B', image: null, tier: 'free', role: 'user' },
  expires: '2027-01-01'
}

describe('requireAuth', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when session is null', async () => {
    mockAuth.mockResolvedValueOnce(null as any)
    const r = await requireAuth()
    expect(r.error?.status).toBe(401)
    expect(r.user).toBeNull()
  })

  it('returns user when session is valid', async () => {
    mockAuth.mockResolvedValueOnce(userSession as any)
    const r = await requireAuth()
    expect(r.error).toBeNull()
    expect(r.user?.id).toBe('u2')
  })
})

describe('requireAdmin', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when no session', async () => {
    mockAuth.mockResolvedValueOnce(null as any)
    const r = await requireAdmin()
    expect(r.error?.status).toBe(401)
  })

  it('returns 403 when user is not admin', async () => {
    mockAuth.mockResolvedValueOnce(userSession as any)
    const r = await requireAdmin()
    expect(r.error?.status).toBe(403)
    const body = await r.error!.json()
    expect(body.error).toBe('Forbidden')
  })

  it('returns user when role is admin', async () => {
    mockAuth.mockResolvedValueOnce(adminSession as any)
    const r = await requireAdmin()
    expect(r.error).toBeNull()
    expect(r.user?.role).toBe('admin')
  })
})
