import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdmin } from '@/lib/api/auth-guard'
import { saveClassification, logAdminAction } from '@/lib/db/admin'
import { getPool } from '@/lib/db/pool'

const Schema = z.object({
  examId:      z.string().uuid(),
  stakesLevel: z.enum(['low', 'high']),
})

export async function POST(req: Request) {
  const { user, error } = await requireAdmin()
  if (error) return error

  let body: unknown
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const parsed = Schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request' }, { status: 422 })

  const { examId, stakesLevel } = parsed.data

  const { rows } = await getPool().query(`SELECT name FROM exams WHERE id = $1`, [examId])
  if (rows.length === 0) return NextResponse.json({ error: 'Exam not found' }, { status: 404 })

  const title = (rows[0] as { name: string }).name

  await saveClassification(examId, stakesLevel, 'admin_override')
  await logAdminAction(user!.id, `classify:${stakesLevel}`, examId, title)

  return NextResponse.json({ success: true, data: { examId, stakesLevel }, error: null })
}
