import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { requireAuth } from '@/lib/api/auth-guard'
import { searchPublicExams } from '@/lib/db/exams'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const { error } = await requireAuth()
  if (error) return error

  const q = req.nextUrl.searchParams.get('q') ?? ''
  const results = await searchPublicExams(q)

  return NextResponse.json({ success: true, data: results, error: null })
}
