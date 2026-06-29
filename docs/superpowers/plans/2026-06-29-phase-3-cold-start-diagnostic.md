# Phase 3: Cold Start Diagnostic Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the IRT 2PL + CAT adaptive diagnostic — from ability estimation engine through API routes to the diagnostic UI, culminating in mastery seeding.

**Architecture:** Five tasks in dependency order. Tasks 1-2 are pure logic/DB. Tasks 3-4 are API routes. Task 5 is the diagnostic UI. The IRT engine (Task 1) is a pure-function module — no DB calls — that all downstream tasks depend on.

**Tech Stack:** Next.js 15 App Router, TypeScript strict, Vitest, pg Pool, Zod

## Global Constraints

- Engines are PURE FUNCTIONS — no DB calls inside src/lib/engines/
- All colors via CSS custom properties — no raw hex
- All SQL parameterized — no string concatenation
- requireAuth() from src/lib/api/auth-guard.ts in every route handler
- TypeScript strict mode — no any without a justifying comment
- Base SHA before Phase 3: 1b7f77e (last Phase 2 commit)

---

### Task 1: IRT 2PL Engine

**Files:**
- Create: src/lib/engines/cold-start.ts
- Create: src/tests/lib/engines/cold-start.test.ts

**IRT 2PL formula:** P(correct | theta) = 1 / (1 + exp(-1.7 * a * (theta - b)))
**Fisher Information:** I(theta) = a^2 * P(theta) * (1 - P(theta))
**MLE Newton-Raphson:** up to 20 iterations starting at theta=0, clamped to [-4,4]
**Stop condition:** answerCount >= 20 OR SE(theta) < 0.3 where SE = 1/sqrt(totalInfo)

- [ ] Step 1: Create src/tests/lib/engines/cold-start.test.ts with these tests:

```typescript
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
```

- [ ] Step 2: Run test — verify FAILS: pnpm test src/tests/lib/engines/cold-start.test.ts

- [ ] Step 3: Create src/lib/engines/cold-start.ts:

```typescript
export interface IrtQuestion {
  id: string
  difficulty: number
  discrimination: number
  topicId: string
}

export interface IrtAnswer {
  question: IrtQuestion
  correct: boolean
}

const D = 1.7
const MAX_ANSWERS = 20
const SE_THRESHOLD = 0.3
const THETA_CLAMP = 4

export function calculateProbability(theta: number, a: number, b: number): number {
  return 1 / (1 + Math.exp(-D * a * (theta - b)))
}

export function calculateInformation(theta: number, a: number, b: number): number {
  const p = calculateProbability(theta, a, b)
  return D * D * a * a * p * (1 - p)
}

export function estimateAbility(answers: IrtAnswer[]): number {
  if (answers.length === 0) return 0
  let theta = 0
  for (let iter = 0; iter < 20; iter++) {
    let firstDeriv = 0
    let secondDeriv = 0
    for (const { question: { discrimination: a, difficulty: b }, correct } of answers) {
      const p = calculateProbability(theta, a, b)
      const u = correct ? 1 : 0
      firstDeriv += D * a * (u - p)
      secondDeriv += -(D * D) * a * a * p * (1 - p)
    }
    if (Math.abs(secondDeriv) < 1e-10) break
    const step = firstDeriv / secondDeriv
    theta = Math.max(-THETA_CLAMP, Math.min(THETA_CLAMP, theta - step))
    if (Math.abs(step) < 0.001) break
  }
  return theta
}

export function selectNextQuestion(
  theta: number,
  candidates: IrtQuestion[],
  answeredIds: Set<string>
): IrtQuestion | null {
  let best: IrtQuestion | null = null
  let bestInfo = -Infinity
  for (const q of candidates) {
    if (answeredIds.has(q.id)) continue
    const info = calculateInformation(theta, q.discrimination, q.difficulty)
    if (info > bestInfo) {
      bestInfo = info
      best = q
    }
  }
  return best
}

export function shouldStopDiagnostic(answerCount: number, answers: IrtAnswer[]): boolean {
  if (answerCount >= MAX_ANSWERS) return true
  if (answers.length === 0) return false
  const theta = estimateAbility(answers)
  const totalInfo = answers.reduce(
    (sum, { question: { discrimination: a, difficulty: b } }) =>
      sum + calculateInformation(theta, a, b),
    0
  )
  const se = totalInfo > 0 ? 1 / Math.sqrt(totalInfo) : Infinity
  return se < SE_THRESHOLD
}
```

- [ ] Step 4: Run test — verify PASSES: pnpm test src/tests/lib/engines/cold-start.test.ts (14 tests)
- [ ] Step 5: pnpm type-check — zero errors
- [ ] Step 6: git add src/lib/engines/cold-start.ts src/tests/lib/engines/cold-start.test.ts && git commit -m "feat: add IRT 2PL engine with CAT selection and MLE ability estimation"

---

### Task 2: Diagnostic DB Functions

**Files:**
- Create: src/lib/db/diagnostic.ts
- Create: src/tests/lib/db/diagnostic.test.ts

- [ ] Step 1: Create src/tests/lib/db/diagnostic.test.ts:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockQuery = vi.fn()
vi.mock('@/lib/db/pool', () => ({
  getPool: vi.fn(() => ({ query: mockQuery })),
}))

import {
  createDiagnosticSession,
  getUnansweredQuestions,
  recordAnswer,
  getSessionAnswers,
  completeDiagnosticSession,
  seedTopicMastery,
} from '@/lib/db/diagnostic'
import type { IrtAnswer } from '@/lib/engines/cold-start'

const UUID = '00000000-0000-0000-0000-000000000001'

describe('createDiagnosticSession', () => {
  beforeEach(() => vi.clearAllMocks())
  it('returns session id from inserted row', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: UUID }] })
    const id = await createDiagnosticSession('u1', 'e1')
    expect(id).toBe(UUID)
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO study_sessions'),
      expect.arrayContaining(['u1', 'e1', 'diagnostic'])
    )
  })
})

describe('getUnansweredQuestions', () => {
  beforeEach(() => vi.clearAllMocks())
  it('maps DB rows to IrtQuestion shape', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: UUID, difficulty: 0.5, discrimination: 1.2, topic_id: 't1' }],
    })
    const qs = await getUnansweredQuestions('session1', 'exam1')
    expect(qs).toHaveLength(1)
    expect(qs[0]).toEqual({ id: UUID, difficulty: 0.5, discrimination: 1.2, topicId: 't1' })
  })
  it('returns empty array when no rows', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] })
    expect(await getUnansweredQuestions('s1', 'e1')).toEqual([])
  })
})

describe('recordAnswer', () => {
  beforeEach(() => vi.clearAllMocks())
  it('inserts into answer_events with correct params', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] })
    await recordAnswer('s1', 'u1', 'q1', 2, true, 4500)
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO answer_events'),
      ['s1', 'u1', 'q1', 2, true, 4500]
    )
  })
})

describe('getSessionAnswers', () => {
  beforeEach(() => vi.clearAllMocks())
  it('returns IrtAnswer array from DB', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ is_correct: true, difficulty: 0.5, discrimination: 1.0, topic_id: 't1', question_id: 'q1' }],
    })
    const answers = await getSessionAnswers('s1')
    expect(answers).toHaveLength(1)
    expect(answers[0].correct).toBe(true)
    expect(answers[0].question.difficulty).toBe(0.5)
  })
})

describe('completeDiagnosticSession', () => {
  beforeEach(() => vi.clearAllMocks())
  it('sets ended_at on the session', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] })
    await completeDiagnosticSession('s1')
    expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining('ended_at'), ['s1'])
  })
})

describe('seedTopicMastery', () => {
  beforeEach(() => vi.clearAllMocks())
  it('upserts one row per unique topic', async () => {
    const answers: IrtAnswer[] = [
      { question: { id: 'q1', difficulty: 0.5, discrimination: 1.0, topicId: 't1' }, correct: true },
      { question: { id: 'q2', difficulty: 0.5, discrimination: 1.0, topicId: 't1' }, correct: false },
      { question: { id: 'q3', difficulty: 0.5, discrimination: 1.0, topicId: 't2' }, correct: true },
    ]
    mockQuery.mockResolvedValue({ rows: [] })
    await seedTopicMastery('u1', answers)
    expect(mockQuery).toHaveBeenCalledTimes(2)
  })
  it('does nothing for empty answers', async () => {
    await seedTopicMastery('u1', [])
    expect(mockQuery).not.toHaveBeenCalled()
  })
})
```

- [ ] Step 2: Run test — verify FAILS: pnpm test src/tests/lib/db/diagnostic.test.ts

- [ ] Step 3: Create src/lib/db/diagnostic.ts:

```typescript
import { getPool } from '@/lib/db/pool'
import type { IrtAnswer, IrtQuestion } from '@/lib/engines/cold-start'

export async function createDiagnosticSession(userId: string, examId: string): Promise<string> {
  const { rows } = await getPool().query(
    `INSERT INTO study_sessions (user_id, exam_id, session_type) VALUES ($1, $2, $3) RETURNING id`,
    [userId, examId, 'diagnostic']
  )
  return (rows[0] as { id: string }).id
}

export async function getUnansweredQuestions(sessionId: string, examId: string): Promise<IrtQuestion[]> {
  const { rows } = await getPool().query(
    `SELECT q.id, q.difficulty, q.discrimination, q.topic_id
     FROM questions q
     WHERE q.exam_id = $1
       AND q.id NOT IN (SELECT ae.question_id FROM answer_events ae WHERE ae.session_id = $2)`,
    [examId, sessionId]
  )
  return rows.map((r) => ({
    id: r.id as string,
    difficulty: r.difficulty as number,
    discrimination: r.discrimination as number,
    topicId: r.topic_id as string,
  }))
}

export async function recordAnswer(
  sessionId: string, userId: string, questionId: string,
  chosenIndex: number, isCorrect: boolean, timeSpentMs: number
): Promise<void> {
  await getPool().query(
    `INSERT INTO answer_events (session_id, user_id, question_id, chosen_index, is_correct, time_spent_ms)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [sessionId, userId, questionId, chosenIndex, isCorrect, timeSpentMs]
  )
}

export async function getSessionAnswers(sessionId: string): Promise<IrtAnswer[]> {
  const { rows } = await getPool().query(
    `SELECT ae.is_correct, q.difficulty, q.discrimination, q.topic_id, q.id AS question_id
     FROM answer_events ae JOIN questions q ON q.id = ae.question_id
     WHERE ae.session_id = $1 ORDER BY ae.answered_at ASC`,
    [sessionId]
  )
  return rows.map((r) => ({
    correct: r.is_correct as boolean,
    question: {
      id: r.question_id as string,
      difficulty: r.difficulty as number,
      discrimination: r.discrimination as number,
      topicId: r.topic_id as string,
    },
  }))
}

export async function completeDiagnosticSession(sessionId: string): Promise<void> {
  await getPool().query(`UPDATE study_sessions SET ended_at = NOW() WHERE id = $1`, [sessionId])
}

function computeMastery(correct: number, total: number): number {
  return 0.30 + 0.65 * (correct / total)
}

export async function seedTopicMastery(userId: string, answers: IrtAnswer[]): Promise<void> {
  if (answers.length === 0) return
  const topicStats = new Map<string, { correct: number; total: number }>()
  for (const { question, correct } of answers) {
    const existing = topicStats.get(question.topicId) ?? { correct: 0, total: 0 }
    topicStats.set(question.topicId, { correct: existing.correct + (correct ? 1 : 0), total: existing.total + 1 })
  }
  for (const [topicId, { correct, total }] of topicStats) {
    const mastery = computeMastery(correct, total)
    await getPool().query(
      `INSERT INTO user_topic_mastery (user_id, topic_id, mastery_probability, attempts)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id, topic_id)
       DO UPDATE SET mastery_probability = $3, attempts = $4, last_updated = NOW()`,
      [userId, topicId, mastery, total]
    )
  }
}
```

- [ ] Step 4: Run test — verify PASSES: pnpm test src/tests/lib/db/diagnostic.test.ts (9 tests)
- [ ] Step 5: pnpm type-check — zero errors
- [ ] Step 6: git add src/lib/db/diagnostic.ts src/tests/lib/db/diagnostic.test.ts && git commit -m "feat: add diagnostic DB functions (session, answers, mastery seeding)"

---

### Task 3: Topics API + Diagnostic Start + Answer APIs

**Files:**
- Create: src/app/api/exams/[examId]/topics/route.ts
- Create: src/app/api/diagnostic/start/route.ts
- Create: src/app/api/diagnostic/answer/route.ts
- Create: src/tests/api/exams/topics.test.ts
- Create: src/tests/api/diagnostic/start.test.ts
- Create: src/tests/api/diagnostic/answer.test.ts

**Topics API:** GET /api/exams/[examId]/topics — returns { success, data: { topics: [{id,name,weight}] }, error }

**Start API:** POST { examId: UUID } — creates session, returns { sessionId, question: {id,stem,options,correctIndex,topicId} | null, done: boolean }

**Answer API:** POST { sessionId: UUID, questionId: UUID, chosenIndex: 0-3, timeSpentMs: int } — records answer, returns { isCorrect, done, question: ... | null }

- [ ] Step 1: Create src/tests/api/exams/topics.test.ts:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
vi.mock('@/lib/api/auth-guard', () => ({ requireAuth: vi.fn() }))
const mockQuery = vi.fn()
vi.mock('@/lib/db/pool', () => ({ getPool: vi.fn(() => ({ query: mockQuery })) }))
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api/auth-guard'
import { GET } from '@/app/api/exams/[examId]/topics/route'
const mockRequireAuth = vi.mocked(requireAuth)
const authed = { user: { id: 'u1', email: 'a@b.com', name: null, image: null, tier: 'free' as const, role: 'user' as const }, error: null }
describe('GET /api/exams/[examId]/topics', () => {
  beforeEach(() => vi.clearAllMocks())
  it('returns 401 when unauthenticated', async () => {
    mockRequireAuth.mockResolvedValueOnce({ user: null, error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) })
    const res = await GET({} as any, { params: Promise.resolve({ examId: 'e1' }) })
    expect(res.status).toBe(401)
  })
  it('returns topics in success envelope', async () => {
    mockRequireAuth.mockResolvedValueOnce(authed)
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 't1', name: 'Contracts', weight: 0.3 }] })
    const res = await GET({} as any, { params: Promise.resolve({ examId: 'exam1' }) })
    expect(res.status).toBe(200)
    const body = await res.json() as { success: boolean; data: { topics: { name: string }[] } }
    expect(body.success).toBe(true)
    expect(body.data.topics[0].name).toBe('Contracts')
  })
  it('returns empty topics array when exam has none', async () => {
    mockRequireAuth.mockResolvedValueOnce(authed)
    mockQuery.mockResolvedValueOnce({ rows: [] })
    const res = await GET({} as any, { params: Promise.resolve({ examId: 'exam1' }) })
    const body = await res.json() as { data: { topics: unknown[] } }
    expect(body.data.topics).toEqual([])
  })
})
```

- [ ] Step 2: Create src/tests/api/diagnostic/start.test.ts:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
vi.mock('@/lib/api/auth-guard', () => ({ requireAuth: vi.fn() }))
vi.mock('@/lib/db/diagnostic', () => ({ createDiagnosticSession: vi.fn(), getUnansweredQuestions: vi.fn() }))
const mockQuery = vi.fn()
vi.mock('@/lib/db/pool', () => ({ getPool: vi.fn(() => ({ query: mockQuery })) }))
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api/auth-guard'
import { createDiagnosticSession, getUnansweredQuestions } from '@/lib/db/diagnostic'
import { POST } from '@/app/api/diagnostic/start/route'
const mockAuth = vi.mocked(requireAuth)
const mockCreate = vi.mocked(createDiagnosticSession)
const mockGetQs = vi.mocked(getUnansweredQuestions)
const authed = { user: { id: 'u1', email: 'a@b.com', name: null, image: null, tier: 'free' as const, role: 'user' as const }, error: null }
const VALID_UUID = '00000000-0000-0000-0000-000000000001'
function makeReq(body: unknown) {
  return new Request('http://localhost/api/diagnostic/start', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
}
describe('POST /api/diagnostic/start', () => {
  beforeEach(() => vi.clearAllMocks())
  it('returns 401 when unauthenticated', async () => {
    mockAuth.mockResolvedValueOnce({ user: null, error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) })
    const res = await POST(makeReq({ examId: VALID_UUID }))
    expect(res.status).toBe(401)
  })
  it('returns 422 for non-UUID examId', async () => {
    mockAuth.mockResolvedValueOnce(authed)
    const res = await POST(makeReq({ examId: 'not-a-uuid' }))
    expect(res.status).toBe(422)
  })
  it('returns done:true when exam has no questions', async () => {
    mockAuth.mockResolvedValueOnce(authed)
    mockCreate.mockResolvedValueOnce('session1')
    mockGetQs.mockResolvedValueOnce([])
    const res = await POST(makeReq({ examId: VALID_UUID }))
    const body = await res.json() as { data: { done: boolean } }
    expect(body.data.done).toBe(true)
  })
  it('returns sessionId and first question on success', async () => {
    mockAuth.mockResolvedValueOnce(authed)
    mockCreate.mockResolvedValueOnce('session1')
    mockGetQs.mockResolvedValueOnce([{ id: 'q1', difficulty: 0.5, discrimination: 1.0, topicId: 't1' }])
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'q1', stem: 'What is X?', options: ['A','B','C','D'], correct_index: 1, topic_id: 't1' }] })
    const res = await POST(makeReq({ examId: VALID_UUID }))
    const body = await res.json() as { data: { sessionId: string; question: { stem: string }; done: boolean } }
    expect(body.data.sessionId).toBe('session1')
    expect(body.data.question.stem).toBe('What is X?')
    expect(body.data.done).toBe(false)
  })
})
```

- [ ] Step 3: Create src/tests/api/diagnostic/answer.test.ts:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
vi.mock('@/lib/api/auth-guard', () => ({ requireAuth: vi.fn() }))
vi.mock('@/lib/db/diagnostic', () => ({
  recordAnswer: vi.fn(), getSessionAnswers: vi.fn(), getUnansweredQuestions: vi.fn(),
  completeDiagnosticSession: vi.fn(), seedTopicMastery: vi.fn(),
}))
const mockQuery = vi.fn()
vi.mock('@/lib/db/pool', () => ({ getPool: vi.fn(() => ({ query: mockQuery })) }))
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api/auth-guard'
import { recordAnswer, getSessionAnswers, getUnansweredQuestions, completeDiagnosticSession, seedTopicMastery } from '@/lib/db/diagnostic'
import { POST } from '@/app/api/diagnostic/answer/route'
const mockAuth = vi.mocked(requireAuth)
const mockRecord = vi.mocked(recordAnswer)
const mockGetAnswers = vi.mocked(getSessionAnswers)
const mockGetQs = vi.mocked(getUnansweredQuestions)
const mockComplete = vi.mocked(completeDiagnosticSession)
const mockSeed = vi.mocked(seedTopicMastery)
const authed = { user: { id: 'u1', email: 'a@b.com', name: null, image: null, tier: 'free' as const, role: 'user' as const }, error: null }
const VALID_UUID = '00000000-0000-0000-0000-000000000001'
const VALID_UUID2 = '00000000-0000-0000-0000-000000000002'
function makeReq(body: unknown) {
  return new Request('http://localhost/api/diagnostic/answer', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
}
const validBody = { sessionId: VALID_UUID, questionId: VALID_UUID2, chosenIndex: 1, timeSpentMs: 3000 }
describe('POST /api/diagnostic/answer', () => {
  beforeEach(() => vi.clearAllMocks())
  it('returns 401 when unauthenticated', async () => {
    mockAuth.mockResolvedValueOnce({ user: null, error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) })
    expect((await POST(makeReq(validBody))).status).toBe(401)
  })
  it('returns 422 for invalid body', async () => {
    mockAuth.mockResolvedValueOnce(authed)
    expect((await POST(makeReq({ sessionId: 'bad' }))).status).toBe(422)
  })
  it('returns 404 when session not found', async () => {
    mockAuth.mockResolvedValueOnce(authed)
    mockQuery.mockResolvedValueOnce({ rows: [] })
    expect((await POST(makeReq(validBody))).status).toBe(404)
  })
  it('returns done:true and seeds mastery when CAT stops', async () => {
    mockAuth.mockResolvedValueOnce(authed)
    mockQuery.mockResolvedValueOnce({ rows: [{ exam_id: 'exam1', ended_at: null }] })
    mockQuery.mockResolvedValueOnce({ rows: [{ correct_index: 1 }] })
    mockRecord.mockResolvedValueOnce(undefined)
    const bigAnswers = Array.from({ length: 20 }, (_, i) => ({
      correct: true, question: { id: `q${i}`, difficulty: 0.5, discrimination: 1.0, topicId: 't1' },
    }))
    mockGetAnswers.mockResolvedValueOnce(bigAnswers)
    mockGetQs.mockResolvedValueOnce([])
    mockComplete.mockResolvedValueOnce(undefined)
    mockSeed.mockResolvedValueOnce(undefined)
    const res = await POST(makeReq(validBody))
    const body = await res.json() as { data: { done: boolean; isCorrect: boolean } }
    expect(body.data.done).toBe(true)
    expect(body.data.isCorrect).toBe(true)
    expect(mockComplete).toHaveBeenCalled()
    expect(mockSeed).toHaveBeenCalled()
  })
})
```

- [ ] Step 4: Run all three test files — verify all FAIL: pnpm test src/tests/api/exams/topics.test.ts src/tests/api/diagnostic/start.test.ts src/tests/api/diagnostic/answer.test.ts

- [ ] Step 5: Create src/app/api/exams/[examId]/topics/route.ts — create the directory first: New-Item -ItemType Directory -Force "src/app/api/exams/[examId]/topics"

```typescript
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api/auth-guard'
import { getPool } from '@/lib/db/pool'

export const dynamic = 'force-dynamic'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ examId: string }> }
) {
  const { error } = await requireAuth()
  if (error) return error
  const { examId } = await params
  const { rows } = await getPool().query(
    `SELECT id, name, weight::float FROM exam_topics WHERE exam_id = $1 ORDER BY weight DESC`,
    [examId]
  )
  const topics = rows.map((r) => ({ id: r.id as string, name: r.name as string, weight: r.weight as number }))
  return NextResponse.json({ success: true, data: { topics }, error: null })
}
```

- [ ] Step 6: Create src/app/api/diagnostic/start/route.ts — create directory: New-Item -ItemType Directory -Force "src/app/api/diagnostic/start"

```typescript
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/api/auth-guard'
import { createDiagnosticSession, getUnansweredQuestions } from '@/lib/db/diagnostic'
import { selectNextQuestion } from '@/lib/engines/cold-start'
import { getPool } from '@/lib/db/pool'

const Schema = z.object({ examId: z.string().uuid() })

async function fetchQuestionDetail(questionId: string) {
  const { rows } = await getPool().query(
    `SELECT id, stem, options, correct_index, topic_id FROM questions WHERE id = $1`,
    [questionId]
  )
  if (rows.length === 0) return null
  const r = rows[0] as { id: string; stem: string; options: unknown; correct_index: number; topic_id: string }
  return { id: r.id, stem: r.stem, options: r.options as string[], correctIndex: r.correct_index, topicId: r.topic_id }
}

export async function POST(req: Request) {
  const { user, error } = await requireAuth()
  if (error) return error
  let body: unknown
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  const parsed = Schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid examId' }, { status: 422 })
  const { examId } = parsed.data
  const sessionId = await createDiagnosticSession(user!.id, examId)
  const candidates = await getUnansweredQuestions(sessionId, examId)
  if (candidates.length === 0) {
    return NextResponse.json({ success: true, data: { sessionId, question: null, done: true }, error: null })
  }
  const next = selectNextQuestion(0, candidates, new Set())
  const question = next ? await fetchQuestionDetail(next.id) : null
  return NextResponse.json({ success: true, data: { sessionId, question, done: false }, error: null })
}
```

- [ ] Step 7: Create src/app/api/diagnostic/answer/route.ts — create directory: New-Item -ItemType Directory -Force "src/app/api/diagnostic/answer"

```typescript
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/api/auth-guard'
import { recordAnswer, getSessionAnswers, getUnansweredQuestions, completeDiagnosticSession, seedTopicMastery } from '@/lib/db/diagnostic'
import { estimateAbility, selectNextQuestion, shouldStopDiagnostic } from '@/lib/engines/cold-start'
import { getPool } from '@/lib/db/pool'

const Schema = z.object({
  sessionId: z.string().uuid(),
  questionId: z.string().uuid(),
  chosenIndex: z.number().int().min(0).max(3),
  timeSpentMs: z.number().int().min(0),
})

async function fetchQuestionDetail(questionId: string) {
  const { rows } = await getPool().query(
    `SELECT id, stem, options, correct_index, topic_id FROM questions WHERE id = $1`,
    [questionId]
  )
  if (rows.length === 0) return null
  const r = rows[0] as { id: string; stem: string; options: unknown; correct_index: number; topic_id: string }
  return { id: r.id, stem: r.stem, options: r.options as string[], correctIndex: r.correct_index, topicId: r.topic_id }
}

export async function POST(req: Request) {
  const { user, error } = await requireAuth()
  if (error) return error
  let body: unknown
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  const parsed = Schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request' }, { status: 422 })
  const { sessionId, questionId, chosenIndex, timeSpentMs } = parsed.data
  const { rows: sessionRows } = await getPool().query(
    `SELECT exam_id, ended_at FROM study_sessions WHERE id = $1 AND user_id = $2`,
    [sessionId, user!.id]
  )
  if (sessionRows.length === 0) return NextResponse.json({ error: 'Session not found' }, { status: 404 })
  const { exam_id: examId, ended_at } = sessionRows[0] as { exam_id: string; ended_at: Date | null }
  if (ended_at) return NextResponse.json({ error: 'Session already completed' }, { status: 409 })
  const { rows: qRows } = await getPool().query(`SELECT correct_index FROM questions WHERE id = $1`, [questionId])
  const correctIndex = qRows.length > 0 ? (qRows[0] as { correct_index: number }).correct_index : -1
  const isCorrect = chosenIndex === correctIndex
  await recordAnswer(sessionId, user!.id, questionId, chosenIndex, isCorrect, timeSpentMs)
  const answers = await getSessionAnswers(sessionId)
  const remaining = await getUnansweredQuestions(sessionId, examId)
  const stop = shouldStopDiagnostic(answers.length, answers) || remaining.length === 0
  if (stop) {
    await completeDiagnosticSession(sessionId)
    await seedTopicMastery(user!.id, answers)
    return NextResponse.json({ success: true, data: { isCorrect, done: true, question: null }, error: null })
  }
  const theta = estimateAbility(answers)
  const answeredIds = new Set(answers.map((a) => a.question.id))
  const next = selectNextQuestion(theta, remaining, answeredIds)
  const question = next ? await fetchQuestionDetail(next.id) : null
  return NextResponse.json({ success: true, data: { isCorrect, done: !question, question }, error: null })
}
```

- [ ] Step 8: Run all three tests — verify PASS: pnpm test src/tests/api/exams/topics.test.ts src/tests/api/diagnostic/start.test.ts src/tests/api/diagnostic/answer.test.ts
- [ ] Step 9: pnpm type-check — zero errors
- [ ] Step 10: git add and commit:
  git add "src/app/api/exams/[examId]/" src/app/api/diagnostic/ src/tests/api/exams/ src/tests/api/diagnostic/
  git commit -m "feat: add topics API and diagnostic start/answer routes with IRT CAT"

---

### Task 4: Diagnostic UI

**Files:**
- Create: src/app/diagnostic/page.tsx (server component)
- Create: src/app/diagnostic/DiagnosticSession.tsx (client component)

No unit test for RSC. API behavior is covered by Task 3 tests.

Spec requirements:
- Centered layout, no sidebar
- Warm amber banner with text "Let's map what you already know. 15 quick questions, no pressure."
- One question card, 4 choices (A/B/C/D labels)
- After choosing: lock choices, highlight correct green (--color-mastered) / wrong red (--color-weak)
- "Step N of 20" progress indicator
- On done: show "Your learning map is ready." + "Go to Dashboard" link
- No back button
- All colors via CSS custom properties — no raw hex

- [ ] Step 1: Create src/app/diagnostic/page.tsx:

```tsx
import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import DiagnosticSession from './DiagnosticSession'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Diagnostic' }

export default async function DiagnosticPage({
  searchParams,
}: {
  searchParams: Promise<{ examId?: string }>
}) {
  const session = await auth()
  if (!session) redirect('/login')
  const { examId } = await searchParams
  if (!examId) redirect('/onboarding')
  return (
    <main style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', alignItems: 'center', background: 'var(--color-bg)', padding: 'var(--space-8) var(--space-4)' }}>
      <div style={{ maxWidth: '680px', width: '100%' }}>
        <div style={{ background: 'var(--color-accent)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-4) var(--space-6)', marginBottom: 'var(--space-8)', textAlign: 'center' }}>
          <p style={{ color: 'var(--color-text-on-primary)', fontFamily: 'var(--font-body)', fontSize: 'var(--text-base)', fontWeight: 500, margin: 0 }}>
            Let's map what you already know. 15 quick questions, no pressure.
          </p>
        </div>
        <DiagnosticSession examId={examId} />
      </div>
    </main>
  )
}
```

- [ ] Step 2: Create src/app/diagnostic/DiagnosticSession.tsx:

```tsx
'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

interface Question {
  id: string
  stem: string
  options: string[]
  correctIndex: number
  topicId: string
}

type Phase = 'loading' | 'answering' | 'answered' | 'done' | 'error'
const LABELS = ['A', 'B', 'C', 'D']

export default function DiagnosticSession({ examId }: { examId: string }) {
  const router = useRouter()
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [question, setQuestion] = useState<Question | null>(null)
  const [phase, setPhase] = useState<Phase>('loading')
  const [step, setStep] = useState(0)
  const [chosen, setChosen] = useState<number | null>(null)
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  useEffect(() => { void startSession() }, [])

  async function startSession() {
    setPhase('loading')
    try {
      const res = await fetch('/api/diagnostic/start', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ examId }),
      })
      const body = (await res.json()) as { data: { sessionId: string; question: Question | null; done: boolean } }
      if (body.data.done || !body.data.question) { setPhase('done'); return }
      setSessionId(body.data.sessionId)
      setQuestion(body.data.question)
      setStep(1)
      setPhase('answering')
    } catch {
      setErrorMsg('Failed to start diagnostic. Please try again.')
      setPhase('error')
    }
  }

  function handleAnswer(index: number) {
    if (phase !== 'answering' || !question) return
    setChosen(index)
    setIsCorrect(index === question.correctIndex)
    setPhase('answered')
  }

  async function handleNext() {
    if (!sessionId || !question || chosen === null) return
    setPhase('loading')
    try {
      const res = await fetch('/api/diagnostic/answer', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, questionId: question.id, chosenIndex: chosen, timeSpentMs: 0 }),
      })
      const body = (await res.json()) as { data: { isCorrect: boolean; done: boolean; question: Question | null } }
      if (body.data.done || !body.data.question) { setPhase('done'); return }
      setQuestion(body.data.question)
      setChosen(null)
      setIsCorrect(null)
      setStep((s) => s + 1)
      setPhase('answering')
    } catch {
      setErrorMsg('Something went wrong. Please refresh.')
      setPhase('error')
    }
  }

  if (phase === 'loading') return (
    <div style={{ textAlign: 'center', padding: 'var(--space-16)', color: 'var(--color-text-muted)' }}>Loading…</div>
  )
  if (phase === 'error') return (
    <div style={{ textAlign: 'center', padding: 'var(--space-12)', color: 'var(--color-error)' }}>{errorMsg}</div>
  )
  if (phase === 'done') return (
    <div style={{ textAlign: 'center', padding: 'var(--space-12)' }}>
      <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-3xl)', color: 'var(--color-primary)', marginBottom: 'var(--space-4)' }}>
        Your learning map is ready.
      </h2>
      <p style={{ color: 'var(--color-text-muted)', marginBottom: 'var(--space-8)', fontSize: 'var(--text-lg)' }}>
        We've identified your strengths and weak spots. Time to study smarter.
      </p>
      <a href="/dashboard" style={{ display: 'inline-block', padding: 'var(--space-4) var(--space-8)', background: 'var(--color-primary)', color: 'var(--color-text-on-primary)', borderRadius: 'var(--radius-md)', fontWeight: 700, fontSize: 'var(--text-lg)', textDecoration: 'none' }}>
        Go to Dashboard →
      </a>
    </div>
  )
  if (!question) return null

  return (
    <div>
      <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)', textAlign: 'center', marginBottom: 'var(--space-6)' }}>
        Step {step} of 20
      </p>
      <div style={{ background: 'var(--color-surface)', borderRadius: 'var(--radius-xl)', padding: 'var(--space-8)', boxShadow: 'var(--shadow-lg)', marginBottom: 'var(--space-6)' }}>
        <p style={{ fontFamily: 'var(--font-body)', fontSize: 'var(--text-xl)', color: 'var(--color-text)', lineHeight: 'var(--leading-normal)', margin: 0 }}>
          {question.stem}
        </p>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', marginBottom: 'var(--space-8)' }}>
        {question.options.map((opt, i) => {
          let bg = 'var(--color-surface)', border = '1px solid var(--color-border)', color = 'var(--color-text)'
          if (phase === 'answered' && chosen !== null) {
            if (i === question.correctIndex) { bg = 'var(--color-mastered)'; border = '2px solid var(--color-mastered)'; color = 'var(--color-text-on-primary)' }
            else if (i === chosen) { bg = 'var(--color-weak)'; border = '2px solid var(--color-weak)'; color = 'var(--color-text-on-primary)' }
          }
          return (
            <button key={i} onClick={() => handleAnswer(i)} disabled={phase === 'answered'}
              style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)', padding: 'var(--space-4)', background: bg, border, borderRadius: 'var(--radius-md)', cursor: phase === 'answered' ? 'default' : 'pointer', textAlign: 'left' as const, color, boxShadow: 'var(--shadow-sm)' }}>
              <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '2rem', height: '2rem', borderRadius: 'var(--radius-full)', background: phase === 'answered' ? 'transparent' : 'var(--color-bg)', fontWeight: 700, fontSize: 'var(--text-sm)', flexShrink: 0, color: 'inherit' }}>
                {LABELS[i]}
              </span>
              <span style={{ fontSize: 'var(--text-base)' }}>{opt}</span>
            </button>
          )
        })}
      </div>
      {phase === 'answered' && (
        <div style={{ textAlign: 'center' }}>
          <p style={{ marginBottom: 'var(--space-4)', fontWeight: 600, fontSize: 'var(--text-base)', color: isCorrect ? 'var(--color-mastered)' : 'var(--color-weak)' }}>
            {isCorrect ? 'Correct!' : 'Incorrect'}
          </p>
          <button onClick={() => { void handleNext() }}
            style={{ padding: 'var(--space-3) var(--space-8)', background: 'var(--color-primary)', color: 'var(--color-text-on-primary)', borderRadius: 'var(--radius-md)', fontWeight: 700, fontSize: 'var(--text-base)', border: 'none', cursor: 'pointer' }}>
            Next →
          </button>
        </div>
      )}
    </div>
  )
}
```

- [ ] Step 3: pnpm type-check — zero errors
- [ ] Step 4: pnpm test — all previously passing tests still pass
- [ ] Step 5: git add src/app/diagnostic/ && git commit -m "feat: add diagnostic page and adaptive session UI"
- [ ] Step 6: Push: $env:PATH = [System.Environment]::GetEnvironmentVariable("PATH","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("PATH","User"); git push origin master
