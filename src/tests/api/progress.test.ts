// src/tests/api/progress.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/api/auth-guard', () => ({
  requireAuth: vi.fn().mockResolvedValue({ user: { id: 'user-1', tier: 'free' }, error: null }),
}))
vi.mock('@/lib/db/progress', () => ({
  getUserTopicMastery: vi.fn(),
  getWeakTopics:       vi.fn(),
}))

import { GET as readinessGET } from '@/app/api/progress/readiness/route'
import { GET as masteryGET }   from '@/app/api/progress/mastery/route'
import { getUserTopicMastery, getWeakTopics } from '@/lib/db/progress'

const mockGetMastery = getUserTopicMastery as ReturnType<typeof vi.fn>
const mockGetWeak    = getWeakTopics       as ReturnType<typeof vi.fn>
beforeEach(() => vi.clearAllMocks())

describe('GET /api/progress/readiness', () => {
  it('returns 422 when examId is missing', async () => {
    const req = new Request('http://localhost/api/progress/readiness')
    expect((await readinessGET(req)).status).toBe(422)
  })

  it('returns predictedScore and confidenceInterval', async () => {
    mockGetMastery.mockResolvedValueOnce([
      { topicId: 't1', topicName: 'A', mastery: 0.8, weight: 0.5, attempts: 5 },
      { topicId: 't2', topicName: 'B', mastery: 0.6, weight: 0.5, attempts: 3 },
    ])
    const req = new Request('http://localhost/api/progress/readiness?examId=00000000-0000-0000-0000-000000000001')
    const body = (await (await readinessGET(req)).json()) as { data: { predictedScore: number; confidenceInterval: number } }
    expect(body.data.predictedScore).toBeGreaterThan(0)
    expect(typeof body.data.confidenceInterval).toBe('number')
  })
})

describe('GET /api/progress/mastery', () => {
  it('returns 422 when examId is missing', async () => {
    const req = new Request('http://localhost/api/progress/mastery')
    expect((await masteryGET(req)).status).toBe(422)
  })

  it('returns topics and weakTopics arrays', async () => {
    mockGetMastery.mockResolvedValueOnce([{ topicId: 't1', topicName: 'A', mastery: 0.7, weight: 1.0, attempts: 5 }])
    mockGetWeak.mockResolvedValueOnce([{ topicId: 't1', topicName: 'A', mastery: 0.7, weight: 1.0, attempts: 5 }])
    const req = new Request('http://localhost/api/progress/mastery?examId=00000000-0000-0000-0000-000000000001')
    const body = (await (await masteryGET(req)).json()) as { data: { topics: unknown[]; weakTopics: unknown[] } }
    expect(Array.isArray(body.data.topics)).toBe(true)
    expect(Array.isArray(body.data.weakTopics)).toBe(true)
  })
})
