import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { requireAuth } from '@/lib/api/auth-guard'
import { getPool } from '@/lib/db/pool'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const { user, error } = await requireAuth()
  if (error) return error

  const jobId = req.nextUrl.searchParams.get('jobId')
  if (!jobId) {
    return NextResponse.json({ error: 'jobId required' }, { status: 400 })
  }

  const { rows } = await getPool().query(
    `SELECT dj.id, dj.status, dj.questions_generated, dj.failed_reason, dj.exam_id
     FROM document_jobs dj
     WHERE dj.id = $1 AND dj.user_id = $2`,
    [jobId, user!.id]
  )

  if (rows.length === 0) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 })
  }

  const row = rows[0] as {
    id: string
    status: string
    questions_generated: number
    failed_reason: string | null
    exam_id: string
  }

  return NextResponse.json({
    success: true,
    data: {
      jobId: row.id,
      status: row.status,
      questionsGenerated: row.questions_generated,
      failedReason: row.failed_reason,
      examId: row.exam_id,
    },
    error: null,
  })
}
