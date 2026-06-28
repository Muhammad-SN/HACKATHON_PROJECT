import { describe, it, expect } from 'vitest'

type MockUser = {
  id: string
  email: string
  name: string | null
  image: string | null
  tier?: string
  role?: string
  deleted_at?: Date | null
}
type MockSession = {
  user: { id?: string; email: string; name: string | null; image: string | null; tier?: string; role?: string }
  expires: string
}

function applySessionCallback(session: MockSession, user: MockUser): MockSession {
  if (user.deleted_at) throw new Error('Account deleted')
  session.user.id   = user.id
  session.user.tier = user.tier ?? 'free'
  session.user.role = user.role ?? 'user'
  return session
}

const base: MockSession = { user: { email: 'a@b.com', name: 'A', image: null }, expires: '2027-01-01' }

describe('session callback logic', () => {
  it('enriches session with id, tier, role', () => {
    const s = applySessionCallback(
      { ...base, user: { ...base.user } },
      { id: 'u1', email: 'a@b.com', name: 'A', image: null, tier: 'premium', role: 'admin' }
    )
    expect(s.user.id).toBe('u1')
    expect(s.user.tier).toBe('premium')
    expect(s.user.role).toBe('admin')
  })

  it('defaults tier to free', () => {
    const s = applySessionCallback(
      { ...base, user: { ...base.user } },
      { id: 'u1', email: 'a@b.com', name: null, image: null }
    )
    expect(s.user.tier).toBe('free')
  })

  it('defaults role to user', () => {
    const s = applySessionCallback(
      { ...base, user: { ...base.user } },
      { id: 'u1', email: 'a@b.com', name: null, image: null }
    )
    expect(s.user.role).toBe('user')
  })

  it('throws for soft-deleted users', () => {
    expect(() =>
      applySessionCallback(
        { ...base, user: { ...base.user } },
        { id: 'u1', email: 'a@b.com', name: null, image: null, deleted_at: new Date() }
      )
    ).toThrow('Account deleted')
  })
})
