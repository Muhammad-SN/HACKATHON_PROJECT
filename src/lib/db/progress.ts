import { getPool } from '@/lib/db/pool'

export interface TopicMasteryRow {
  topicId: string
  topicName: string
  mastery: number
  weight: number
  attempts: number
}

export async function getUserTopicMastery(userId: string, examId: string): Promise<TopicMasteryRow[]> {
  const { rows } = await getPool().query(
    `SELECT
       et.id             AS topic_id,
       et.name           AS topic_name,
       et.weight::float  AS weight,
       COALESCE(m.mastery_probability, 0.3) AS mastery_probability,
       COALESCE(m.attempts, 0)              AS attempts
     FROM exam_topics et
     LEFT JOIN user_topic_mastery m ON m.topic_id = et.id AND m.user_id = $1
     WHERE et.exam_id = $2
     ORDER BY et.weight DESC`,
    [userId, examId]
  )
  return rows.map((r) => ({
    topicId:   r.topic_id   as string,
    topicName: r.topic_name as string,
    mastery:   parseFloat(r.mastery_probability as string),
    weight:    parseFloat(r.weight as string),
    attempts:  parseInt(r.attempts as string, 10),
  }))
}

export async function getWeakTopics(userId: string, examId: string, limit: number): Promise<TopicMasteryRow[]> {
  const { rows } = await getPool().query(
    `SELECT
       et.id             AS topic_id,
       et.name           AS topic_name,
       et.weight::float  AS weight,
       COALESCE(m.mastery_probability, 0.3) AS mastery_probability,
       COALESCE(m.attempts, 0)              AS attempts
     FROM exam_topics et
     LEFT JOIN user_topic_mastery m ON m.topic_id = et.id AND m.user_id = $1
     WHERE et.exam_id = $2
     ORDER BY COALESCE(m.mastery_probability, 0.3) ASC
     LIMIT $3`,
    [userId, examId, limit]
  )
  return rows.map((r) => ({
    topicId:   r.topic_id   as string,
    topicName: r.topic_name as string,
    mastery:   parseFloat(r.mastery_probability as string),
    weight:    parseFloat(r.weight as string),
    attempts:  parseInt(r.attempts as string, 10),
  }))
}
