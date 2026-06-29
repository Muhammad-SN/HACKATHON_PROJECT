# Adaptive Study Session Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the core adaptive study loop — BKT mastery tracking, SM-2 spaced repetition scheduling, multi-criteria question selection, study session API routes, and a study UI with a Socratic AI explanation panel.

**Architecture:** Three pure-function engines (BKT, SM-2, Selector) live in `src/lib/engines/` with zero DB calls. `src/lib/db/study.ts` owns all database reads/writes. API routes orchestrate: load due questions → engine scores → pick next → record answer → persist mastery + schedule. The UI is a client component state machine (`loading → answering → answered → done`).

**Tech Stack:** Next.js 15 App Router, Aurora PostgreSQL (`pg` pool), Anthropic SDK (`claude-haiku-4-5-20251001` free / `claude-sonnet-4-6` premium), Zod, Vitest

---

## File Map

| File | Role |
|------|------|
| `src/lib/engines/bkt.ts` | Bayesian Knowledge Tracing — `updateMastery`, `isMastered` |
| `src/lib/engines/sm2.ts` | SM-2 spaced repetition — `sm2Update`, `qualityFromCorrect`, `defaultSm2Record` |
| `src/lib/engines/selector.ts` | Multi-criteria question scorer — `scoreQuestion`, `selectNextStudyQuestion` |
| `src/lib/db/study.ts` | All DB queries for study sessions, schedules, and mastery |
| `src/lib/ai/usage.ts` | `trackUsage()` — logs LLM calls to `usage_events` |
| `src/app/api/study/start/route.ts` | POST — create session, return first question |
| `src/app/api/study/answer/route.ts` | POST — record answer, run engines, return next question |
| `src/app/api/study/socratic/route.ts` | POST — call Claude for Socratic explanation |
| `src/app/study/[sessionId]/page.tsx` | Server component — auth guard + layout |
| `src/app/study/[sessionId]/StudySession.tsx` | Client component — full answering state machine |
| `src/tests/lib/engines/bkt.test.ts` | 7 unit tests for BKT engine |
| `src/tests/lib/engines/sm2.test.ts` | 9 unit tests for SM-2 engine |
| `src/tests/lib/engines/selector.test.ts` | 5 unit tests for selector engine |
| `src/tests/lib/db/study.test.ts` | 5 unit tests for study DB functions (mocked pool) |
| `src/tests/api/study.test.ts` | 4 unit tests for study API routes |

---

### Task 1: BKT Engine

**Files:**
- Create: `src/lib/engines/bkt.ts`
- Test: `src/tests/lib/engines/bkt.test.ts`

**Formula:** P(know_t | answer_t) = P(know_t-1) × P(answer | know) / P(answer), then apply learning transit:
- P(know_t+1) = posterior + (1 - posterior) × P_TRANSIT
- Constants: `P_TRANSIT = 0.1`, `P_SLIP = 0.15`, `P_GUESS = 0.25`

- [ ] **Step 1: Write the failing tests**

```typescript
// src/tests/lib/engines/bkt.test.ts
import { describe, it, expect } from 'vitest'
import { updateMastery, isMastered } from '@/lib/engines/bkt'

describe('BKT updateMastery', () => {
  it('increases mastery after correct answer', () => {
    expect(updateMastery(0.5, true)).toBeGreaterThan(0.5)
  })

  it('decreases mastery after wrong answer', () => {
    expect(updateMastery(0.9, false)).toBeLessThan(0.9)
  })

  it('clamps output to [0, 1] for high input', () => {
    expect(updateMastery(1.0, true)).toBeLessThanOrEqual(1)
  })

  it('clamps output to [0, 1] for low input', () => {
    expect(updateMastery(0.0, false)).toBeGreaterThanOrEqual(0)
  })

  it('converges toward 1.0 with 30 consecutive correct answers', () => {
    let m = 0.3
    for (let i = 0; i < 30; i++) m = updateMastery(m, true)
    expect(m).toBeGreaterThan(0.85)
  })
})

describe('isMastered', () => {
  it('returns true when mastery is above default threshold (0.85)', () => {
    expect(isMastered(0.9)).toBe(true)
  })

  it('returns false when mastery is below default threshold', () => {
    expect(isMastered(0.7)).toBe(false)
  })

  it('respects a custom threshold', () => {
    expect(isMastered(0.7, 0.6)).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```powershell
pnpm test src/tests/lib/engines/bkt.test.ts 2>&1 | Select-String "Tests:|passed|failed|error"
```

Expected: FAIL — "Cannot find module '@/lib/engines/bkt'"

- [ ] **Step 3: Implement `src/lib/engines/bkt.ts`**

```typescript
const P_TRANSIT = 0.1
const P_SLIP    = 0.15
const P_GUESS   = 0.25

export function updateMastery(priorMastery: number, isCorrect: boolean): number {
  const pCorrectKnow    = 1 - P_SLIP
  const pCorrectNotKnow = P_GUESS
  const pCorrect = priorMastery * pCorrectKnow + (1 - priorMastery) * pCorrectNotKnow

  let posteriorKnow: number
  if (isCorrect) {
    posteriorKnow = (priorMastery * pCorrectKnow) / pCorrect
  } else {
    const pIncorrect = 1 - pCorrect
    posteriorKnow = (priorMastery * P_SLIP) / pIncorrect
  }

  const updated = posteriorKnow + (1 - posteriorKnow) * P_TRANSIT
  return Math.max(0, Math.min(1, updated))
}

export function isMastered(mastery: number, threshold = 0.85): boolean {
  return mastery >= threshold
}
```

- [ ] **Step 4: Run tests to verify they pass**

```powershell
pnpm test src/tests/lib/engines/bkt.test.ts 2>&1 | Select-String "Tests:|passed|failed"
```

Expected: 7 passed

- [ ] **Step 5: Commit**

```powershell
git add src/lib/engines/bkt.ts src/tests/lib/engines/bkt.test.ts
git commit -m "feat: add BKT mastery updater engine"
```

---

### Task 2: SM-2 Engine

**Files:**
- Create: `src/lib/engines/sm2.ts`
- Test: `src/tests/lib/engines/sm2.test.ts`

**Algorithm:** Quality 0–5. Quality < 3 → reset (repetitionCount = 0, interval = 1). First correct → interval 1. Second → interval 6. Subsequent → `round(interval × easeFactor)`. EaseFactor: `max(1.3, ef + 0.1 - (5-q) × (0.08 + (5-q) × 0.02))`.

- [ ] **Step 1: Write the failing tests**

```typescript
// src/tests/lib/engines/sm2.test.ts
import { describe, it, expect } from 'vitest'
import { sm2Update, qualityFromCorrect, defaultSm2Record } from '@/lib/engines/sm2'

const now = new Date('2025-01-01T00:00:00Z')

describe('sm2Update', () => {
  it('resets repetitionCount and interval on quality < 3', () => {
    const rec = { intervalDays: 10, easeFactor: 2.5, repetitionCount: 3 }
    const updated = sm2Update(rec, 1, now)
    expect(updated.repetitionCount).toBe(0)
    expect(updated.intervalDays).toBe(1)
  })

  it('sets interval to 1 on first correct answer', () => {
    const updated = sm2Update(defaultSm2Record(), 4, now)
    expect(updated.intervalDays).toBe(1)
    expect(updated.repetitionCount).toBe(1)
  })

  it('sets interval to 6 on second correct answer', () => {
    const rec = { intervalDays: 1, easeFactor: 2.5, repetitionCount: 1 }
    const updated = sm2Update(rec, 4, now)
    expect(updated.intervalDays).toBe(6)
    expect(updated.repetitionCount).toBe(2)
  })

  it('grows interval multiplicatively when repetitionCount > 1', () => {
    const rec = { intervalDays: 6, easeFactor: 2.5, repetitionCount: 2 }
    const updated = sm2Update(rec, 4, now)
    expect(updated.intervalDays).toBeGreaterThan(6)
  })

  it('sets nextReviewAt to a date in the future', () => {
    const updated = sm2Update(defaultSm2Record(), 5, now)
    expect(updated.nextReviewAt.getTime()).toBeGreaterThan(now.getTime())
  })

  it('never lets easeFactor drop below 1.3', () => {
    let rec = defaultSm2Record()
    for (let i = 0; i < 20; i++) rec = sm2Update(rec, 0, now)
    expect(rec.easeFactor).toBeGreaterThanOrEqual(1.3)
  })
})

describe('qualityFromCorrect', () => {
  it('returns 1 for an incorrect answer', () => {
    expect(qualityFromCorrect(false, 5000)).toBe(1)
  })

  it('returns 5 for a fast correct answer (under 50% of expected time)', () => {
    expect(qualityFromCorrect(true, 3000)).toBe(5)
  })

  it('returns 3 for a slow correct answer (over 2x expected time)', () => {
    expect(qualityFromCorrect(true, 40000)).toBe(3)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```powershell
pnpm test src/tests/lib/engines/sm2.test.ts 2>&1 | Select-String "Tests:|passed|failed|error"
```

Expected: FAIL

- [ ] **Step 3: Implement `src/lib/engines/sm2.ts`**

```typescript
export interface Sm2Record {
  intervalDays: number
  easeFactor: number
  repetitionCount: number
}

export interface Sm2Update extends Sm2Record {
  nextReviewAt: Date
}

const MIN_EASE = 1.3

export function sm2Update(record: Sm2Record, quality: number, now: Date): Sm2Update {
  const q = Math.max(0, Math.min(5, quality))
  let { intervalDays, easeFactor, repetitionCount } = record

  if (q < 3) {
    repetitionCount = 0
    intervalDays = 1
  } else {
    if (repetitionCount === 0) {
      intervalDays = 1
    } else if (repetitionCount === 1) {
      intervalDays = 6
    } else {
      intervalDays = Math.round(intervalDays * easeFactor)
    }
    repetitionCount++
  }

  easeFactor = Math.max(
    MIN_EASE,
    easeFactor + 0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)
  )

  const nextReviewAt = new Date(now.getTime() + intervalDays * 24 * 60 * 60 * 1000)
  return { intervalDays, easeFactor, repetitionCount, nextReviewAt }
}

export function qualityFromCorrect(isCorrect: boolean, timeSpentMs: number, expectedMs = 15000): number {
  if (!isCorrect) return 1
  const ratio = timeSpentMs / expectedMs
  if (ratio < 0.5) return 5
  if (ratio < 1.0) return 4
  if (ratio < 2.0) return 3
  return 3
}

export function defaultSm2Record(): Sm2Record {
  return { intervalDays: 1, easeFactor: 2.5, repetitionCount: 0 }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```powershell
pnpm test src/tests/lib/engines/sm2.test.ts 2>&1 | Select-String "Tests:|passed|failed"
```

Expected: 9 passed

- [ ] **Step 5: Commit**

```powershell
git add src/lib/engines/sm2.ts src/tests/lib/engines/sm2.test.ts
git commit -m "feat: add SM-2 spaced repetition scheduler engine"
```

---

### Task 3: Selector Engine

**Files:**
- Create: `src/lib/engines/selector.ts`
- Test: `src/tests/lib/engines/selector.test.ts`

**Scoring formula:** `score = 0.5 × overdueScore + 0.3 × weakTopicScore + 0.2 × optimalDifficultyScore`
- `overdueScore`: 1.0 if past due; else linear decay from 1→0 over 7 days
- `weakTopicScore`: `1 - topicMastery`
- `optimalDifficultyScore`: `1 - |difficulty - 0.5|` (prefer questions near 0.5 difficulty)

- [ ] **Step 1: Write the failing tests**

```typescript
// src/tests/lib/engines/selector.test.ts
import { describe, it, expect } from 'vitest'
import { scoreQuestion, selectNextStudyQuestion } from '@/lib/engines/selector'
import type { StudyQuestionWithSchedule } from '@/lib/engines/selector'

const now    = new Date('2025-01-10T00:00:00Z')
const past   = new Date('2025-01-01T00:00:00Z')
const future = new Date('2025-01-20T00:00:00Z')

function makeQ(overrides: Partial<StudyQuestionWithSchedule> = {}): StudyQuestionWithSchedule {
  return {
    id: '1', topicId: 'topic1', difficulty: 0.5, discrimination: 1.0, topicMastery: 0.5,
    schedule: { intervalDays: 1, easeFactor: 2.5, repetitionCount: 0, nextReviewAt: past },
    ...overrides,
  }
}

describe('scoreQuestion', () => {
  it('scores an overdue question higher than a future question', () => {
    const overdue   = makeQ({ schedule: { intervalDays: 1, easeFactor: 2.5, repetitionCount: 0, nextReviewAt: past } })
    const upcoming  = makeQ({ schedule: { intervalDays: 1, easeFactor: 2.5, repetitionCount: 0, nextReviewAt: future } })
    expect(scoreQuestion(overdue, now)).toBeGreaterThan(scoreQuestion(upcoming, now))
  })

  it('scores a weak-topic question higher than a mastered-topic question', () => {
    const weak   = makeQ({ topicMastery: 0.1 })
    const strong = makeQ({ topicMastery: 0.95 })
    expect(scoreQuestion(weak, now)).toBeGreaterThan(scoreQuestion(strong, now))
  })

  it('returns a number in [0, 1]', () => {
    const score = scoreQuestion(makeQ(), now)
    expect(score).toBeGreaterThanOrEqual(0)
    expect(score).toBeLessThanOrEqual(1)
  })
})

describe('selectNextStudyQuestion', () => {
  it('returns null for an empty list', () => {
    expect(selectNextStudyQuestion([], now)).toBeNull()
  })

  it('selects the highest-scoring question from the list', () => {
    const overdue  = makeQ({ id: 'overdue', schedule: { intervalDays: 1, easeFactor: 2.5, repetitionCount: 0, nextReviewAt: past } })
    const notDue   = makeQ({ id: 'future',  schedule: { intervalDays: 1, easeFactor: 2.5, repetitionCount: 0, nextReviewAt: future } })
    expect(selectNextStudyQuestion([notDue, overdue], now)?.id).toBe('overdue')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```powershell
pnpm test src/tests/lib/engines/selector.test.ts 2>&1 | Select-String "Tests:|passed|failed|error"
```

Expected: FAIL

- [ ] **Step 3: Implement `src/lib/engines/selector.ts`**

```typescript
import type { Sm2Record } from './sm2'

export interface StudyQuestion {
  id: string
  topicId: string
  difficulty: number
  discrimination: number
}

export interface StudyQuestionWithSchedule extends StudyQuestion {
  schedule: Sm2Record & { nextReviewAt: Date }
  topicMastery: number
}

export function scoreQuestion(q: StudyQuestionWithSchedule, now: Date): number {
  const overdueScore = q.schedule.nextReviewAt <= now
    ? 1.0
    : Math.max(0, 1 - (q.schedule.nextReviewAt.getTime() - now.getTime()) / (7 * 24 * 60 * 60 * 1000))

  const weakTopicScore = 1 - q.topicMastery
  const optimalDifficultyScore = 1 - Math.abs(q.difficulty - 0.5)

  return 0.5 * overdueScore + 0.3 * weakTopicScore + 0.2 * optimalDifficultyScore
}

export function selectNextStudyQuestion(
  questions: StudyQuestionWithSchedule[],
  now: Date
): StudyQuestionWithSchedule | null {
  if (questions.length === 0) return null
  return questions.reduce((best, q) =>
    scoreQuestion(q, now) > scoreQuestion(best, now) ? q : best
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

```powershell
pnpm test src/tests/lib/engines/selector.test.ts 2>&1 | Select-String "Tests:|passed|failed"
```

Expected: 5 passed

- [ ] **Step 5: Commit**

```powershell
git add src/lib/engines/selector.ts src/tests/lib/engines/selector.test.ts
git commit -m "feat: add multi-criteria question selector engine"
```

---

### Task 4: Study DB Functions

**Files:**
- Create: `src/lib/db/study.ts`
- Test: `src/tests/lib/db/study.test.ts`

Engines are pure — all DB calls happen here. Uses `getPool()` from `src/lib/db/pool.ts`.

- [ ] **Step 1: Write the failing tests**

```typescript
// src/tests/lib/db/study.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db/pool', () => ({
  getPool: vi.fn().mockReturnValue({ query: vi.fn() }),
}))

import { getPool } from '@/lib/db/pool'
import {
  createStudySession, getDueQuestions, upsertQuestionSchedule,
  updateTopicMastery, recordStudyAnswer,
} from '@/lib/db/study'

const mockQuery = (getPool as ReturnType<typeof vi.fn>)().query as ReturnType<typeof vi.fn>
beforeEach(() => vi.clearAllMocks())

describe('createStudySession', () => {
  it('inserts an adaptive session and returns its ID', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'sess-1' }] })
    const id = await createStudySession('user-1', 'exam-1')
    expect(id).toBe('sess-1')
    expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining('adaptive'), ['user-1', 'exam-1'])
  })
})

describe('upsertQuestionSchedule', () => {
  it('calls upsert with SM-2 params in correct order', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] })
    const update = { intervalDays: 6, easeFactor: 2.5, repetitionCount: 1, nextReviewAt: new Date('2025-01-07') }
    await upsertQuestionSchedule('user-1', 'q-1', update)
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('ON CONFLICT'),
      ['user-1', 'q-1', update.nextReviewAt, 6, 2.5, 1]
    )
  })
})

describe('updateTopicMastery', () => {
  it('upserts mastery_probability correctly', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] })
    await updateTopicMastery('user-1', 'topic-1', 0.75)
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('mastery_probability'), ['user-1', 'topic-1', 0.75]
    )
  })
})

describe('recordStudyAnswer', () => {
  it('inserts a row into answer_events', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] })
    await recordStudyAnswer('sess-1', 'user-1', 'q-1', 2, true, 5000)
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('answer_events'), ['sess-1', 'user-1', 'q-1', 2, true, 5000]
    )
  })
})

describe('getDueQuestions', () => {
  it('maps DB row shape to StudyQuestionWithSchedule', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{
        id: 'q-1', topic_id: 't-1', difficulty: '0.5', discrimination: '1.0',
        interval_days: '1', ease_factor: '2.5', repetition_count: '0',
        next_review_at: new Date('2025-01-01'), topic_mastery: '0.4',
      }],
    })
    const qs = await getDueQuestions('user-1', 'exam-1')
    expect(qs).toHaveLength(1)
    expect(qs[0]?.topicMastery).toBe(0.4)
    expect(qs[0]?.schedule.easeFactor).toBe(2.5)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```powershell
pnpm test src/tests/lib/db/study.test.ts 2>&1 | Select-String "Tests:|passed|failed|error"
```

Expected: FAIL

- [ ] **Step 3: Implement `src/lib/db/study.ts`**

```typescript
import { getPool } from '@/lib/db/pool'
import type { StudyQuestionWithSchedule } from '@/lib/engines/selector'
import type { Sm2Update } from '@/lib/engines/sm2'

export async function createStudySession(userId: string, examId: string): Promise<string> {
  const { rows } = await getPool().query(
    `INSERT INTO study_sessions (user_id, exam_id, session_type) VALUES ($1, $2, 'adaptive') RETURNING id`,
    [userId, examId]
  )
  return (rows[0] as { id: string }).id
}

export async function getDueQuestions(
  userId: string, examId: string, limit = 20
): Promise<StudyQuestionWithSchedule[]> {
  const { rows } = await getPool().query(
    `SELECT
       q.id, q.topic_id, q.difficulty, q.discrimination,
       COALESCE(s.interval_days, 1)         AS interval_days,
       COALESCE(s.ease_factor, 2.5)         AS ease_factor,
       COALESCE(s.repetition_count, 0)      AS repetition_count,
       COALESCE(s.next_review_at, NOW())    AS next_review_at,
       COALESCE(m.mastery_probability, 0.3) AS topic_mastery
     FROM questions q
     JOIN exam_topics et ON et.id = q.topic_id
     LEFT JOIN user_question_schedule s ON s.question_id = q.id AND s.user_id = $1
     LEFT JOIN user_topic_mastery m ON m.topic_id = q.topic_id AND m.user_id = $1
     WHERE q.exam_id = $2
     ORDER BY COALESCE(s.next_review_at, NOW()) ASC
     LIMIT $3`,
    [userId, examId, limit]
  )
  return rows.map((r) => ({
    id: r.id as string,
    topicId: r.topic_id as string,
    difficulty: parseFloat(r.difficulty as string),
    discrimination: parseFloat(r.discrimination as string),
    topicMastery: parseFloat(r.topic_mastery as string),
    schedule: {
      intervalDays: parseFloat(r.interval_days as string),
      easeFactor: parseFloat(r.ease_factor as string),
      repetitionCount: parseInt(r.repetition_count as string, 10),
      nextReviewAt: new Date(r.next_review_at as string),
    },
  }))
}

export async function upsertQuestionSchedule(
  userId: string, questionId: string, update: Sm2Update
): Promise<void> {
  await getPool().query(
    `INSERT INTO user_question_schedule
       (user_id, question_id, next_review_at, interval_days, ease_factor, repetition_count)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (user_id, question_id) DO UPDATE
       SET next_review_at = $3, interval_days = $4, ease_factor = $5, repetition_count = $6`,
    [userId, questionId, update.nextReviewAt, update.intervalDays, update.easeFactor, update.repetitionCount]
  )
}

export async function updateTopicMastery(userId: string, topicId: string, mastery: number): Promise<void> {
  await getPool().query(
    `INSERT INTO user_topic_mastery (user_id, topic_id, mastery_probability, attempts)
     VALUES ($1, $2, $3, 1)
     ON CONFLICT (user_id, topic_id) DO UPDATE
       SET mastery_probability = $3, attempts = user_topic_mastery.attempts + 1, last_updated = NOW()`,
    [userId, topicId, mastery]
  )
}

export async function getStudySessionOwner(sessionId: string): Promise<string | null> {
  const { rows } = await getPool().query(
    `SELECT user_id FROM study_sessions WHERE id = $1`, [sessionId]
  )
  return rows.length > 0 ? (rows[0] as { user_id: string }).user_id : null
}

export async function fetchStudyQuestion(questionId: string): Promise<{
  id: string; stem: string; options: string[]; correctIndex: number
  explanation: string; topicId: string; difficulty: number; discrimination: number
} | null> {
  const { rows } = await getPool().query(
    `SELECT id, stem, options, correct_index, explanation, topic_id, difficulty, discrimination
     FROM questions WHERE id = $1`,
    [questionId]
  )
  if (rows.length === 0) return null
  const r = rows[0] as {
    id: string; stem: string; options: unknown; correct_index: number
    explanation: string; topic_id: string; difficulty: string; discrimination: string
  }
  return {
    id: r.id, stem: r.stem, options: r.options as string[], correctIndex: r.correct_index,
    explanation: r.explanation, topicId: r.topic_id,
    difficulty: parseFloat(r.difficulty), discrimination: parseFloat(r.discrimination),
  }
}

export async function recordStudyAnswer(
  sessionId: string, userId: string, questionId: string,
  chosenIndex: number, isCorrect: boolean, timeSpentMs: number
): Promise<void> {
  await getPool().query(
    `INSERT INTO answer_events (session_id, user_id, question_id, chosen_index, is_correct, time_spent_ms)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [sessionId, userId, questionId, chosenIndex, isCorrect, timeSpentMs]
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

```powershell
pnpm test src/tests/lib/db/study.test.ts 2>&1 | Select-String "Tests:|passed|failed"
```

Expected: 5 passed

- [ ] **Step 5: Commit**

```powershell
git add src/lib/db/study.ts src/tests/lib/db/study.test.ts
git commit -m "feat: add study session DB functions"
```

---

### Task 5: Study API Routes

**Files:**
- Create: `src/app/api/study/start/route.ts`
- Create: `src/app/api/study/answer/route.ts`
- Create: `src/app/api/study/socratic/route.ts`
- Test: `src/tests/api/study.test.ts`

> `src/lib/ai/usage.ts` must exist (created in Phase 4). If not, create it:
> ```typescript
> import { getPool } from '@/lib/db/pool'
> export async function trackUsage(userId: string, eventType: string, model: string, inputTokens: number, outputTokens: number): Promise<void> {
>   await getPool().query(
>     `INSERT INTO usage_events (user_id, event_type, model, input_tokens, output_tokens) VALUES ($1,$2,$3,$4,$5)`,
>     [userId, eventType, model, inputTokens, outputTokens]
>   )
> }
> ```

- [ ] **Step 1: Write the failing tests**

```typescript
// src/tests/api/study.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/api/auth-guard', () => ({
  requireAuth: vi.fn().mockResolvedValue({ user: { id: 'user-1', tier: 'free' }, error: null }),
}))
vi.mock('@/lib/db/study', () => ({
  createStudySession:    vi.fn().mockResolvedValue('sess-1'),
  getDueQuestions:       vi.fn().mockResolvedValue([]),
  fetchStudyQuestion:    vi.fn(),
  upsertQuestionSchedule: vi.fn().mockResolvedValue(undefined),
  updateTopicMastery:    vi.fn().mockResolvedValue(undefined),
  recordStudyAnswer:     vi.fn().mockResolvedValue(undefined),
  getStudySessionOwner:  vi.fn().mockResolvedValue('user-1'),
}))
vi.mock('@/lib/db/pool', () => ({
  getPool: vi.fn().mockReturnValue({ query: vi.fn().mockResolvedValue({ rows: [] }) }),
}))
vi.mock('@/lib/engines/selector', () => ({
  selectNextStudyQuestion: vi.fn().mockReturnValue(null),
}))

import { POST as startPOST }  from '@/app/api/study/start/route'
import { POST as answerPOST } from '@/app/api/study/answer/route'
import { fetchStudyQuestion }  from '@/lib/db/study'

const mockFetch = fetchStudyQuestion as ReturnType<typeof vi.fn>
beforeEach(() => vi.clearAllMocks())

function makeReq(body: unknown) {
  return new Request('http://localhost', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/study/start', () => {
  it('returns done:true when no questions are available', async () => {
    const res = await startPOST(makeReq({ examId: '00000000-0000-0000-0000-000000000001' }))
    const body = await res.json() as { data: { done: boolean } }
    expect(body.data.done).toBe(true)
  })

  it('returns 422 when examId is not a UUID', async () => {
    const res = await startPOST(makeReq({ examId: 'not-a-uuid' }))
    expect(res.status).toBe(422)
  })
})

describe('POST /api/study/answer', () => {
  it('returns 404 when question is not found', async () => {
    mockFetch.mockResolvedValueOnce(null)
    const res = await answerPOST(makeReq({
      sessionId:   '00000000-0000-0000-0000-000000000001',
      questionId:  '00000000-0000-0000-0000-000000000002',
      chosenIndex: 0, timeSpentMs: 5000,
    }))
    expect(res.status).toBe(404)
  })

  it('returns 422 when chosenIndex is out of range', async () => {
    const res = await answerPOST(makeReq({
      sessionId:   '00000000-0000-0000-0000-000000000001',
      questionId:  '00000000-0000-0000-0000-000000000002',
      chosenIndex: 10, timeSpentMs: 5000,
    }))
    expect(res.status).toBe(422)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```powershell
pnpm test src/tests/api/study.test.ts 2>&1 | Select-String "Tests:|passed|failed|error"
```

Expected: FAIL

- [ ] **Step 3: Implement `src/app/api/study/start/route.ts`**

```typescript
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/api/auth-guard'
import { createStudySession, getDueQuestions, fetchStudyQuestion } from '@/lib/db/study'
import { selectNextStudyQuestion } from '@/lib/engines/selector'

const Schema = z.object({ examId: z.string().uuid() })

export async function POST(req: Request) {
  const { user, error } = await requireAuth()
  if (error) return error

  let body: unknown
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const parsed = Schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request' }, { status: 422 })

  const { examId } = parsed.data
  const sessionId  = await createStudySession(user!.id, examId)
  const candidates = await getDueQuestions(user!.id, examId)
  const selected   = selectNextStudyQuestion(candidates, new Date())

  if (!selected) {
    return NextResponse.json({ success: true, data: { sessionId, question: null, done: true }, error: null })
  }

  const detail = await fetchStudyQuestion(selected.id)
  return NextResponse.json({ success: true, data: { sessionId, question: detail, done: false }, error: null })
}
```

- [ ] **Step 4: Implement `src/app/api/study/answer/route.ts`**

```typescript
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/api/auth-guard'
import {
  getDueQuestions, fetchStudyQuestion, upsertQuestionSchedule,
  updateTopicMastery, recordStudyAnswer, getStudySessionOwner,
} from '@/lib/db/study'
import { updateMastery } from '@/lib/engines/bkt'
import { sm2Update, qualityFromCorrect, defaultSm2Record } from '@/lib/engines/sm2'
import { selectNextStudyQuestion } from '@/lib/engines/selector'
import { getPool } from '@/lib/db/pool'

const Schema = z.object({
  sessionId:   z.string().uuid(),
  questionId:  z.string().uuid(),
  chosenIndex: z.number().int().min(0).max(3),
  timeSpentMs: z.number().int().min(0),
})

export async function POST(req: Request) {
  const { user, error } = await requireAuth()
  if (error) return error

  let body: unknown
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const parsed = Schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request' }, { status: 422 })

  const { sessionId, questionId, chosenIndex, timeSpentMs } = parsed.data

  const ownerId = await getStudySessionOwner(sessionId)
  if (ownerId !== user!.id) return NextResponse.json({ error: 'Session not found' }, { status: 404 })

  const questionDetail = await fetchStudyQuestion(questionId)
  if (!questionDetail) return NextResponse.json({ error: 'Question not found' }, { status: 404 })

  const isCorrect = chosenIndex === questionDetail.correctIndex
  await recordStudyAnswer(sessionId, user!.id, questionId, chosenIndex, isCorrect, timeSpentMs)

  const { rows: sessionRows } = await getPool().query(
    `SELECT exam_id FROM study_sessions WHERE id = $1`, [sessionId]
  )
  const examId = (sessionRows[0] as { exam_id: string }).exam_id

  const { rows: masteryRows } = await getPool().query(
    `SELECT mastery_probability FROM user_topic_mastery WHERE user_id = $1 AND topic_id = $2`,
    [user!.id, questionDetail.topicId]
  )
  const priorMastery = masteryRows.length > 0
    ? parseFloat((masteryRows[0] as { mastery_probability: string }).mastery_probability)
    : 0.3

  const { rows: schedRows } = await getPool().query(
    `SELECT interval_days, ease_factor, repetition_count FROM user_question_schedule
     WHERE user_id = $1 AND question_id = $2`,
    [user!.id, questionId]
  )
  const sm2Record = schedRows.length > 0
    ? {
        intervalDays:     parseFloat((schedRows[0] as { interval_days: string }).interval_days),
        easeFactor:       parseFloat((schedRows[0] as { ease_factor: string }).ease_factor),
        repetitionCount:  parseInt((schedRows[0] as { repetition_count: string }).repetition_count, 10),
      }
    : defaultSm2Record()

  const newMastery = updateMastery(priorMastery, isCorrect)
  const quality    = qualityFromCorrect(isCorrect, timeSpentMs)
  const sm2Result  = sm2Update(sm2Record, quality, new Date())

  await Promise.all([
    upsertQuestionSchedule(user!.id, questionId, sm2Result),
    updateTopicMastery(user!.id, questionDetail.topicId, newMastery),
  ])

  const candidates  = await getDueQuestions(user!.id, examId)
  const remaining   = candidates.filter(q => q.id !== questionId)
  const nextQ       = selectNextStudyQuestion(remaining, new Date())
  const nextDetail  = nextQ ? await fetchStudyQuestion(nextQ.id) : null

  return NextResponse.json({
    success: true,
    data: { isCorrect, explanation: questionDetail.explanation, newMastery, done: !nextDetail, question: nextDetail },
    error: null,
  })
}
```

- [ ] **Step 5: Implement `src/app/api/study/socratic/route.ts`**

```typescript
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/api/auth-guard'
import Anthropic from '@anthropic-ai/sdk'
import { trackUsage } from '@/lib/ai/usage'

const Schema = z.object({
  questionStem:  z.string().min(1).max(2000),
  chosenOption:  z.string().min(1).max(500),
  correctOption: z.string().min(1).max(500),
  isCorrect:     z.boolean(),
})

const anthropic = new Anthropic({ apiKey: process.env['ANTHROPIC_API_KEY'] })

export async function POST(req: Request) {
  const { user, error } = await requireAuth()
  if (error) return error

  let body: unknown
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const parsed = Schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request' }, { status: 422 })

  const { questionStem, chosenOption, correctOption, isCorrect } = parsed.data
  const model = user!.tier === 'premium' ? 'claude-sonnet-4-6' : 'claude-haiku-4-5-20251001'

  const prompt = isCorrect
    ? `The student answered correctly. Reinforce their understanding with 2 sentences explaining WHY this is right.\nQuestion: ${questionStem}\nCorrect answer: ${correctOption}`
    : `The student answered incorrectly. Guide them using the Socratic method — ask questions, do not state the answer.\nQuestion: ${questionStem}\nStudent chose: ${chosenOption}\nCorrect answer: ${correctOption}\nWrite 2-3 guiding sentences.`

  try {
    const message = await anthropic.messages.create({
      model, max_tokens: 300,
      messages: [{ role: 'user', content: prompt }],
    })
    const text = message.content[0]?.type === 'text' ? message.content[0].text : ''
    await trackUsage(user!.id, 'socratic_explanation', model, message.usage.input_tokens, message.usage.output_tokens)
    return NextResponse.json({ success: true, data: { explanation: text }, error: null })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'AI error' }, { status: 500 })
  }
}
```

- [ ] **Step 6: Run tests to verify they pass**

```powershell
pnpm test src/tests/api/study.test.ts 2>&1 | Select-String "Tests:|passed|failed"
pnpm type-check
```

Expected: 4 passed, type-check clean

- [ ] **Step 7: Commit**

```powershell
git add src/app/api/study/ src/tests/api/study.test.ts
git commit -m "feat: add study session API routes (start, answer, socratic)"
```

---

### Task 6: Study UI

**Files:**
- Create: `src/app/study/[sessionId]/page.tsx`
- Create: `src/app/study/[sessionId]/StudySession.tsx`

State machine: `loading → answering → answered → done → error`

- [ ] **Step 1: Implement `src/app/study/[sessionId]/page.tsx`** (server component — auth guard only)

```tsx
import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import StudySession from './StudySession'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Study Session' }

export default async function StudyPage({
  params,
  searchParams,
}: {
  params: Promise<{ sessionId: string }>
  searchParams: Promise<{ examId?: string }>
}) {
  const session = await auth()
  if (!session) redirect('/login')

  const { sessionId } = await params
  const { examId = '' } = await searchParams

  return (
    <main style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: 'var(--space-8) var(--space-4)', background: 'var(--color-bg)' }}>
      <div style={{ maxWidth: '680px', width: '100%' }}>
        <StudySession sessionId={sessionId} examId={examId} />
      </div>
    </main>
  )
}
```

- [ ] **Step 2: Implement `src/app/study/[sessionId]/StudySession.tsx`** (client component)

```tsx
'use client'
import { useState, useEffect, useCallback } from 'react'

interface Question {
  id: string; stem: string; options: string[]
  correctIndex: number; explanation: string; topicId: string
}

type Phase = 'loading' | 'answering' | 'answered' | 'done' | 'error'
const LABELS = ['A', 'B', 'C', 'D']

export default function StudySession({ sessionId, examId }: { sessionId: string; examId: string }) {
  const [question, setQuestion]       = useState<Question | null>(null)
  const [phase, setPhase]             = useState<Phase>('loading')
  const [chosen, setChosen]           = useState<number | null>(null)
  const [isCorrect, setIsCorrect]     = useState<boolean | null>(null)
  const [explanation, setExplanation] = useState<string | null>(null)
  const [socratic, setSocratic]       = useState<string | null>(null)
  const [loadingSoc, setLoadingSoc]   = useState(false)
  const [answeredCount, setAnsweredCount] = useState(0)
  const [errorMsg, setErrorMsg]       = useState<string | null>(null)
  const [startTime, setStartTime]     = useState(Date.now())

  const loadFirst = useCallback(async () => {
    if (!examId) { setPhase('error'); setErrorMsg('Missing exam ID.'); return }
    try {
      const res = await fetch('/api/study/start', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ examId }),
      })
      const body = (await res.json()) as { data: { question: Question | null; done: boolean } }
      if (body.data.done || !body.data.question) { setPhase('done'); return }
      setQuestion(body.data.question); setStartTime(Date.now()); setPhase('answering')
    } catch { setErrorMsg('Failed to start session.'); setPhase('error') }
  }, [examId])

  useEffect(() => { void loadFirst() }, [loadFirst])

  async function fetchSocratic(q: Question, ci: number, correct: boolean) {
    setLoadingSoc(true)
    try {
      const res = await fetch('/api/study/socratic', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionStem: q.stem, chosenOption: q.options[ci] ?? '', correctOption: q.options[q.correctIndex] ?? '', isCorrect: correct }),
      })
      const body = (await res.json()) as { data: { explanation: string } }
      setSocratic(body.data.explanation)
    } catch { /* optional, silent */ } finally { setLoadingSoc(false) }
  }

  function handleAnswer(index: number) {
    if (phase !== 'answering' || !question) return
    const correct = index === question.correctIndex
    setChosen(index); setIsCorrect(correct); setExplanation(question.explanation); setPhase('answered')
    void fetchSocratic(question, index, correct)
  }

  async function handleNext() {
    if (!question || chosen === null) return
    setPhase('loading'); setSocratic(null)
    try {
      const res = await fetch('/api/study/answer', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, questionId: question.id, chosenIndex: chosen, timeSpentMs: Date.now() - startTime }),
      })
      const body = (await res.json()) as { data: { done: boolean; question: Question | null } }
      if (body.data.done || !body.data.question) { setAnsweredCount(c => c + 1); setPhase('done'); return }
      setQuestion(body.data.question); setChosen(null); setIsCorrect(null); setExplanation(null)
      setAnsweredCount(c => c + 1); setStartTime(Date.now()); setPhase('answering')
    } catch { setErrorMsg('Something went wrong.'); setPhase('error') }
  }

  if (phase === 'loading') return <div style={{ textAlign: 'center', padding: 'var(--space-16)', color: 'var(--color-text-muted)' }}>Loading…</div>
  if (phase === 'error')   return <div style={{ textAlign: 'center', padding: 'var(--space-12)', color: 'var(--color-error)' }}>{errorMsg ?? 'Error'}</div>
  if (phase === 'done') return (
    <div style={{ textAlign: 'center', padding: 'var(--space-12)' }}>
      <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-3xl)', color: 'var(--color-primary)', marginBottom: 'var(--space-4)' }}>Session complete.</h2>
      <p style={{ color: 'var(--color-text-muted)', marginBottom: 'var(--space-8)' }}>{answeredCount} questions answered.</p>
      <div style={{ display: 'flex', gap: 'var(--space-4)', justifyContent: 'center' }}>
        <a href="/dashboard" style={{ padding: 'var(--space-4) var(--space-8)', background: 'var(--color-primary)', color: 'var(--color-text-on-primary)', borderRadius: 'var(--radius-md)', fontWeight: 700, textDecoration: 'none' }}>Dashboard</a>
        <a href={`/study/new?examId=${examId}`} style={{ padding: 'var(--space-4) var(--space-8)', background: 'var(--color-surface)', color: 'var(--color-primary)', borderRadius: 'var(--radius-md)', fontWeight: 700, border: '1px solid var(--color-border)', textDecoration: 'none' }}>Study more</a>
      </div>
    </div>
  )
  if (!question) return null

  return (
    <div>
      <div style={{ background: 'var(--color-surface)', borderRadius: 'var(--radius-xl)', padding: 'var(--space-8)', boxShadow: 'var(--shadow-lg)', marginBottom: 'var(--space-6)' }}>
        <p style={{ fontFamily: 'var(--font-body)', fontSize: 'var(--text-xl)', color: 'var(--color-text)', lineHeight: 'var(--leading-normal)', margin: 0 }}>{question.stem}</p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', marginBottom: 'var(--space-6)' }}>
        {question.options.map((opt, i) => {
          let bg = 'var(--color-surface)', border = '1px solid var(--color-border)', color = 'var(--color-text)'
          if (phase === 'answered') {
            if (i === question.correctIndex) { bg = 'var(--color-mastered)'; border = '2px solid var(--color-mastered)'; color = 'var(--color-text-on-primary)' }
            else if (i === chosen) { bg = 'var(--color-weak)'; border = '2px solid var(--color-weak)'; color = 'var(--color-text-on-primary)' }
          }
          return (
            <button key={i} onClick={() => handleAnswer(i)} disabled={phase === 'answered'}
              style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)', padding: 'var(--space-4)', background: bg, border, borderRadius: 'var(--radius-md)', cursor: phase === 'answered' ? 'default' : 'pointer', textAlign: 'left' as const, color, boxShadow: 'var(--shadow-sm)' }}>
              <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '2rem', height: '2rem', borderRadius: 'var(--radius-full)', fontWeight: 700, fontSize: 'var(--text-sm)', flexShrink: 0, color: 'inherit' }}>{LABELS[i]}</span>
              <span style={{ fontSize: 'var(--text-base)' }}>{opt}</span>
            </button>
          )
        })}
      </div>

      {phase === 'answered' && (
        <div>
          <div style={{ padding: 'var(--space-4)', borderRadius: 'var(--radius-md)', background: isCorrect ? 'var(--color-mastered)' : 'var(--color-weak)', color: 'var(--color-text-on-primary)', marginBottom: 'var(--space-4)', fontWeight: 600 }}>
            {isCorrect ? 'Correct!' : 'Incorrect'}
          </div>
          {explanation && (
            <div style={{ background: 'var(--color-surface)', borderRadius: 'var(--radius-md)', padding: 'var(--space-4)', marginBottom: 'var(--space-4)', borderLeft: '3px solid var(--color-border)', color: 'var(--color-text)', fontSize: 'var(--text-sm)' }}>
              {explanation}
            </div>
          )}
          <div style={{ background: 'var(--color-surface-raised)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-4) var(--space-6)', marginBottom: 'var(--space-6)', borderTop: '2px solid var(--color-accent)', minHeight: '3rem' }}>
            <p style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--color-accent)', marginBottom: 'var(--space-2)', letterSpacing: '0.05em', textTransform: 'uppercase' as const }}>Socratic Tutor</p>
            {loadingSoc
              ? <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>Thinking…</p>
              : socratic
                ? <p style={{ color: 'var(--color-text)', fontSize: 'var(--text-sm)', lineHeight: 'var(--leading-normal)', margin: 0 }}>{socratic}</p>
                : <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>—</p>
            }
          </div>
          <div style={{ textAlign: 'center' }}>
            <button onClick={() => { void handleNext() }}
              style={{ padding: 'var(--space-3) var(--space-8)', background: 'var(--color-primary)', color: 'var(--color-text-on-primary)', borderRadius: 'var(--radius-md)', fontWeight: 700, fontSize: 'var(--text-base)', border: 'none', cursor: 'pointer' }}>
              Next →
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Type-check**

```powershell
pnpm type-check
```

Expected: no errors

- [ ] **Step 4: Commit and push**

```powershell
git add src/app/study/
git commit -m "feat: add study session UI with Socratic panel"
git push origin master
```

---

## Self-Review

**Spec coverage:** ✅ BKT mastery updates after each answer, SM-2 scheduling (interval × ease factor), multi-criteria selector (overdue + weak topic + optimal difficulty), session lifecycle (start → answer → next → done), Socratic AI explanations (Haiku free / Sonnet premium), usage tracking in `usage_events`.

**Placeholder scan:** None — all steps contain complete, runnable code.

**Type consistency:** `StudyQuestionWithSchedule` exported from `selector.ts`, imported by `study.ts` and `start/route.ts`. `Sm2Update` returned by `sm2Update()` matches `upsertQuestionSchedule` parameter. `trackUsage` signature `(userId, eventType, model, inputTokens, outputTokens)` is consistent across all callers.
