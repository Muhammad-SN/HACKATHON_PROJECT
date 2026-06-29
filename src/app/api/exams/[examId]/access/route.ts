import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api/auth-guard'
import { getExamForAccessCheck } from '@/lib/db/library'
import { hasExamAccess } from '@/lib/db/billing'
import { checkExamAccess } from '@/lib/access/check'
import type { ClassificationSource } from '@/types'

export const dynamic = 'force-dynamic'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ examId: string }> }
) {
  const { user, error } = await requireAuth()
  if (error) return error

  const { examId } = await params
  const exam = await getExamForAccessCheck(examId)
  if (!exam) {
    return NextResponse.json({ error: 'Exam not found' }, { status: 404 })
  }

  const purchased = await hasExamAccess(user!.id, examId)

  const result = checkExamAccess(
    {
      examId,
      ownerId:              exam.ownerId,
      stakesLevel:          exam.stakesLevel,
      isPublic:             exam.isPublic,
      classificationSource: exam.classificationSource as ClassificationSource,
    },
    {
      userId:          user!.id,
      tier:            user!.tier as 'free' | 'premium',
      hasExamPurchase: purchased,
    }
  )

  return NextResponse.json({ success: true, data: result, error: null })
}
