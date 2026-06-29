import { NextResponse } from 'next/server'
import { getPool } from '@/lib/db/pool'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization')
  const expected   = `Bearer ${process.env['CRON_SECRET'] ?? ''}`
  if (!authHeader || authHeader !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const client = await getPool().connect()
  let purged = 0

  try {
    const { rows } = await client.query<{ id: string }>(
      `SELECT id FROM users WHERE deleted_at < NOW() - INTERVAL '30 days'`
    )

    for (const { id } of rows) {
      await client.query('BEGIN')
      try {
        await client.query(`DELETE FROM sessions               WHERE user_id = $1`, [id])
        await client.query(`DELETE FROM accounts               WHERE user_id = $1`, [id])
        await client.query(`DELETE FROM user_question_schedule WHERE user_id = $1`, [id])
        await client.query(`DELETE FROM study_sessions         WHERE user_id = $1`, [id])
        await client.query(`DELETE FROM user_exam_purchases    WHERE user_id = $1`, [id])
        await client.query('COMMIT')
        purged++
      } catch (err) {
        await client.query('ROLLBACK')
        throw err
      }
    }

    return NextResponse.json({ success: true, data: { purged }, error: null })
  } finally {
    client.release()
  }
}
