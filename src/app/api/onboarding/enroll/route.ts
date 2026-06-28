import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/api/auth-guard'
import { enrollUserInExam } from '@/lib/db/exams'
import { getPool } from '@/lib/db/pool'

const Schema = z.object({
  examId: z.string().uuid(),
})

export async function POST(req: Request) {
  const { user, error } = await requireAuth()
  if (error) return error

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = Schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid examId' }, { status: 422 })
  }

  const { examId } = parsed.data

  const { rows } = await getPool().query(
    `SELECT id FROM exams
     WHERE id = $1
       AND is_public = TRUE
       AND classification_source != 'pending_review'`,
    [examId]
  )
  if (rows.length === 0) {
    return NextResponse.json({ error: 'Exam not found or not accessible' }, { status: 404 })
  }

  await enrollUserInExam(user!.id, examId)

  return NextResponse.json({
    success: true,
    data: { redirectUrl: `/diagnostic?examId=${examId}` },
    error: null,
  })
}
