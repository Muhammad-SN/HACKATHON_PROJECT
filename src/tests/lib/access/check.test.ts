import { describe, it, expect } from 'vitest'
import { checkExamAccess } from '@/lib/access/check'

const BASE = {
  examId:               'exam-1',
  ownerId:              'owner-1',
  stakesLevel:          'low' as const,
  isPublic:             true,
  classificationSource: 'manual' as const,
}

describe('checkExamAccess', () => {
  it('denies access when classificationSource is pending_review', () => {
    const result = checkExamAccess(
      { ...BASE, classificationSource: 'pending_review' },
      { userId: 'user-1', tier: 'premium', hasExamPurchase: true }
    )
    expect(result.granted).toBe(false)
    expect(result.reason).toContain('pending')
  })

  it('grants access for public low-stakes exam to any authenticated user', () => {
    const result = checkExamAccess(
      { ...BASE, stakesLevel: 'low', isPublic: true },
      { userId: 'user-2', tier: 'free', hasExamPurchase: false }
    )
    expect(result.granted).toBe(true)
  })

  it('grants access for private low-stakes exam to its creator', () => {
    const result = checkExamAccess(
      { ...BASE, stakesLevel: 'low', isPublic: false },
      { userId: 'owner-1', tier: 'free', hasExamPurchase: false }
    )
    expect(result.granted).toBe(true)
  })

  it('denies access for private low-stakes exam to non-creator', () => {
    const result = checkExamAccess(
      { ...BASE, stakesLevel: 'low', isPublic: false },
      { userId: 'user-2', tier: 'free', hasExamPurchase: false }
    )
    expect(result.granted).toBe(false)
  })

  it('grants access for high-stakes exam when user has purchased it', () => {
    const result = checkExamAccess(
      { ...BASE, stakesLevel: 'high' },
      { userId: 'user-2', tier: 'free', hasExamPurchase: true }
    )
    expect(result.granted).toBe(true)
  })

  it('denies high-stakes exam even for premium users without purchase', () => {
    const result = checkExamAccess(
      { ...BASE, stakesLevel: 'high' },
      { userId: 'user-2', tier: 'premium', hasExamPurchase: false }
    )
    expect(result.granted).toBe(false)
  })
})
