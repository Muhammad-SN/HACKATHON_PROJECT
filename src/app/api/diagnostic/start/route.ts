import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/api/auth-guard'
import { createDiagnosticSession, getUnansweredQuestions } from '@/lib/db/diagnostic'
import { selectNextQuestion } from '@/lib/engines/cold-start'
import { getPool } from '@/lib/db/pool'

const Schema = z.object({ examId: z.string().uuid() })

async function fetchQuestionDetail(questionId: string) {
  const { rows } = await getPool().query(
    `SELECT id, stem, options, correct_index, topic_id FROM questions WHERE id = $1`,
    [questionId]
  )
  if (rows.length === 0) return null
  const r = rows[0] as { id: string; stem: string; options: unknown; correct_index: number; topic_id: string }
  return {
    id:           r.id,
    stem:         r.stem,
    options:      r.options as string[],
    correctIndex: r.correct_index,
    topicId:      r.topic_id,
  }
}

export async function POST(req: Request) {
  const { user, error } = await requireAuth()
  if (error) return error
  let body: unknown
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  const parsed = Schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid examId' }, { status: 422 })
  const { examId } = parsed.data
  const sessionId = await createDiagnosticSession(user!.id, examId)
  const candidates = await getUnansweredQuestions(sessionId, examId)
  if (candidates.length === 0) {
    return NextResponse.json({ success: true, data: { sessionId, question: null, done: true }, error: null })
  }
  const next = selectNextQuestion(0, candidates, new Set())
  const question = next ? await fetchQuestionDetail(next.id) : null
  return NextResponse.json({ success: true, data: { sessionId, question, done: false }, error: null })
}
