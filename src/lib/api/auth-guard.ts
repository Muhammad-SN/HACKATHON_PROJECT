import { auth } from '@/auth'
import { NextResponse } from 'next/server'
import type { SessionUser } from '@/types'

type GuardSuccess = { user: SessionUser; error: null }
type GuardFailure = { user: null; error: NextResponse }

export async function requireAuth(): Promise<GuardSuccess | GuardFailure> {
  const session = await auth()
  if (!session?.user?.id) {
    return {
      user: null,
      error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    }
  }
  return { user: session.user as SessionUser, error: null }
}

export async function requireAdmin(): Promise<GuardSuccess | GuardFailure> {
  const result = await requireAuth()
  if (result.error) return result
  if (result.user.role !== 'admin') {
    return {
      user: null,
      error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
    }
  }
  return result
}
