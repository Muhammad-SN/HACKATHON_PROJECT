import { getPool } from '@/lib/db/pool'

export interface ExamRow {
  id:                   string
  title:                string
  description:          string
  stakesLevel:          'low' | 'high'
  isPublic:             boolean
  ownerId:              string
  ownerName:            string
  questionCount:        number
  classificationSource: string
}

export async function listCommunityExams(search?: string): Promise<ExamRow[]> {
  const hasSearch = Boolean(search?.trim())
  const query = `
    SELECT e.id, e.name, e.description, e.stakes_level, e.is_public, e.created_by,
           u.name AS owner_name, e.classification_source,
           COUNT(q.id)::int AS question_count
    FROM exams e
    JOIN users u ON u.id = e.created_by
    LEFT JOIN questions q ON q.exam_id = e.id
    WHERE e.is_public = true
      AND e.classification_source != 'pending_review'
      ${hasSearch ? "AND (e.name ILIKE $1 OR e.description ILIKE $1)" : ''}
    GROUP BY e.id, u.name
    ORDER BY e.created_at DESC
    LIMIT 50`

  const params = hasSearch ? [`%${search!.trim()}%`] : []
  const { rows } = await getPool().query(query, params)
  return rows.map(mapExamRow)
}

export async function listMyExams(userId: string): Promise<ExamRow[]> {
  const { rows } = await getPool().query(
    `SELECT e.id, e.name, e.description, e.stakes_level, e.is_public, e.created_by,
            u.name AS owner_name, e.classification_source,
            COUNT(q.id)::int AS question_count
     FROM exams e
     JOIN users u ON u.id = e.created_by
     LEFT JOIN questions q ON q.exam_id = e.id
     WHERE e.created_by = $1
     GROUP BY e.id, u.name
     ORDER BY e.created_at DESC`,
    [userId]
  )
  return rows.map(mapExamRow)
}

export async function getExamForAccessCheck(examId: string): Promise<{
  ownerId:              string
  stakesLevel:          'low' | 'high'
  isPublic:             boolean
  classificationSource: string
} | null> {
  const { rows } = await getPool().query(
    `SELECT created_by, stakes_level, is_public, classification_source FROM exams WHERE id = $1`,
    [examId]
  )
  if (rows.length === 0) return null
  const r = rows[0] as {
    created_by:            string
    stakes_level:          string
    is_public:             boolean
    classification_source: string
  }
  return {
    ownerId:              r.created_by,
    stakesLevel:          r.stakes_level as 'low' | 'high',
    isPublic:             r.is_public,
    classificationSource: r.classification_source,
  }
}

function mapExamRow(r: Record<string, unknown>): ExamRow {
  return {
    id:                   r['id']                    as string,
    title:                r['name']                  as string,
    description:          (r['description'] ?? '')   as string,
    stakesLevel:          r['stakes_level']          as 'low' | 'high',
    isPublic:             r['is_public']             as boolean,
    ownerId:              r['created_by']            as string,
    ownerName:            r['owner_name']            as string,
    questionCount:        r['question_count']        as number,
    classificationSource: r['classification_source'] as string,
  }
}
