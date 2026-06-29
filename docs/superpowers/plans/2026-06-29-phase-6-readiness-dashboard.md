# Readiness Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an analytics dashboard that shows the user's predicted exam score, per-topic mastery heat map, and weak areas — rendered in dark mode using the existing CSS design token system.

**Architecture:** A pure-function readiness engine computes the predicted score and confidence interval from topic mastery data. A DB module fetches mastery rows. Two API routes expose the data. The `/progress` page is a dark-mode server component that composes three presentational components: ReadinessIsland (big score), MasteryHeatMap (topic grid), WeakAreaCard list.

**Tech Stack:** Next.js 15 App Router, Aurora PostgreSQL (`pg` pool), Zod, Vitest, CSS custom properties from `src/styles/tokens.css`

---

## File Map

| File | Role |
|------|------|
| `src/lib/engines/readiness.ts` | Pure functions: `predictedScore`, `confidenceInterval` |
| `src/lib/db/progress.ts` | DB queries: `getUserTopicMastery`, `getWeakTopics` |
| `src/app/api/progress/readiness/route.ts` | GET — returns predicted score + CI for an exam |
| `src/app/api/progress/mastery/route.ts` | GET — returns per-topic mastery list for an exam |
| `src/app/progress/page.tsx` | Server component — auth guard, dark mode layout, data fetching |
| `src/components/progress/ReadinessIsland.tsx` | Client component — big predicted score display |
| `src/components/progress/MasteryHeatMap.tsx` | Client component — topic mastery grid |
| `src/components/progress/WeakAreaCard.tsx` | Client component — single weak topic card |
| `src/tests/lib/engines/readiness.test.ts` | 6 unit tests for readiness engine |
| `src/tests/lib/db/progress.test.ts` | 3 unit tests for progress DB functions (mocked pool) |
| `src/tests/api/progress.test.ts` | 4 unit tests for progress API routes |

---

### Task 1: Readiness Engine

**Files:**
- Create: `src/lib/engines/readiness.ts`
- Test: `src/tests/lib/engines/readiness.test.ts`

**Formulas:**
- `predictedScore = Σ(weight × mastery) / Σ(weight) × 100` — clamp to [0, 100]
- `confidenceInterval = 1.96 × √(Σ(weight × (mastery − avg)²) / Σ(weight) / totalAttempts) × 100` — clamp to [0, 50]

- [ ] **Step 1: Write the failing tests**

```typescript
// src/tests/lib/engines/readiness.test.ts
import { describe, it, expect } from 'vitest'
import { predictedScore, confidenceInterval } from '@/lib/engines/readiness'

describe('predictedScore', () => {
  it('returns 0 for empty topic list', () => {
    expect(predictedScore([])).toBe(0)
  })

  it('computes weighted average × 100 for uniform weights', () => {
    const topics = [
      { mastery: 0.8, weight: 0.5 },
      { mastery: 0.6, weight: 0.5 },
    ]
    expect(predictedScore(topics)).toBeCloseTo(70, 1)
  })

  it('gives more influence to higher-weight topics', () => {
    const topics = [
      { mastery: 1.0, weight: 0.9 },
      { mastery: 0.0, weight: 0.1 },
    ]
    expect(predictedScore(topics)).toBeGreaterThan(80)
  })

  it('clamps result to [0, 100]', () => {
    const topics = [{ mastery: 1.5, weight: 1.0 }]
    expect(predictedScore(topics)).toBeLessThanOrEqual(100)
  })
})

describe('confidenceInterval', () => {
  it('returns 0 for empty topic list', () => {
    expect(confidenceInterval([], 0)).toBe(0)
  })

  it('returns 0 when totalAttempts is 0', () => {
    const topics = [{ mastery: 0.8, weight: 0.5 }]
    expect(confidenceInterval(topics, 0)).toBe(0)
  })

  it('returns a positive number for non-zero attempts and variance', () => {
    const topics = [
      { mastery: 0.8, weight: 0.5 },
      { mastery: 0.4, weight: 0.5 },
    ]
    expect(confidenceInterval(topics, 10)).toBeGreaterThan(0)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```powershell
pnpm test src/tests/lib/engines/readiness.test.ts 2>&1 | Select-String "Tests:|passed|failed|error"
```

Expected: FAIL — "Cannot find module '@/lib/engines/readiness'"

- [ ] **Step 3: Implement `src/lib/engines/readiness.ts`**

```typescript
export interface TopicMasteryInput {
  mastery: number
  weight: number
}

export function predictedScore(topics: TopicMasteryInput[]): number {
  if (topics.length === 0) return 0
  const totalWeight = topics.reduce((sum, t) => sum + t.weight, 0)
  if (totalWeight === 0) return 0
  const weighted = topics.reduce((sum, t) => sum + t.weight * t.mastery, 0)
  return Math.max(0, Math.min(100, (weighted / totalWeight) * 100))
}

export function confidenceInterval(topics: TopicMasteryInput[], totalAttempts: number): number {
  if (topics.length === 0 || totalAttempts === 0) return 0
  const totalWeight = topics.reduce((sum, t) => sum + t.weight, 0)
  if (totalWeight === 0) return 0
  const avg = topics.reduce((sum, t) => sum + t.weight * t.mastery, 0) / totalWeight
  const variance = topics.reduce((sum, t) => sum + t.weight * Math.pow(t.mastery - avg, 2), 0) / totalWeight
  return Math.max(0, Math.min(50, 1.96 * Math.sqrt(variance / totalAttempts) * 100))
}
```

- [ ] **Step 4: Run tests to verify they pass**

```powershell
pnpm test src/tests/lib/engines/readiness.test.ts 2>&1 | Select-String "Tests:|passed|failed"
```

Expected: 7 passed

- [ ] **Step 5: Commit**

```powershell
git add src/lib/engines/readiness.ts src/tests/lib/engines/readiness.test.ts
git commit -m "feat: add readiness prediction engine with weighted mastery and confidence interval"
```

---

### Task 2: Progress DB Functions

**Files:**
- Create: `src/lib/db/progress.ts`
- Test: `src/tests/lib/db/progress.test.ts`

Queries join `exam_topics` with `user_topic_mastery` using LEFT JOIN so topics with no study history return a default mastery of 0.3.

- [ ] **Step 1: Write the failing tests**

```typescript
// src/tests/lib/db/progress.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db/pool', () => ({
  getPool: vi.fn().mockReturnValue({ query: vi.fn() }),
}))

import { getPool } from '@/lib/db/pool'
import { getUserTopicMastery, getWeakTopics } from '@/lib/db/progress'

const mockQuery = (getPool as ReturnType<typeof vi.fn>)().query as ReturnType<typeof vi.fn>
beforeEach(() => vi.clearAllMocks())

describe('getUserTopicMastery', () => {
  it('maps DB rows to TopicMasteryRow shape', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{
        topic_id: 't-1', topic_name: 'Cardiology',
        mastery_probability: '0.72', weight: '0.3', attempts: '5',
      }],
    })
    const rows = await getUserTopicMastery('user-1', 'exam-1')
    expect(rows).toHaveLength(1)
    expect(rows[0]?.mastery).toBeCloseTo(0.72)
    expect(rows[0]?.topicName).toBe('Cardiology')
  })

  it('returns empty array when no topics exist', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] })
    const rows = await getUserTopicMastery('user-1', 'exam-1')
    expect(rows).toHaveLength(0)
  })
})

describe('getWeakTopics', () => {
  it('calls query with ORDER BY mastery ASC and correct params', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] })
    await getWeakTopics('user-1', 'exam-1', 3)
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('ASC'), ['user-1', 'exam-1', 3]
    )
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```powershell
pnpm test src/tests/lib/db/progress.test.ts 2>&1 | Select-String "Tests:|passed|failed|error"
```

Expected: FAIL

- [ ] **Step 3: Implement `src/lib/db/progress.ts`**

```typescript
import { getPool } from '@/lib/db/pool'

export interface TopicMasteryRow {
  topicId: string
  topicName: string
  mastery: number
  weight: number
  attempts: number
}

export async function getUserTopicMastery(userId: string, examId: string): Promise<TopicMasteryRow[]> {
  const { rows } = await getPool().query(
    `SELECT
       et.id             AS topic_id,
       et.name           AS topic_name,
       et.weight::float  AS weight,
       COALESCE(m.mastery_probability, 0.3) AS mastery_probability,
       COALESCE(m.attempts, 0)              AS attempts
     FROM exam_topics et
     LEFT JOIN user_topic_mastery m ON m.topic_id = et.id AND m.user_id = $1
     WHERE et.exam_id = $2
     ORDER BY et.weight DESC`,
    [userId, examId]
  )
  return rows.map((r) => ({
    topicId:   r.topic_id   as string,
    topicName: r.topic_name as string,
    mastery:   parseFloat(r.mastery_probability as string),
    weight:    parseFloat(r.weight as string),
    attempts:  parseInt(r.attempts as string, 10),
  }))
}

export async function getWeakTopics(userId: string, examId: string, limit: number): Promise<TopicMasteryRow[]> {
  const { rows } = await getPool().query(
    `SELECT
       et.id             AS topic_id,
       et.name           AS topic_name,
       et.weight::float  AS weight,
       COALESCE(m.mastery_probability, 0.3) AS mastery_probability,
       COALESCE(m.attempts, 0)              AS attempts
     FROM exam_topics et
     LEFT JOIN user_topic_mastery m ON m.topic_id = et.id AND m.user_id = $1
     WHERE et.exam_id = $2
     ORDER BY COALESCE(m.mastery_probability, 0.3) ASC
     LIMIT $3`,
    [userId, examId, limit]
  )
  return rows.map((r) => ({
    topicId:   r.topic_id   as string,
    topicName: r.topic_name as string,
    mastery:   parseFloat(r.mastery_probability as string),
    weight:    parseFloat(r.weight as string),
    attempts:  parseInt(r.attempts as string, 10),
  }))
}
```

- [ ] **Step 4: Run tests to verify they pass**

```powershell
pnpm test src/tests/lib/db/progress.test.ts 2>&1 | Select-String "Tests:|passed|failed"
```

Expected: 3 passed

- [ ] **Step 5: Commit**

```powershell
git add src/lib/db/progress.ts src/tests/lib/db/progress.test.ts
git commit -m "feat: add progress DB functions for topic mastery and weak area queries"
```

---

### Task 3: Progress API Routes

**Files:**
- Create: `src/app/api/progress/readiness/route.ts`
- Create: `src/app/api/progress/mastery/route.ts`
- Test: `src/tests/api/progress.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
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
```

- [ ] **Step 2: Run test to verify it fails**

```powershell
pnpm test src/tests/api/progress.test.ts 2>&1 | Select-String "Tests:|passed|failed|error"
```

Expected: FAIL — module not found

- [ ] **Step 3: Implement `src/app/api/progress/readiness/route.ts`**

```typescript
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api/auth-guard'
import { getUserTopicMastery } from '@/lib/db/progress'
import { predictedScore, confidenceInterval } from '@/lib/engines/readiness'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const { user, error } = await requireAuth()
  if (error) return error

  const { searchParams } = new URL(req.url)
  const examId = searchParams.get('examId')
  if (!examId) return NextResponse.json({ error: 'Missing examId' }, { status: 422 })

  const topics = await getUserTopicMastery(user!.id, examId)
  const totalAttempts = topics.reduce((sum, t) => sum + t.attempts, 0)

  return NextResponse.json({
    success: true,
    data: {
      predictedScore:     Math.round(predictedScore(topics) * 10) / 10,
      confidenceInterval: Math.round(confidenceInterval(topics, totalAttempts) * 10) / 10,
      topicCount:         topics.length,
      totalAttempts,
    },
    error: null,
  })
}
```

- [ ] **Step 4: Implement `src/app/api/progress/mastery/route.ts`**

```typescript
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api/auth-guard'
import { getUserTopicMastery, getWeakTopics } from '@/lib/db/progress'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const { user, error } = await requireAuth()
  if (error) return error

  const { searchParams } = new URL(req.url)
  const examId = searchParams.get('examId')
  if (!examId) return NextResponse.json({ error: 'Missing examId' }, { status: 422 })

  const [topics, weakTopics] = await Promise.all([
    getUserTopicMastery(user!.id, examId),
    getWeakTopics(user!.id, examId, 5),
  ])

  return NextResponse.json({
    success: true,
    data: { topics, weakTopics },
    error: null,
  })
}
```

- [ ] **Step 5: Run tests to verify they pass**

```powershell
pnpm test src/tests/api/progress.test.ts 2>&1 | Select-String "Tests:|passed|failed"
pnpm type-check
```

Expected: 4 passed, type-check clean

- [ ] **Step 6: Commit**

```powershell
git add src/app/api/progress/ src/tests/api/progress.test.ts
git commit -m "feat: add progress API routes for readiness score and topic mastery"
```

---

### Task 4: Progress UI (Dark Mode)

**Files:**
- Create: `src/app/progress/page.tsx`
- Create: `src/components/progress/ReadinessIsland.tsx`
- Create: `src/components/progress/MasteryHeatMap.tsx`
- Create: `src/components/progress/WeakAreaCard.tsx`

Dark mode tokens (defined in `src/styles/tokens.css`):
- `--color-bg-dark`, `--color-surface-dark`, `--color-primary-dark`
- `--color-text-dark`, `--color-text-muted-dark`, `--color-border-dark`
- `--color-mastered`, `--color-learning`, `--color-weak`, `--color-accent`

> The server component fetches readiness and mastery data directly via internal API calls. Do not call `getPool()` from inside a page component — always go through the API routes.

- [ ] **Step 1: Implement `src/components/progress/ReadinessIsland.tsx`**

```tsx
'use client'

export default function ReadinessIsland({
  predictedScore,
  confidenceInterval,
}: {
  predictedScore: number
  confidenceInterval: number
}) {
  const score = Math.round(predictedScore)
  const ci    = Math.round(confidenceInterval)

  const scoreColor =
    score >= 75 ? 'var(--color-mastered)' :
    score >= 50 ? 'var(--color-accent)'   :
    'var(--color-weak)'

  return (
    <div
      style={{
        background: 'var(--color-surface-dark)',
        borderRadius: 'var(--radius-xl)',
        padding: 'var(--space-8)',
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-8)',
        boxShadow: 'var(--shadow-lg)',
        border: '1px solid var(--color-border-dark)',
      }}
    >
      <div style={{ textAlign: 'center', flexShrink: 0 }}>
        <div
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'var(--text-hero)',
            color: scoreColor,
            lineHeight: 1,
          }}
        >
          {score}
        </div>
        <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted-dark)', marginTop: 'var(--space-1)' }}>
          / 100
        </div>
      </div>

      <div>
        <p style={{ fontSize: 'var(--text-lg)', color: 'var(--color-text-dark)', fontWeight: 600, margin: '0 0 var(--space-2) 0' }}>
          Predicted Exam Score
        </p>
        {ci > 0 && (
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted-dark)', margin: '0 0 var(--space-2) 0' }}>
            ±{ci} points confidence interval
          </p>
        )}
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted-dark)', margin: 0 }}>
          Based on your topic mastery across all studied questions.
        </p>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Implement `src/components/progress/MasteryHeatMap.tsx`**

```tsx
'use client'

export interface TopicRow {
  topicId: string
  topicName: string
  mastery: number
  weight: number
  attempts: number
}

function masteryColor(mastery: number): string {
  if (mastery >= 0.85) return 'var(--color-mastered)'
  if (mastery >= 0.60) return 'var(--color-accent)'
  if (mastery >= 0.35) return 'var(--color-learning)'
  return 'var(--color-weak)'
}

function masteryLabel(mastery: number): string {
  if (mastery >= 0.85) return 'Mastered'
  if (mastery >= 0.60) return 'Learning'
  if (mastery >= 0.35) return 'Developing'
  return 'Weak'
}

export default function MasteryHeatMap({ topics }: { topics: TopicRow[] }) {
  if (topics.length === 0) {
    return (
      <p style={{ color: 'var(--color-text-muted-dark)', fontSize: 'var(--text-sm)' }}>
        No topic mastery data yet. Complete a diagnostic or study session to see your map.
      </p>
    )
  }

  return (
    <div>
      <h2 style={{ fontSize: 'var(--text-xl)', color: 'var(--color-text-dark)', marginBottom: 'var(--space-4)', fontWeight: 600 }}>
        Topic Mastery
      </h2>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
          gap: 'var(--space-3)',
        }}
      >
        {topics.map((topic) => (
          <div
            key={topic.topicId}
            style={{
              background: 'var(--color-surface-dark)',
              borderRadius: 'var(--radius-md)',
              padding: 'var(--space-4)',
              border: '1px solid var(--color-border-dark)',
              borderLeft: `4px solid ${masteryColor(topic.mastery)}`,
            }}
          >
            <p style={{ fontWeight: 600, color: 'var(--color-text-dark)', margin: '0 0 var(--space-2) 0', fontSize: 'var(--text-sm)' }}>
              {topic.topicName}
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <div style={{ flex: 1, height: '6px', background: 'var(--color-border-dark)', borderRadius: 'var(--radius-full)', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${Math.round(topic.mastery * 100)}%`, background: masteryColor(topic.mastery), borderRadius: 'var(--radius-full)' }} />
              </div>
              <span style={{ fontSize: 'var(--text-xs)', color: masteryColor(topic.mastery), fontWeight: 700, flexShrink: 0 }}>
                {masteryLabel(topic.mastery)}
              </span>
            </div>
            {topic.attempts > 0 && (
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted-dark)', margin: 'var(--space-1) 0 0 0' }}>
                {topic.attempts} attempt{topic.attempts !== 1 ? 's' : ''}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Implement `src/components/progress/WeakAreaCard.tsx`**

```tsx
'use client'
import type { TopicRow } from './MasteryHeatMap'

export default function WeakAreaCard({ topic, examId }: { topic: TopicRow; examId: string }) {
  const pct = Math.round(topic.mastery * 100)

  return (
    <div
      style={{
        background: 'var(--color-surface-dark)',
        borderRadius: 'var(--radius-md)',
        padding: 'var(--space-4) var(--space-6)',
        marginBottom: 'var(--space-3)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        border: '1px solid var(--color-border-dark)',
        borderLeft: '4px solid var(--color-weak)',
      }}
    >
      <div>
        <p style={{ fontWeight: 600, color: 'var(--color-text-dark)', margin: 0 }}>
          {topic.topicName}
        </p>
        <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted-dark)', margin: 'var(--space-1) 0 0 0' }}>
          {pct}% mastery · {topic.attempts} attempt{topic.attempts !== 1 ? 's' : ''}
        </p>
      </div>
      <a
        href={`/study/new?examId=${examId}`}
        style={{
          padding: 'var(--space-2) var(--space-4)',
          background: 'var(--color-primary-dark)',
          color: 'var(--color-text-on-primary)',
          borderRadius: 'var(--radius-md)',
          fontSize: 'var(--text-sm)',
          fontWeight: 600,
          textDecoration: 'none',
          flexShrink: 0,
        }}
      >
        Study
      </a>
    </div>
  )
}
```

- [ ] **Step 4: Implement `src/app/progress/page.tsx`** (server component)

```tsx
import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import ReadinessIsland from '@/components/progress/ReadinessIsland'
import MasteryHeatMap, { type TopicRow } from '@/components/progress/MasteryHeatMap'
import WeakAreaCard from '@/components/progress/WeakAreaCard'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Progress' }

export default async function ProgressPage({
  searchParams,
}: {
  searchParams: Promise<{ examId?: string }>
}) {
  const session = await auth()
  if (!session) redirect('/login')

  const { examId } = await searchParams
  if (!examId) redirect('/dashboard')

  const base = process.env['NEXT_PUBLIC_APP_URL'] ?? 'http://localhost:3000'

  const [readinessRes, masteryRes] = await Promise.all([
    fetch(`${base}/api/progress/readiness?examId=${examId}`, { cache: 'no-store' }).catch(() => null),
    fetch(`${base}/api/progress/mastery?examId=${examId}`, { cache: 'no-store' }).catch(() => null),
  ])

  const readiness = readinessRes?.ok
    ? ((await readinessRes.json()) as { data: { predictedScore: number; confidenceInterval: number } }).data
    : { predictedScore: 0, confidenceInterval: 0 }

  const masteryData = masteryRes?.ok
    ? ((await masteryRes.json()) as { data: { topics: TopicRow[]; weakTopics: TopicRow[] } }).data
    : { topics: [], weakTopics: [] }

  return (
    <main
      style={{
        minHeight: '100dvh',
        background: 'var(--color-bg-dark)',
        padding: 'var(--space-8) var(--space-4)',
        color: 'var(--color-text-dark)',
        fontFamily: 'var(--font-body)',
      }}
    >
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>
        <h1
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'var(--text-3xl)',
            color: 'var(--color-text-dark)',
            marginBottom: 'var(--space-8)',
          }}
        >
          Your Progress
        </h1>

        <ReadinessIsland
          predictedScore={readiness.predictedScore}
          confidenceInterval={readiness.confidenceInterval}
        />

        <div style={{ marginTop: 'var(--space-8)' }}>
          <MasteryHeatMap topics={masteryData.topics} />
        </div>

        {masteryData.weakTopics.length > 0 && (
          <div style={{ marginTop: 'var(--space-8)' }}>
            <h2 style={{ fontSize: 'var(--text-xl)', color: 'var(--color-text-dark)', marginBottom: 'var(--space-4)', fontWeight: 600 }}>
              Focus Areas
            </h2>
            {masteryData.weakTopics.map((topic) => (
              <WeakAreaCard key={topic.topicId} topic={topic} examId={examId} />
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
```

- [ ] **Step 5: Type-check**

```powershell
pnpm type-check
```

Expected: no errors

- [ ] **Step 6: Commit and push**

```powershell
git add src/app/progress/ src/components/progress/
git commit -m "feat: add progress dashboard with readiness island, mastery heat map, and weak area cards"
git push origin master
```

---

## Self-Review

**Spec coverage:** ✅ Readiness prediction engine (weighted mastery average × 100), confidence interval (±1.96 × √(variance/attempts)), `/api/progress/readiness` and `/api/progress/mastery` routes, dark-mode `/progress` page, ReadinessIsland (big score with color thresholds), MasteryHeatMap (responsive topic grid with labeled progress bars), WeakAreaCard list with direct study links.

**Placeholder scan:** None — all steps contain complete, runnable code with no "TBD" or "add appropriate handling" language.

**Type consistency:** `TopicMasteryInput` (fields: `mastery`, `weight`) in `readiness.ts` matches what `getUserTopicMastery` returns as `TopicMasteryRow` — the API route maps `TopicMasteryRow` directly to `TopicMasteryInput` by destructuring. `TopicRow` is exported from `MasteryHeatMap.tsx` and imported by `WeakAreaCard.tsx` and `page.tsx` to ensure the same shape everywhere.
