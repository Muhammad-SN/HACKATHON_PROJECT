import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/api/auth-guard'
import {
  recordAnswer, getSessionAnswers, getUnansweredQuestions,
  completeDiagnosticSession, seedTopicMastery,
} from '@/lib/db/diagnostic'
import { estimateAbility, selectNextQuestion, shouldStopDiagnostic } from '@/lib/engines/cold-start'
import { getPool } from '@/lib/db/pool'

const Schema = z.object({
  sessionId:   z.string().uuid(),
  questionId:  z.string().uuid(),
  chosenIndex: z.number().int().min(0).max(3),
  timeSpentMs: z.number().int().min(0),
})

async function fetchQuestionDetail(questionId: string) {
  const { rows } = await getPool().query(
    `SELECT id, stem, options, correct_index, topic_id FROM questions WHERE id = $1`,
    [questionId]
  )
  if (rows.length === 0) return null
  const r = rows[0] as { id: string; stem: string; options: unknown; correct_index: number; topic_id: string }
  return { id: r.id, stem: r.stem, options: r.options as string[], correctIndex: r.correct_index, topicId: r.topic_id }
}

export async function POST(req: Request) {
  const { user, error } = await requireAuth()
  if (error) return error
  let body: unknown
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  const parsed = Schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request' }, { status: 422 })
  const { sessionId, questionId, chosenIndex, timeSpentMs } = parsed.data

  const { rows: sessionRows } = await getPool().query(
    `SELECT exam_id, ended_at FROM study_sessions WHERE id = $1 AND user_id = $2`,
    [sessionId, user!.id]
  )
  if (sessionRows.length === 0) return NextResponse.json({ error: 'Session not found' }, { status: 404 })
  const { exam_id: examId, ended_at } = sessionRows[0] as { exam_id: string; ended_at: Date | null }
  if (ended_at) return NextResponse.json({ error: 'Session already completed' }, { status: 409 })

  const { rows: qRows } = await getPool().query(
    `SELECT correct_index FROM questions WHERE id = $1`,
    [questionId]
  )
  const correctIndex = qRows.length > 0 ? (qRows[0] as { correct_index: number }).correct_index : -1
  const isCorrect = chosenIndex === correctIndex

  await recordAnswer(sessionId, user!.id, questionId, chosenIndex, isCorrect, timeSpentMs)

  const answers = await getSessionAnswers(sessionId)
  const remaining = await getUnansweredQuestions(sessionId, examId)
  const stop = shouldStopDiagnostic(answers.length, answers) || remaining.length === 0

  if (stop) {
    await completeDiagnosticSession(sessionId)
    await seedTopicMastery(user!.id, answers)
    return NextResponse.json({ success: true, data: { isCorrect, done: true, question: null }, error: null })
  }

  const theta = estimateAbility(answers)
  const answeredIds = new Set(answers.map((a) => a.question.id))
  const next = selectNextQuestion(theta, remaining, answeredIds)
  const question = next ? await fetchQuestionDetail(next.id) : null
  return NextResponse.json({ success: true, data: { isCorrect, done: !question, question }, error: null })
}
