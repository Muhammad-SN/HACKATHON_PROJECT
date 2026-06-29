import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api/auth-guard'
import { getUserTopicMastery, getWeakTopics } from '@/lib/db/progress'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const { user, error } = await requireAuth()
  if (error) return error

  const { searchParams } = new URL(req.url)
  const examId = searchParams.get('examId')
  if (!examId) return NextResponse.json({ error: 'Missing examId' }, { status: 422 })

  const [topics, weakTopics] = await Promise.all([
    getUserTopicMastery(user!.id, examId),
    getWeakTopics(user!.id, examId, 5),
  ])

  return NextResponse.json({
    success: true,
    data: { topics, weakTopics },
    error: null,
  })
}
