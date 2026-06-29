import { getPool } from '@/lib/db/pool'

export async function getStripeCustomerId(userId: string): Promise<string | null> {
  const { rows } = await getPool().query(
    `SELECT stripe_customer_id FROM users WHERE id = $1 AND stripe_customer_id IS NOT NULL`,
    [userId]
  )
  return rows.length > 0 ? (rows[0] as { stripe_customer_id: string }).stripe_customer_id : null
}

export async function saveStripeCustomerId(userId: string, customerId: string): Promise<void> {
  await getPool().query(
    `UPDATE users SET stripe_customer_id = $2 WHERE id = $1`,
    [userId, customerId]
  )
}

export async function setUserPremium(userId: string): Promise<void> {
  await getPool().query(
    `UPDATE users SET tier = 'premium' WHERE id = $1`,
    [userId]
  )
}

export async function setUserFree(userId: string): Promise<void> {
  await getPool().query(
    `UPDATE users SET tier = 'free' WHERE id = $1`,
    [userId]
  )
}

export async function recordExamPurchase(
  userId: string, examId: string, stripeSessionId: string
): Promise<void> {
  await getPool().query(
    `INSERT INTO user_exam_purchases (user_id, exam_id, stripe_session_id)
     VALUES ($1, $2, $3)
     ON CONFLICT (user_id, exam_id) DO NOTHING`,
    [userId, examId, stripeSessionId]
  )
}

export async function hasExamAccess(userId: string, examId: string): Promise<boolean> {
  const { rows } = await getPool().query(
    `SELECT id FROM user_exam_purchases WHERE user_id = $1 AND exam_id = $2`,
    [userId, examId]
  )
  return rows.length > 0
}

export interface PurchaseRow {
  examId: string
  examTitle: string
  purchasedAt: Date
  stripeSessionId: string
}

export async function getPurchaseHistory(userId: string): Promise<PurchaseRow[]> {
  const { rows } = await getPool().query(
    `SELECT p.exam_id, e.title AS exam_title, p.created_at AS purchased_at, p.stripe_session_id
     FROM user_exam_purchases p
     JOIN exams e ON e.id = p.exam_id
     WHERE p.user_id = $1
     ORDER BY p.created_at DESC`,
    [userId]
  )
  return rows.map((r) => ({
    examId:          r.exam_id           as string,
    examTitle:       r.exam_title        as string,
    purchasedAt:     new Date(r.purchased_at as string),
    stripeSessionId: r.stripe_session_id as string,
  }))
}

export async function getUserTier(userId: string): Promise<'free' | 'premium'> {
  const { rows } = await getPool().query(
    `SELECT tier FROM users WHERE id = $1`,
    [userId]
  )
  return rows.length > 0 ? (rows[0] as { tier: 'free' | 'premium' }).tier : 'free'
}
