import Anthropic from '@anthropic-ai/sdk'
import { getClient } from './db'
import { chunkText } from './chunker'

const anthropic = new Anthropic({ apiKey: process.env['ANTHROPIC_API_KEY'] })

interface GeneratedQuestion {
  stem: string
  options: string[]
  correctIndex: number
  explanation: string
  difficulty: number
}

async function generateQuestionsForChunk(chunk: string): Promise<GeneratedQuestion[]> {
  const prompt = `You are a question writer for an exam preparation platform. Generate 5 multiple-choice questions from this text. Return a JSON array with objects: { stem, options (4 strings), correctIndex (0-3), explanation, difficulty (0.1-0.9) }. Return ONLY valid JSON, no other text.

Text:
${chunk}`

  const message = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 2048,
    messages: [{ role: 'user', content: prompt }],
  })

  const content = message.content[0]
  if (content?.type !== 'text') return []
  try {
    const parsed = JSON.parse(content.text) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter((q): q is GeneratedQuestion =>
      typeof q === 'object' && q !== null &&
      typeof (q as GeneratedQuestion).stem === 'string' &&
      Array.isArray((q as GeneratedQuestion).options) &&
      typeof (q as GeneratedQuestion).correctIndex === 'number'
    )
  } catch {
    return []
  }
}

export async function processJob(payload: {
  jobId: string
  examId: string
  userId: string
  sourceType: 'text' | 'pdf'
  text?: string
}): Promise<void> {
  const db = await getClient()
  await db.query(`UPDATE document_jobs SET status = 'processing' WHERE id = $1`, [payload.jobId])

  try {
    const text = payload.text ?? ''
    if (!text.trim()) throw new Error('No text content provided')

    const chunks = chunkText(text)
    const limited = chunks.slice(0, 10) // max 10 chunks = 50 questions per upload
    let totalGenerated = 0

    // Ensure at least one topic exists for this exam
    const topicRes = await db.query(
      `SELECT id FROM exam_topics WHERE exam_id = $1 LIMIT 1`,
      [payload.examId]
    )
    let topicId: string
    if (topicRes.rows.length > 0) {
      topicId = (topicRes.rows[0] as { id: string }).id
    } else {
      const newTopic = await db.query(
        `INSERT INTO exam_topics (exam_id, name, weight) VALUES ($1, 'General', 0.1) RETURNING id`,
        [payload.examId]
      )
      topicId = (newTopic.rows[0] as { id: string }).id
    }

    for (const chunk of limited) {
      try {
        const questions = await generateQuestionsForChunk(chunk)
        for (const q of questions) {
          if (q.options.length < 4) continue
          await db.query(
            `INSERT INTO questions (exam_id, topic_id, stem, options, correct_index, explanation, difficulty)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [payload.examId, topicId, q.stem, JSON.stringify(q.options), q.correctIndex, q.explanation, q.difficulty]
          )
          totalGenerated++
        }
      } catch {
        // skip failed chunk, continue with rest
      }
    }

    // Log usage event
    await db.query(
      `INSERT INTO usage_events (user_id, event_type, model) VALUES ($1, 'upload_text', 'claude-haiku-4-5-20251001')`,
      [payload.userId]
    )

    await db.query(
      `UPDATE document_jobs SET status = 'complete', questions_generated = $1, completed_at = NOW() WHERE id = $2`,
      [totalGenerated, payload.jobId]
    )

    // Auto-publish to community if enough questions generated
    if (totalGenerated >= 10) {
      await db.query(
        `UPDATE exams SET classification_source = 'rules_list' WHERE id = $1 AND classification_source = 'pending_review'`,
        [payload.examId]
      )
    }
  } catch (err) {
    const reason = err instanceof Error ? err.message : 'Unknown error'
    await db.query(
      `UPDATE document_jobs SET status = 'failed', failed_reason = $1 WHERE id = $2`,
      [reason, payload.jobId]
    )
    throw err
  }
}
