import Anthropic from '@anthropic-ai/sdk'
import type { StakesLevel } from './check'

const HIGH_STAKES_KEYWORDS = [
  /usmle/i, /nclex/i, /mcat/i, /lsat/i, /gmat/i, /gre/i, /bar exam/i,
  /cpa exam/i, /cfa exam/i, /series 7/i, /pmp exam/i, /cissp/i,
  /board exam/i, /licensing exam/i, /certification exam/i,
]

const LOW_STAKES_KEYWORDS = [
  /quiz/i, /trivia/i, /practice set/i, /homework/i, /flashcard/i,
  /chapter review/i, /study guide/i,
]

export function classifyByRules(title: string, description: string): StakesLevel | null {
  const text = `${title} ${description}`
  if (HIGH_STAKES_KEYWORDS.some((r) => r.test(text))) return 'high'
  if (LOW_STAKES_KEYWORDS.some((r) => r.test(text))) return 'low'
  return null
}

export async function classifyWithAI(title: string, description: string): Promise<StakesLevel> {
  const anthropic = new Anthropic({ apiKey: process.env['ANTHROPIC_API_KEY'] })

  const message = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 10,
    messages: [{
      role: 'user',
      content: `Classify this exam as "high" (professional licensing, medical board, bar exam, finance certification) or "low" (general quiz, practice set, study material).

Title: ${title}
Description: ${description}

Reply with exactly one word: high or low`,
    }],
  })

  const text = message.content[0]?.type === 'text'
    ? message.content[0].text.trim().toLowerCase()
    : 'low'
  return text === 'high' ? 'high' : 'low'
}

export async function classifyExam(title: string, description: string): Promise<StakesLevel> {
  const rulesResult = classifyByRules(title, description)
  if (rulesResult !== null) return rulesResult
  return classifyWithAI(title, description)
}
