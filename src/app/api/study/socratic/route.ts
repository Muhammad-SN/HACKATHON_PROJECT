import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/api/auth-guard'
import Anthropic from '@anthropic-ai/sdk'
import { trackUsage } from '@/lib/ai/usage'

const Schema = z.object({
  questionStem: z.string().min(1).max(2000),
  chosenOption: z.string().min(1).max(500),
  correctOption: z.string().min(1).max(500),
  isCorrect: z.boolean(),
})

const anthropic = new Anthropic({ apiKey: process.env['ANTHROPIC_API_KEY'] })

export async function POST(req: Request) {
  const { user, error } = await requireAuth()
  if (error) return error

  let body: unknown
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const parsed = Schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request' }, { status: 422 })

  const { questionStem, chosenOption, correctOption, isCorrect } = parsed.data

  const model = user!.tier === 'premium' ? 'claude-sonnet-4-6' : 'claude-haiku-4-5-20251001'

  const prompt = isCorrect
    ? `The student answered correctly. Reinforce their understanding with a brief 2-sentence Socratic explanation of WHY this answer is right, encouraging deeper thinking.

Question: ${questionStem}
Correct answer: ${correctOption}`
    : `The student answered incorrectly. Using the Socratic method, guide them to understand why their answer was wrong without simply stating the correct answer.

Question: ${questionStem}
Student chose: ${chosenOption}
Correct answer: ${correctOption}

Write 2-3 sentences that ask guiding questions and help them reason through the correct answer.`

  try {
    const message = await anthropic.messages.create({
      model,
      max_tokens: 300,
      messages: [{ role: 'user', content: prompt }],
    })

    const text = message.content[0]?.type === 'text' ? message.content[0].text : ''

    await trackUsage(user!.id, 'socratic_explanation', model, message.usage.input_tokens, message.usage.output_tokens)

    return NextResponse.json({ success: true, data: { explanation: text }, error: null })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'AI error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
