import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api/auth-guard'
import { getPool } from '@/lib/db/pool'

export const dynamic = 'force-dynamic'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ examId: string }> }
) {
  const { error } = await requireAuth()
  if (error) return error
  const { examId } = await params
  const { rows } = await getPool().query(
    `SELECT id, name, weight::float FROM exam_topics WHERE exam_id = $1 ORDER BY weight DESC`,
    [examId]
  )
  const topics = rows.map((r) => ({
    id:     r.id     as string,
    name:   r.name   as string,
    weight: r.weight as number,
  }))
  return NextResponse.json({ success: true, data: { topics }, error: null })
}
