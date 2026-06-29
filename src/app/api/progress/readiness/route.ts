import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api/auth-guard'
import { getUserTopicMastery } from '@/lib/db/progress'
import { predictedScore, confidenceInterval } from '@/lib/engines/readiness'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const { user, error } = await requireAuth()
  if (error) return error

  const { searchParams } = new URL(req.url)
  const examId = searchParams.get('examId')
  if (!examId) return NextResponse.json({ error: 'Missing examId' }, { status: 422 })

  const topics = await getUserTopicMastery(user!.id, examId)
  const totalAttempts = topics.reduce((sum, t) => sum + t.attempts, 0)

  return NextResponse.json({
    success: true,
    data: {
      predictedScore:     Math.round(predictedScore(topics) * 10) / 10,
      confidenceInterval: Math.round(confidenceInterval(topics, totalAttempts) * 10) / 10,
      topicCount:         topics.length,
      totalAttempts,
    },
    error: null,
  })
}
