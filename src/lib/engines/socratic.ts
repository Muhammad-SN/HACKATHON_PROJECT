import Anthropic from '@anthropic-ai/sdk'

export interface SocraticResult {
  steps:        string[]
  inputTokens:  number
  outputTokens: number
}

export interface SocraticParams {
  questionStem:  string
  chosenOption:  string
  correctOption: string
  isCorrect:     boolean
  model:         string
  apiKey:        string
}

const DELIMITER = '|||'

export async function generateSocraticExplanation(params: SocraticParams): Promise<SocraticResult> {
  const { questionStem, chosenOption, correctOption, isCorrect, model, apiKey } = params
  const client = new Anthropic({ apiKey })

  if (isCorrect) {
    const msg = await client.messages.create({
      model,
      max_tokens: 200,
      messages: [{
        role: 'user',
        content: `The student answered correctly. Write one sentence reinforcing WHY this answer is correct to deepen understanding.

Question: ${questionStem}
Correct answer: ${correctOption}

One sentence only. No preamble.`,
      }],
    })
    const text = msg.content[0]?.type === 'text' ? msg.content[0].text.trim() : ''
    return { steps: [text], inputTokens: msg.usage.input_tokens, outputTokens: msg.usage.output_tokens }
  }

  const msg = await client.messages.create({
    model,
    max_tokens: 450,
    messages: [{
      role: 'user',
      content: `The student answered this question incorrectly. Guide them using the Socratic method — do NOT state the correct answer outright.

Question: ${questionStem}
Student chose: ${chosenOption}
Correct answer: ${correctOption}

Write exactly 3 steps separated by "${DELIMITER}":
1. Acknowledge what they were likely thinking ("You probably chose ${chosenOption} because...")
2. Surface the key conceptual gap ("The key thing that changes this is...")
3. Lead them to the correct reasoning without stating it ("Think about what ${correctOption} actually does...")

Format: Step1 text${DELIMITER}Step2 text${DELIMITER}Step3 text

No labels, no preamble — just the three steps separated by |||.`,
    }],
  })

  const text  = msg.content[0]?.type === 'text' ? msg.content[0].text.trim() : ''
  const raw   = text.split(DELIMITER).map((s) => s.trim()).filter(Boolean)
  const steps = raw.length >= 1
    ? raw.slice(0, 3)
    : ['Reflect on what makes this question unique and reconsider your initial reasoning.']

  return { steps, inputTokens: msg.usage.input_tokens, outputTokens: msg.usage.output_tokens }
}
