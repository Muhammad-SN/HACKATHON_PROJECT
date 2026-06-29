import { getPool } from '@/lib/db/pool'

export interface ReviewQueueRow {
  id:            string
  title:         string
  description:   string
  ownerName:     string
  questionCount: number
  createdAt:     Date
}

export interface AuditLogRow {
  id:          string
  adminId:     string
  adminName:   string
  action:      string
  targetId:    string
  targetTitle: string
  createdAt:   Date
}

export async function getReviewQueue(): Promise<ReviewQueueRow[]> {
  const { rows } = await getPool().query(
    `SELECT e.id, e.name, e.description, u.name AS owner_name,
            e.created_at, COUNT(q.id)::int AS question_count
     FROM exams e
     JOIN users u ON u.id = e.created_by
     LEFT JOIN questions q ON q.exam_id = e.id
     WHERE e.classification_source = 'pending_review'
     GROUP BY e.id, u.name
     ORDER BY e.created_at ASC`
  )
  return rows.map((r) => ({
    id:            r.id             as string,
    title:         r.name           as string,
    description:   (r.description ?? '') as string,
    ownerName:     r.owner_name     as string,
    questionCount: r.question_count as number,
    createdAt:     new Date(r.created_at as string),
  }))
}

export async function getAuditLog(limit = 50): Promise<AuditLogRow[]> {
  const { rows } = await getPool().query(
    `SELECT al.id, al.actor_id, u.name AS admin_name, al.action,
            al.target_id, al.metadata, al.created_at
     FROM audit_log al
     JOIN users u ON u.id = al.actor_id
     ORDER BY al.created_at DESC
     LIMIT $1`,
    [limit]
  )
  return rows.map((r) => {
    const meta = (r.metadata ?? {}) as Record<string, unknown>
    return {
      id:          r.id         as string,
      adminId:     r.actor_id   as string,
      adminName:   r.admin_name as string,
      action:      r.action     as string,
      targetId:    (r.target_id ?? '') as string,
      targetTitle: (meta['title'] ?? '') as string,
      createdAt:   new Date(r.created_at as string),
    }
  })
}

export async function saveClassification(
  examId: string,
  stakesLevel: 'low' | 'high',
  source: 'rules_list' | 'admin_override'
): Promise<void> {
  await getPool().query(
    `UPDATE exams SET stakes_level = $2, classification_source = $3 WHERE id = $1`,
    [examId, stakesLevel, source]
  )
}

export async function publishExam(examId: string): Promise<void> {
  await getPool().query(
    `UPDATE exams SET is_public = true WHERE id = $1`,
    [examId]
  )
}

export async function logAdminAction(
  adminId: string,
  action: string,
  targetId: string,
  targetTitle: string
): Promise<void> {
  await getPool().query(
    `INSERT INTO audit_log (actor_id, action, target_type, target_id, metadata)
     VALUES ($1, $2, 'exam', $3, $4)`,
    [adminId, action, targetId, JSON.stringify({ title: targetTitle })]
  )
}
