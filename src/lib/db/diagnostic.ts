import { getPool } from '@/lib/db/pool'
import type { IrtAnswer, IrtQuestion } from '@/lib/engines/cold-start'

export async function createDiagnosticSession(userId: string, examId: string): Promise<string> {
  const { rows } = await getPool().query(
    `INSERT INTO study_sessions (user_id, exam_id, session_type) VALUES ($1, $2, $3) RETURNING id`,
    [userId, examId, 'diagnostic']
  )
  return (rows[0] as { id: string }).id
}

export async function getUnansweredQuestions(sessionId: string, examId: string): Promise<IrtQuestion[]> {
  const { rows } = await getPool().query(
    `SELECT q.id, q.difficulty, q.discrimination, q.topic_id
     FROM questions q
     WHERE q.exam_id = $1
       AND q.id NOT IN (SELECT ae.question_id FROM answer_events ae WHERE ae.session_id = $2)`,
    [examId, sessionId]
  )
  return rows.map((r) => ({
    id:             r.id             as string,
    difficulty:     r.difficulty     as number,
    discrimination: r.discrimination as number,
    topicId:        r.topic_id       as string,
  }))
}

export async function recordAnswer(
  sessionId: string,
  userId: string,
  questionId: string,
  chosenIndex: number,
  isCorrect: boolean,
  timeSpentMs: number
): Promise<void> {
  await getPool().query(
    `INSERT INTO answer_events (session_id, user_id, question_id, chosen_index, is_correct, time_spent_ms)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [sessionId, userId, questionId, chosenIndex, isCorrect, timeSpentMs]
  )
}

export async function getSessionAnswers(sessionId: string): Promise<IrtAnswer[]> {
  const { rows } = await getPool().query(
    `SELECT ae.is_correct, q.difficulty, q.discrimination, q.topic_id, q.id AS question_id
     FROM answer_events ae
     JOIN questions q ON q.id = ae.question_id
     WHERE ae.session_id = $1
     ORDER BY ae.answered_at ASC`,
    [sessionId]
  )
  return rows.map((r) => ({
    correct: r.is_correct as boolean,
    question: {
      id:             r.question_id    as string,
      difficulty:     r.difficulty     as number,
      discrimination: r.discrimination as number,
      topicId:        r.topic_id       as string,
    },
  }))
}

export async function completeDiagnosticSession(sessionId: string): Promise<void> {
  await getPool().query(
    `UPDATE study_sessions SET ended_at = NOW() WHERE id = $1`,
    [sessionId]
  )
}

function computeMastery(correct: number, total: number): number {
  return 0.30 + 0.65 * (correct / total)
}

export async function seedTopicMastery(userId: string, answers: IrtAnswer[]): Promise<void> {
  if (answers.length === 0) return
  const topicStats = new Map<string, { correct: number; total: number }>()
  for (const { question, correct } of answers) {
    const existing = topicStats.get(question.topicId) ?? { correct: 0, total: 0 }
    topicStats.set(question.topicId, {
      correct: existing.correct + (correct ? 1 : 0),
      total: existing.total + 1,
    })
  }
  for (const [topicId, { correct, total }] of topicStats) {
    const mastery = computeMastery(correct, total)
    await getPool().query(
      `INSERT INTO user_topic_mastery (user_id, topic_id, mastery_probability, attempts)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id, topic_id)
       DO UPDATE SET mastery_probability = $3, attempts = $4, last_updated = NOW()`,
      [userId, topicId, mastery, total]
    )
  }
}
