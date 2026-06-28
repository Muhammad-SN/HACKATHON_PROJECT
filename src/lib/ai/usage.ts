import { getPool } from '@/lib/db/pool'

export async function trackUsage(
  userId: string,
  eventType: string,
  model: string,
  inputTokens: number,
  outputTokens: number
): Promise<void> {
  await getPool().query(
    `INSERT INTO usage_events (user_id, event_type, model, input_tokens, output_tokens)
     VALUES ($1, $2, $3, $4, $5)`,
    [userId, eventType, model, inputTokens, outputTokens]
  )
}
