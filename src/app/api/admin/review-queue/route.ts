import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/api/auth-guard'
import { getReviewQueue, getAuditLog } from '@/lib/db/admin'

export const dynamic = 'force-dynamic'

export async function GET(_req: Request) {
  const { error } = await requireAdmin()
  if (error) return error

  const [queue, auditLog] = await Promise.all([getReviewQueue(), getAuditLog()])
  return NextResponse.json({ success: true, data: { queue, auditLog }, error: null })
}
