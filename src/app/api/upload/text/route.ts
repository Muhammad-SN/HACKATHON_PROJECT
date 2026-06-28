import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/api/auth-guard'
import { getPool } from '@/lib/db/pool'
import { invokeLambda } from '@/lib/lambda/invoke'

const Schema = z.object({
  examName: z.string().min(1).max(200),
  text: z.string().min(50).max(50000),
  domain: z
    .enum(['medical', 'legal', 'finance', 'engineering', 'technology', 'language', 'academic', 'professional', 'general'])
    .optional()
    .default('general'),
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
    return NextResponse.json(
      { error: 'Invalid request', details: parsed.error.flatten() },
      { status: 422 }
    )
  }

  const { examName, text, domain } = parsed.data

  // Create exam record
  const { rows: examRows } = await getPool().query(
    `INSERT INTO exams (name, created_by, is_public, domain, stakes_level, classification_source)
     VALUES ($1, $2, TRUE, $3, 'low', 'pending_review')
     RETURNING id`,
    [examName, user!.id, domain]
  )
  const examId = (examRows[0] as { id: string }).id

  // Create document job
  const { rows: jobRows } = await getPool().query(
    `INSERT INTO document_jobs (exam_id, user_id, status, source_type)
     VALUES ($1, $2, 'pending', 'text')
     RETURNING id`,
    [examId, user!.id]
  )
  const jobId = (jobRows[0] as { id: string }).id

  // Enqueue Lambda (fire-and-forget — don't await)
  void invokeLambda({ jobId, examId, userId: user!.id, sourceType: 'text', text })

  return NextResponse.json({
    success: true,
    data: { jobId, examId },
    error: null,
  })
}
