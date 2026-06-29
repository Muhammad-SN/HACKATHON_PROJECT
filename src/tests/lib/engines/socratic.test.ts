import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockCreate = vi.hoisted(() => vi.fn())
vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: { create: mockCreate },
  })),
}))

import { generateSocraticExplanation } from '@/lib/engines/socratic'

const INCORRECT_PARAMS = {
  questionStem:  'Which organelle produces ATP?',
  chosenOption:  'Ribosome',
  correctOption: 'Mitochondria',
  isCorrect:     false,
  model:         'claude-haiku-4-5-20251001',
  apiKey:        'test-key',
}

describe('generateSocraticExplanation', () => {
  beforeEach(() => { mockCreate.mockReset() })

  it('returns exactly 3 steps for an incorrect answer', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: 'You chose ribosome because it makes proteins|||The key insight is ATP is about energy|||Mitochondria is the powerhouse of the cell' }],
      usage: { input_tokens: 120, output_tokens: 60 },
    })
    const result = await generateSocraticExplanation(INCORRECT_PARAMS)
    expect(result.steps).toHaveLength(3)
    expect(result.steps[0]).toBe('You chose ribosome because it makes proteins')
    expect(result.steps[1]).toBe('The key insight is ATP is about energy')
    expect(result.steps[2]).toBe('Mitochondria is the powerhouse of the cell')
  })

  it('returns exactly 1 step for a correct answer', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: 'Mitochondria converts glucose to ATP via oxidative phosphorylation.' }],
      usage: { input_tokens: 80, output_tokens: 30 },
    })
    const result = await generateSocraticExplanation({ ...INCORRECT_PARAMS, isCorrect: true })
    expect(result.steps).toHaveLength(1)
    expect(result.steps[0]).toContain('Mitochondria')
  })

  it('calls Anthropic with the correct model', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: 'A|||B|||C' }],
      usage: { input_tokens: 100, output_tokens: 50 },
    })
    await generateSocraticExplanation({ ...INCORRECT_PARAMS, model: 'claude-sonnet-4-6' })
    expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({ model: 'claude-sonnet-4-6' }))
  })

  it('returns token counts from the API response', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: 'A|||B|||C' }],
      usage: { input_tokens: 200, output_tokens: 75 },
    })
    const result = await generateSocraticExplanation(INCORRECT_PARAMS)
    expect(result.inputTokens).toBe(200)
    expect(result.outputTokens).toBe(75)
  })

  it('handles malformed response without delimiters — returns at least 1 step', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: 'A single sentence with no delimiters.' }],
      usage: { input_tokens: 50, output_tokens: 15 },
    })
    const result = await generateSocraticExplanation(INCORRECT_PARAMS)
    expect(result.steps.length).toBeGreaterThanOrEqual(1)
  })

  it('propagates Anthropic SDK errors', async () => {
    mockCreate.mockRejectedValueOnce(new Error('API rate limit exceeded'))
    await expect(generateSocraticExplanation(INCORRECT_PARAMS)).rejects.toThrow('API rate limit exceeded')
  })
})
