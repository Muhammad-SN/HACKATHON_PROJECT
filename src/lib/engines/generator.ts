import Anthropic from '@anthropic-ai/sdk'

export interface GeneratedQuestion {
  stem:         string
  choices:      [string, string, string, string]
  correctIndex: number
  explanation:  string
  topic:        string
}

export interface GeneratorResult {
  questions:    GeneratedQuestion[]
  inputTokens:  number
  outputTokens: number
}

export interface GeneratorParams {
  chunk:  string
  topic:  string
  model:  string
  count?: number
  apiKey: string
}

export async function generateQuestionsFromChunk(params: GeneratorParams): Promise<GeneratorResult> {
  const { chunk, topic, model, count = 5, apiKey } = params
  const client = new Anthropic({ apiKey })

  const msg = await client.messages.create({
    model,
    max_tokens: 2000,
    messages: [{
      role: 'user',
      content: `Generate exactly ${count} multiple-choice questions from the study material below.

Topic: ${topic}

Study material:
${chunk}

Return ONLY a JSON array. Each element must match this shape exactly:
{
  "stem": "the question text",
  "choices": ["option A", "option B", "option C", "option D"],
  "correctIndex": 0,
  "explanation": "why this answer is correct",
  "topic": "${topic}"
}

Rules:
- correctIndex is the 0-based index of the correct choice in the choices array
- All 4 choices must be plausible (no obviously wrong distractors)
- Explanation must reference specific content from the study material
- Return ONLY the JSON array — no markdown, no preamble, no explanation outside the array`,
    }],
  })

  const text = msg.content[0]?.type === 'text' ? msg.content[0].text.trim() : '[]'

  let questions: GeneratedQuestion[] = []
  try {
    const parsed: unknown = JSON.parse(text)
    if (Array.isArray(parsed)) {
      questions = parsed as GeneratedQuestion[]
    }
  } catch {
    questions = []
  }

  return {
    questions,
    inputTokens:  msg.usage.input_tokens,
    outputTokens: msg.usage.output_tokens,
  }
}
