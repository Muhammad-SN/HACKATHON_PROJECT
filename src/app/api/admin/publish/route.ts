import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdmin } from '@/lib/api/auth-guard'
import { publishExam, logAdminAction, saveClassification } from '@/lib/db/admin'
import { classifyExam } from '@/lib/access/classifier'
import { getPool } from '@/lib/db/pool'

const Schema = z.object({ examId: z.string().uuid() })

export async function POST(req: Request) {
  const { user, error } = await requireAdmin()
  if (error) return error

  let body: unknown
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const parsed = Schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request' }, { status: 422 })

  const { examId } = parsed.data

  const { rows } = await getPool().query(
    `SELECT name, description, classification_source FROM exams WHERE id = $1`, [examId]
  )
  if (rows.length === 0) return NextResponse.json({ error: 'Exam not found' }, { status: 404 })

  const exam = rows[0] as { name: string; description: string; classification_source: string }

  if (exam.classification_source === 'pending_review') {
    const stakesLevel = await classifyExam(exam.name, exam.description ?? '')
    await saveClassification(examId, stakesLevel, 'ai_suggestion')
  }

  await publishExam(examId)
  await logAdminAction(user!.id, 'publish', examId, exam.name)

  return NextResponse.json({ success: true, data: { examId }, error: null })
}
