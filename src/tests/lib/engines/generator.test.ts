import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockCreate = vi.hoisted(() => vi.fn())
vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: { create: mockCreate },
  })),
}))

import { generateQuestionsFromChunk } from '@/lib/engines/generator'

const MOCK_QUESTIONS = [
  {
    stem:         'What is the function of mitochondria?',
    choices:      ['ATP production', 'Protein synthesis', 'DNA replication', 'Lipid storage'],
    correctIndex: 0,
    explanation:  'Mitochondria produce ATP via oxidative phosphorylation.',
    topic:        'Cell Biology',
  },
]

const BASE_PARAMS = {
  chunk:  'Mitochondria are organelles that produce ATP through oxidative phosphorylation.',
  topic:  'Cell Biology',
  model:  'claude-haiku-4-5-20251001',
  count:  1,
  apiKey: 'test-key',
}

describe('generateQuestionsFromChunk', () => {
  beforeEach(() => { mockCreate.mockReset() })

  it('returns parsed questions from a valid JSON response', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: JSON.stringify(MOCK_QUESTIONS) }],
      usage: { input_tokens: 300, output_tokens: 150 },
    })
    const result = await generateQuestionsFromChunk(BASE_PARAMS)
    expect(result.questions).toHaveLength(1)
    expect(result.questions[0]?.stem).toBe('What is the function of mitochondria?')
    expect(result.questions[0]?.correctIndex).toBe(0)
    expect(result.questions[0]?.choices).toHaveLength(4)
  })

  it('calls Anthropic with the specified model', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: JSON.stringify(MOCK_QUESTIONS) }],
      usage: { input_tokens: 300, output_tokens: 150 },
    })
    await generateQuestionsFromChunk({ ...BASE_PARAMS, model: 'claude-sonnet-4-6' })
    expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({ model: 'claude-sonnet-4-6' }))
  })

  it('returns empty array when API returns malformed JSON', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: 'Here are some questions in prose...' }],
      usage: { input_tokens: 50, output_tokens: 10 },
    })
    const result = await generateQuestionsFromChunk(BASE_PARAMS)
    expect(result.questions).toHaveLength(0)
  })

  it('returns empty array when API returns a non-array JSON value', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: '{"error":"something went wrong"}' }],
      usage: { input_tokens: 50, output_tokens: 10 },
    })
    const result = await generateQuestionsFromChunk(BASE_PARAMS)
    expect(result.questions).toHaveLength(0)
  })

  it('returns token counts from the API response', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: JSON.stringify(MOCK_QUESTIONS) }],
      usage: { input_tokens: 420, output_tokens: 200 },
    })
    const result = await generateQuestionsFromChunk(BASE_PARAMS)
    expect(result.inputTokens).toBe(420)
    expect(result.outputTokens).toBe(200)
  })

  it('propagates Anthropic SDK errors', async () => {
    mockCreate.mockRejectedValueOnce(new Error('overloaded_error'))
    await expect(generateQuestionsFromChunk(BASE_PARAMS)).rejects.toThrow('overloaded_error')
  })
})
