import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/api/auth-guard'
import { createStudySession, getDueQuestions, fetchStudyQuestion } from '@/lib/db/study'
import { selectNextStudyQuestion } from '@/lib/engines/selector'

const Schema = z.object({ examId: z.string().uuid() })

export async function POST(req: Request) {
  const { user, error } = await requireAuth()
  if (error) return error

  let body: unknown
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const parsed = Schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request' }, { status: 422 })

  const { examId } = parsed.data
  const sessionId = await createStudySession(user!.id, examId)
  const candidates = await getDueQuestions(user!.id, examId)
  const selected = selectNextStudyQuestion(candidates, new Date())

  if (!selected) {
    return NextResponse.json({ success: true, data: { sessionId, question: null, done: true }, error: null })
  }

  const detail = await fetchStudyQuestion(selected.id)
  return NextResponse.json({
    success: true,
    data: { sessionId, question: detail, done: false },
    error: null,
  })
}
