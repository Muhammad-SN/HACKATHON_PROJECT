import { describe, it, expect } from 'vitest'
import {
  calculateProbability,
  calculateInformation,
  estimateAbility,
  selectNextQuestion,
  shouldStopDiagnostic,
} from '@/lib/engines/cold-start'
import type { IrtAnswer, IrtQuestion } from '@/lib/engines/cold-start'

const q = (id: string, b = 0.5, a = 1.0, topicId = 't1'): IrtQuestion => ({ id, difficulty: b, discrimination: a, topicId })

describe('calculateProbability', () => {
  it('returns 0.5 when theta equals difficulty', () => {
    const p = calculateProbability(0.5, 1.0, 0.5)
    expect(p).toBeCloseTo(0.5, 2)
  })
  it('returns >0.5 when theta > difficulty', () => {
    expect(calculateProbability(1.0, 1.0, 0.5)).toBeGreaterThan(0.5)
  })
  it('returns <0.5 when theta < difficulty', () => {
    expect(calculateProbability(0.0, 1.0, 0.5)).toBeLessThan(0.5)
  })
  it('stays in (0,1) range', () => {
    const p = calculateProbability(-3, 2.0, 2.0)
    expect(p).toBeGreaterThan(0)
    expect(p).toBeLessThan(1)
  })
})

describe('calculateInformation', () => {
  it('returns positive value', () => {
    expect(calculateInformation(0, 1.0, 0)).toBeGreaterThan(0)
  })
  it('is maximized when theta equals difficulty', () => {
    const atDifficulty = calculateInformation(0.5, 1.0, 0.5)
    const away = calculateInformation(2.0, 1.0, 0.5)
    expect(atDifficulty).toBeGreaterThan(away)
  })
})

describe('estimateAbility', () => {
  it('returns 0 for empty answers', () => {
    expect(estimateAbility([])).toBe(0)
  })
  it('returns higher theta for all-correct answers', () => {
    const answers: IrtAnswer[] = [
      { question: q('q1', 0.0), correct: true },
      { question: q('q2', 0.5), correct: true },
      { question: q('q3', 1.0), correct: true },
    ]
    expect(estimateAbility(answers)).toBeGreaterThan(0)
  })
  it('returns lower theta for all-wrong answers', () => {
    const answers: IrtAnswer[] = [
      { question: q('q1', 0.0), correct: false },
      { question: q('q2', 0.5), correct: false },
    ]
    expect(estimateAbility(answers)).toBeLessThan(0)
  })
  it('clamps to [-4, 4]', () => {
    const allCorrect: IrtAnswer[] = Array.from({ length: 20 }, (_, i) => ({
      question: q(`q${i}`, 3.0, 2.0),
      correct: true,
    }))
    expect(estimateAbility(allCorrect)).toBeLessThanOrEqual(4)
  })
})

describe('selectNextQuestion', () => {
  it('returns null when no candidates', () => {
    expect(selectNextQuestion(0, [], new Set())).toBeNull()
  })
  it('returns null when all candidates answered', () => {
    expect(selectNextQuestion(0, [q('q1')], new Set(['q1']))).toBeNull()
  })
  it('selects the question with highest information at current theta', () => {
    const candidates = [q('q1', 2.0, 1.0), q('q2', 0.0, 1.0)]
    const selected = selectNextQuestion(0, candidates, new Set())
    expect(selected?.id).toBe('q2')
  })
  it('skips already-answered questions', () => {
    const candidates = [q('q1', 0.0), q('q2', 1.0)]
    const selected = selectNextQuestion(0, candidates, new Set(['q1']))
    expect(selected?.id).toBe('q2')
  })
})

describe('shouldStopDiagnostic', () => {
  it('stops at 20 answers', () => {
    const answers: IrtAnswer[] = Array.from({ length: 20 }, (_, i) => ({
      question: q(`q${i}`, 0.5, 1.0),
      correct: i % 2 === 0,
    }))
    expect(shouldStopDiagnostic(20, answers)).toBe(true)
  })
  it('continues at fewer than 20 with low information', () => {
    const answers: IrtAnswer[] = [{ question: q('q1', 0.5, 1.0), correct: true }]
    expect(shouldStopDiagnostic(1, answers)).toBe(false)
  })
  it('stops when SE < 0.3 with many high-discrimination questions', () => {
    const answers: IrtAnswer[] = Array.from({ length: 15 }, (_, i) => ({
      question: q(`q${i}`, 0.0, 3.0),
      correct: i % 2 === 0,
    }))
    expect(shouldStopDiagnostic(15, answers)).toBe(true)
  })
})
