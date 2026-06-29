import { describe, it, expect } from 'vitest'
import { classifyByRules } from '@/lib/access/classifier'

describe('classifyByRules', () => {
  it('returns high for USMLE in title', () => {
    expect(classifyByRules('USMLE Step 1', '')).toBe('high')
  })

  it('returns high for bar exam keyword', () => {
    expect(classifyByRules('Bar Exam Practice', '')).toBe('high')
  })

  it('returns low for generic quiz title', () => {
    expect(classifyByRules('General Biology Quiz', '')).toBe('low')
  })

  it('returns null when rules are inconclusive', () => {
    expect(classifyByRules('My Custom Exam', 'A custom exam for my team')).toBeNull()
  })
})
