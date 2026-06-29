import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api/auth-guard'
import { getOrCreateStripeCustomer } from '@/lib/stripe/customer'
import { createExamPurchaseCheckout } from '@/lib/stripe/checkout'
import { getPool } from '@/lib/db/pool'

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ examId: string }> }
) {
  const { user, error } = await requireAuth()
  if (error) return error

  const { examId } = await params
  if (!examId) return NextResponse.json({ error: 'Missing examId' }, { status: 422 })

  const { rows } = await getPool().query(
    `SELECT title, purchase_price FROM exams WHERE id = $1 AND stakes_level = 'high'`,
    [examId]
  )
  if (rows.length === 0) {
    return NextResponse.json({ error: 'Exam not found or not purchasable' }, { status: 404 })
  }

  const exam       = rows[0] as { title: string; purchase_price: string }
  const customerId = await getOrCreateStripeCustomer(user!.id, user!.email ?? '')
  const url        = await createExamPurchaseCheckout(
    customerId, user!.id, examId, exam.title, parseFloat(exam.purchase_price)
  )

  return NextResponse.json({ success: true, data: { url }, error: null })
}
