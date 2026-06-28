import { getPool } from '@/lib/db/pool'

export interface ExamSearchResult {
  id: string
  name: string
  stakesLevel: 'low' | 'high'
  domain: string
  questionCount: number
}

const SEARCH_SQL = `
  SELECT e.id, e.name, e.stakes_level, e.domain, COUNT(q.id)::int AS question_count
  FROM exams e
  LEFT JOIN questions q ON q.exam_id = e.id
  WHERE e.is_public = TRUE
    AND e.classification_source != 'pending_review'
    AND to_tsvector('english', e.name || ' ' || COALESCE(e.description, ''))
        @@ websearch_to_tsquery('english', $1)
  GROUP BY e.id
  ORDER BY question_count DESC
  LIMIT 10
`

const BROWSE_SQL = `
  SELECT e.id, e.name, e.stakes_level, e.domain, COUNT(q.id)::int AS question_count
  FROM exams e
  LEFT JOIN questions q ON q.exam_id = e.id
  WHERE e.is_public = TRUE
    AND e.classification_source != 'pending_review'
  GROUP BY e.id
  ORDER BY question_count DESC
  LIMIT 10
`

export async function searchPublicExams(query: string): Promise<ExamSearchResult[]> {
  const trimmed = query.trim()
  const { rows } = trimmed
    ? await getPool().query(SEARCH_SQL, [trimmed])
    : await getPool().query(BROWSE_SQL, [])

  return rows.map((r) => ({
    id:            r.id             as string,
    name:          r.name           as string,
    stakesLevel:   r.stakes_level   as 'low' | 'high',
    domain:        r.domain         as string,
    questionCount: r.question_count as number,
  }))
}

export async function enrollUserInExam(userId: string, examId: string): Promise<void> {
  await getPool().query(
    'INSERT INTO user_exams (user_id, exam_id) VALUES ($1, $2) ON CONFLICT (user_id, exam_id) DO NOTHING',
    [userId, examId]
  )
}

export async function getUserExamCount(userId: string): Promise<number> {
  const { rows } = await getPool().query(
    'SELECT COUNT(*)::int AS count FROM user_exams WHERE user_id = $1',
    [userId]
  )
  return (rows[0] as { count: number } | undefined)?.count ?? 0
}
