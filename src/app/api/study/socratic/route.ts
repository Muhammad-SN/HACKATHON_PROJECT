import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/api/auth-guard'
import { generateSocraticExplanation } from '@/lib/engines/socratic'
import { trackUsage } from '@/lib/ai/usage'

const Schema = z.object({
  questionStem:  z.string().min(1).max(2000),
  chosenOption:  z.string().min(1).max(500),
  correctOption: z.string().min(1).max(500),
  isCorrect:     z.boolean(),
})

export async function POST(req: Request) {
  const { user, error } = await requireAuth()
  if (error) return error

  let body: unknown
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const parsed = Schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request' }, { status: 422 })

  const apiKey = process.env['ANTHROPIC_API_KEY']
  if (!apiKey) return NextResponse.json({ error: 'AI not configured' }, { status: 500 })

  const model = user!.tier === 'premium' ? 'claude-sonnet-4-6' : 'claude-haiku-4-5-20251001'

  try {
    const result = await generateSocraticExplanation({ ...parsed.data, model, apiKey })

    await trackUsage(user!.id, 'socratic_explanation', model, result.inputTokens, result.outputTokens)

    return NextResponse.json({
      success: true,
      data: {
        steps:       result.steps,
        explanation: result.steps.join('\n\n'),
      },
      error: null,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'AI error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
