import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/api/auth-guard'
import {
  getDueQuestions, fetchStudyQuestion, upsertQuestionSchedule,
  updateTopicMastery, recordStudyAnswer, getStudySessionOwner,
} from '@/lib/db/study'
import { updateMastery } from '@/lib/engines/bkt'
import { sm2Update, qualityFromCorrect, defaultSm2Record } from '@/lib/engines/sm2'
import { selectNextStudyQuestion } from '@/lib/engines/selector'
import { getPool } from '@/lib/db/pool'

const Schema = z.object({
  sessionId: z.string().uuid(),
  questionId: z.string().uuid(),
  chosenIndex: z.number().int().min(0).max(3),
  timeSpentMs: z.number().int().min(0),
})

export async function POST(req: Request) {
  const { user, error } = await requireAuth()
  if (error) return error

  let body: unknown
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const parsed = Schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request' }, { status: 422 })

  const { sessionId, questionId, chosenIndex, timeSpentMs } = parsed.data

  // Verify session ownership
  const ownerId = await getStudySessionOwner(sessionId)
  if (ownerId !== user!.id) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 })
  }

  // Get question detail
  const questionDetail = await fetchStudyQuestion(questionId)
  if (!questionDetail) {
    return NextResponse.json({ error: 'Question not found' }, { status: 404 })
  }

  const isCorrect = chosenIndex === questionDetail.correctIndex

  // Record answer
  await recordStudyAnswer(sessionId, user!.id, questionId, chosenIndex, isCorrect, timeSpentMs)

  // Get exam for this session
  const { rows: sessionRows } = await getPool().query(
    `SELECT exam_id FROM study_sessions WHERE id = $1`,
    [sessionId]
  )
  const examId = (sessionRows[0] as { exam_id: string }).exam_id

  // Get current mastery for this topic
  const { rows: masteryRows } = await getPool().query(
    `SELECT mastery_probability FROM user_topic_mastery WHERE user_id = $1 AND topic_id = $2`,
    [user!.id, questionDetail.topicId]
  )
  const priorMastery = masteryRows.length > 0
    ? parseFloat((masteryRows[0] as { mastery_probability: string }).mastery_probability)
    : 0.3

  // Get current SM-2 record
  const { rows: schedRows } = await getPool().query(
    `SELECT interval_days, ease_factor, repetition_count FROM user_question_schedule WHERE user_id = $1 AND question_id = $2`,
    [user!.id, questionId]
  )
  const sm2Record = schedRows.length > 0
    ? {
        intervalDays: parseFloat((schedRows[0] as { interval_days: string }).interval_days),
        easeFactor: parseFloat((schedRows[0] as { ease_factor: string }).ease_factor),
        repetitionCount: parseInt((schedRows[0] as { repetition_count: string }).repetition_count, 10),
      }
    : defaultSm2Record()

  // Run engines
  const newMastery = updateMastery(priorMastery, isCorrect)
  const quality = qualityFromCorrect(isCorrect, timeSpentMs)
  const sm2Result = sm2Update(sm2Record, quality, new Date())

  // Persist updates
  await Promise.all([
    upsertQuestionSchedule(user!.id, questionId, sm2Result),
    updateTopicMastery(user!.id, questionDetail.topicId, newMastery),
  ])

  // Select next question
  const candidates = await getDueQuestions(user!.id, examId)
  const remaining = candidates.filter(q => q.id !== questionId)
  const nextQ = selectNextStudyQuestion(remaining, new Date())

  const nextDetail = nextQ ? await fetchStudyQuestion(nextQ.id) : null

  return NextResponse.json({
    success: true,
    data: {
      isCorrect,
      explanation: questionDetail.explanation,
      newMastery,
      done: !nextDetail,
      question: nextDetail,
    },
    error: null,
  })
}
