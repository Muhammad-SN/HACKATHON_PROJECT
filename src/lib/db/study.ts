import { getPool } from '@/lib/db/pool'
import type { StudyQuestionWithSchedule } from '@/lib/engines/selector'
import type { Sm2Update } from '@/lib/engines/sm2'

export async function createStudySession(userId: string, examId: string): Promise<string> {
  const { rows } = await getPool().query(
    `INSERT INTO study_sessions (user_id, exam_id, session_type) VALUES ($1, $2, 'adaptive') RETURNING id`,
    [userId, examId]
  )
  return (rows[0] as { id: string }).id
}

export async function getDueQuestions(
  userId: string,
  examId: string,
  limit = 20
): Promise<StudyQuestionWithSchedule[]> {
  const { rows } = await getPool().query(
    `SELECT
       q.id, q.topic_id, q.difficulty, q.discrimination,
       COALESCE(s.interval_days, 1)         AS interval_days,
       COALESCE(s.ease_factor, 2.5)         AS ease_factor,
       COALESCE(s.repetition_count, 0)      AS repetition_count,
       COALESCE(s.next_review_at, NOW())    AS next_review_at,
       COALESCE(m.mastery_probability, 0.3) AS topic_mastery
     FROM questions q
     JOIN exam_topics et ON et.id = q.topic_id
     LEFT JOIN user_question_schedule s ON s.question_id = q.id AND s.user_id = $1
     LEFT JOIN user_topic_mastery m ON m.topic_id = q.topic_id AND m.user_id = $1
     WHERE q.exam_id = $2
     ORDER BY COALESCE(s.next_review_at, NOW()) ASC
     LIMIT $3`,
    [userId, examId, limit]
  )
  return rows.map((r) => ({
    id: r.id as string,
    topicId: r.topic_id as string,
    difficulty: parseFloat(r.difficulty as string),
    discrimination: parseFloat(r.discrimination as string),
    topicMastery: parseFloat(r.topic_mastery as string),
    schedule: {
      intervalDays: parseFloat(r.interval_days as string),
      easeFactor: parseFloat(r.ease_factor as string),
      repetitionCount: parseInt(r.repetition_count as string, 10),
      nextReviewAt: new Date(r.next_review_at as string),
    },
  }))
}

export async function upsertQuestionSchedule(
  userId: string,
  questionId: string,
  update: Sm2Update
): Promise<void> {
  await getPool().query(
    `INSERT INTO user_question_schedule (user_id, question_id, next_review_at, interval_days, ease_factor, repetition_count)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (user_id, question_id) DO UPDATE
       SET next_review_at = $3, interval_days = $4, ease_factor = $5, repetition_count = $6`,
    [userId, questionId, update.nextReviewAt, update.intervalDays, update.easeFactor, update.repetitionCount]
  )
}

export async function updateTopicMastery(
  userId: string,
  topicId: string,
  mastery: number
): Promise<void> {
  await getPool().query(
    `INSERT INTO user_topic_mastery (user_id, topic_id, mastery_probability, attempts)
     VALUES ($1, $2, $3, 1)
     ON CONFLICT (user_id, topic_id) DO UPDATE
       SET mastery_probability = $3, attempts = user_topic_mastery.attempts + 1, last_updated = NOW()`,
    [userId, topicId, mastery]
  )
}

export async function getStudySessionOwner(sessionId: string): Promise<string | null> {
  const { rows } = await getPool().query(
    `SELECT user_id FROM study_sessions WHERE id = $1`,
    [sessionId]
  )
  return rows.length > 0 ? (rows[0] as { user_id: string }).user_id : null
}

export async function fetchStudyQuestion(questionId: string): Promise<{
  id: string; stem: string; options: string[]; correctIndex: number; explanation: string; topicId: string; difficulty: number; discrimination: number
} | null> {
  const { rows } = await getPool().query(
    `SELECT id, stem, options, correct_index, explanation, topic_id, difficulty, discrimination FROM questions WHERE id = $1`,
    [questionId]
  )
  if (rows.length === 0) return null
  const r = rows[0] as {
    id: string; stem: string; options: unknown; correct_index: number; explanation: string;
    topic_id: string; difficulty: string; discrimination: string
  }
  return {
    id: r.id,
    stem: r.stem,
    options: r.options as string[],
    correctIndex: r.correct_index,
    explanation: r.explanation,
    topicId: r.topic_id,
    difficulty: parseFloat(r.difficulty),
    discrimination: parseFloat(r.discrimination),
  }
}

export async function recordStudyAnswer(
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
