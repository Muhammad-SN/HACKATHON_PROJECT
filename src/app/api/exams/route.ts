import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api/auth-guard'
import { listCommunityExams, listMyExams } from '@/lib/db/library'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const { user, error } = await requireAuth()
  if (error) return error

  const { searchParams } = new URL(req.url)
  const tab    = searchParams.get('tab') ?? 'community'
  const search = searchParams.get('search') ?? undefined

  const exams = tab === 'mine'
    ? await listMyExams(user!.id)
    : await listCommunityExams(search)

  return NextResponse.json({ success: true, data: { exams }, error: null })
}
