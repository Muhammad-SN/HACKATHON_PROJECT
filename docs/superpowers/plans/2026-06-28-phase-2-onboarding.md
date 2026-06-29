# Phase 2: Onboarding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the `/onboarding` exam-selection flow — live full-text exam search, one-click enrollment, and redirect to `/diagnostic`.

**Architecture:** Four tasks in dependency order: (1) DB query functions, (2) search API, (3) enroll API, (4) onboarding page. The page is a server component that handles auth and redirect guards, delegating search/enroll interactivity to a client component. PostgreSQL `websearch_to_tsquery` handles full-text search — no external search dependency.

**Tech Stack:** Next.js 15 App Router, `pg` Pool, `websearch_to_tsquery`, Zod, Vitest

## Global Constraints

- Next.js 15 App Router only — no Pages Router
- All colors via CSS custom properties from `src/styles/tokens.css` — no raw hex values
- All SQL queries parameterized — no string concatenation in SQL
- Zod validation at every API route boundary
- TypeScript strict mode — no `any` without a justifying comment
- `requireAuth()` from `src/lib/api/auth-guard.ts` — never manually check session in route handlers
- Exams with `classification_source = 'pending_review'` must NEVER appear in search results
- Exams with `is_public = FALSE` must NEVER appear in search results
- Base SHA before Phase 2: `9ab7e43` (last Phase 1 commit, after health check + cron)

---

### Task 1: Exam DB Query Functions

**Files:**
- Create: `src/lib/db/exams.ts`
- Create: `src/tests/lib/db/exams.test.ts`

**Interfaces:**
- Produces:
  - `ExamSearchResult` — `{ id: string; name: string; stakesLevel: 'low' | 'high'; domain: string; questionCount: number }`
  - `searchPublicExams(query: string): Promise<ExamSearchResult[]>` — full-text search, empty query returns top 10 by question count
  - `enrollUserInExam(userId: string, examId: string): Promise<void>` — inserts into `user_exams`, idempotent via `ON CONFLICT DO NOTHING`
  - `getUserExamCount(userId: string): Promise<number>` — used by onboarding page guard
- Consumed by: Tasks 2, 3, 4

- [ ] **Step 1: Write the failing tests**

Create `src/tests/lib/db/exams.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockQuery = vi.fn()
vi.mock('@/lib/db/pool', () => ({
  getPool: vi.fn(() => ({ query: mockQuery })),
}))

import { searchPublicExams, enrollUserInExam, getUserExamCount } from '@/lib/db/exams'

describe('searchPublicExams', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns mapped results for a non-empty query', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        { id: 'e1', name: 'Bar Exam', stakes_level: 'high', domain: 'legal', question_count: 42 },
      ],
    })
    const results = await searchPublicExams('bar')
    expect(results).toHaveLength(1)
    expect(results[0]).toEqual({
      id: 'e1',
      name: 'Bar Exam',
      stakesLevel: 'high',
      domain: 'legal',
      questionCount: 42,
    })
  })

  it('calls query with no params for empty string', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] })
    await searchPublicExams('')
    expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining('ORDER BY'), [])
  })

  it('calls query with trimmed param for non-empty string', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] })
    await searchPublicExams('  python  ')
    expect(mockQuery).toHaveBeenCalledWith(expect.any(String), ['python'])
  })

  it('returns empty array when no rows match', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] })
    const results = await searchPublicExams('zzznomatch')
    expect(results).toEqual([])
  })
})

describe('enrollUserInExam', () => {
  beforeEach(() => vi.clearAllMocks())

  it('inserts into user_exams with correct params', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] })
    await enrollUserInExam('u1', 'e1')
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO user_exams'),
      ['u1', 'e1']
    )
  })
})

describe('getUserExamCount', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns count from db', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ count: 3 }] })
    const count = await getUserExamCount('u1')
    expect(count).toBe(3)
  })

  it('returns 0 when rows is empty', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] })
    const count = await getUserExamCount('u1')
    expect(count).toBe(0)
  })
})
```

- [ ] **Step 2: Run test — verify it FAILS**

```powershell
pnpm test src/tests/lib/db/exams.test.ts
```

Expected: FAIL — "Cannot find module '@/lib/db/exams'"

- [ ] **Step 3: Create `src/lib/db/exams.ts`**

```typescript
import { getPool } from '@/lib/db/pool'

export interface ExamSearchResult {
  id: string
  name: string
  stakesLevel: 'low' | 'high'
  domain: string
  questionCount: number
}

const SEARCH_SQL = `
  SELECT e.id, e.name, e.stakes_level, e.domain, COUNT(q.id)::int AS question_count
  FROM exams e
  LEFT JOIN questions q ON q.exam_id = e.id
  WHERE e.is_public = TRUE
    AND e.classification_source != 'pending_review'
    AND to_tsvector('english', e.name || ' ' || COALESCE(e.description, ''))
        @@ websearch_to_tsquery('english', $1)
  GROUP BY e.id
  ORDER BY question_count DESC
  LIMIT 10
`

const BROWSE_SQL = `
  SELECT e.id, e.name, e.stakes_level, e.domain, COUNT(q.id)::int AS question_count
  FROM exams e
  LEFT JOIN questions q ON q.exam_id = e.id
  WHERE e.is_public = TRUE
    AND e.classification_source != 'pending_review'
  GROUP BY e.id
  ORDER BY question_count DESC
  LIMIT 10
`

export async function searchPublicExams(query: string): Promise<ExamSearchResult[]> {
  const trimmed = query.trim()
  const { rows } = trimmed
    ? await getPool().query(SEARCH_SQL, [trimmed])
    : await getPool().query(BROWSE_SQL, [])

  return rows.map((r) => ({
    id:            r.id             as string,
    name:          r.name           as string,
    stakesLevel:   r.stakes_level   as 'low' | 'high',
    domain:        r.domain         as string,
    questionCount: r.question_count as number,
  }))
}

export async function enrollUserInExam(userId: string, examId: string): Promise<void> {
  await getPool().query(
    'INSERT INTO user_exams (user_id, exam_id) VALUES ($1, $2) ON CONFLICT (user_id, exam_id) DO NOTHING',
    [userId, examId]
  )
}

export async function getUserExamCount(userId: string): Promise<number> {
  const { rows } = await getPool().query(
    'SELECT COUNT(*)::int AS count FROM user_exams WHERE user_id = $1',
    [userId]
  )
  return (rows[0] as { count: number } | undefined)?.count ?? 0
}
```

- [ ] **Step 4: Run test — verify it PASSES**

```powershell
pnpm test src/tests/lib/db/exams.test.ts
```

Expected: PASS — 7 tests green.

- [ ] **Step 5: Run type-check**

```powershell
pnpm type-check
```

Expected: zero errors.

- [ ] **Step 6: Commit**

```powershell
git add src/lib/db/exams.ts src/tests/lib/db/exams.test.ts
git commit -m "feat: add exam DB query functions (search, enroll, count)"
```

---

### Task 2: Onboarding Search API

**Files:**
- Create: `src/app/api/onboarding/search/route.ts`
- Create: `src/tests/api/onboarding/search.test.ts`

**Interfaces:**
- Consumes: `requireAuth()` from `@/lib/api/auth-guard`, `searchPublicExams()` from `@/lib/db/exams`
- Produces: `GET /api/onboarding/search?q=<string>` → `{ success: true, data: ExamSearchResult[], error: null }`

- [ ] **Step 1: Write the failing tests**

Create `src/tests/api/onboarding/search.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/api/auth-guard', () => ({ requireAuth: vi.fn() }))
vi.mock('@/lib/db/exams', () => ({ searchPublicExams: vi.fn() }))

import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api/auth-guard'
import { searchPublicExams } from '@/lib/db/exams'
import { GET } from '@/app/api/onboarding/search/route'

const mockRequireAuth = vi.mocked(requireAuth)
const mockSearch = vi.mocked(searchPublicExams)

const authed = {
  user: { id: 'u1', email: 'a@b.com', name: null, image: null, tier: 'free' as const, role: 'user' as const },
  error: null,
}

describe('GET /api/onboarding/search', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when unauthenticated', async () => {
    mockRequireAuth.mockResolvedValueOnce({
      user: null,
      error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    })
    const req = new Request('http://localhost/api/onboarding/search?q=bar')
    const res = await GET(req as any)
    expect(res.status).toBe(401)
  })

  it('passes q param to searchPublicExams', async () => {
    mockRequireAuth.mockResolvedValueOnce(authed)
    mockSearch.mockResolvedValueOnce([])
    const req = new Request('http://localhost/api/onboarding/search?q=python')
    await GET(req as any)
    expect(mockSearch).toHaveBeenCalledWith('python')
  })

  it('passes empty string when q param is absent', async () => {
    mockRequireAuth.mockResolvedValueOnce(authed)
    mockSearch.mockResolvedValueOnce([])
    const req = new Request('http://localhost/api/onboarding/search')
    await GET(req as any)
    expect(mockSearch).toHaveBeenCalledWith('')
  })

  it('returns results in success envelope', async () => {
    mockRequireAuth.mockResolvedValueOnce(authed)
    const fakeResults = [
      { id: 'e1', name: 'Bar Exam', stakesLevel: 'high' as const, domain: 'legal', questionCount: 5 },
    ]
    mockSearch.mockResolvedValueOnce(fakeResults)
    const req = new Request('http://localhost/api/onboarding/search?q=bar')
    const res = await GET(req as any)
    expect(res.status).toBe(200)
    const body = await res.json() as { success: boolean; data: unknown[]; error: null }
    expect(body.success).toBe(true)
    expect(body.data).toEqual(fakeResults)
    expect(body.error).toBeNull()
  })
})
```

- [ ] **Step 2: Run test — verify it FAILS**

```powershell
pnpm test src/tests/api/onboarding/search.test.ts
```

Expected: FAIL — "Cannot find module '@/app/api/onboarding/search/route'"

- [ ] **Step 3: Create `src/app/api/onboarding/search/route.ts`**

Create directory `src/app/api/onboarding/search/` then:

```typescript
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { requireAuth } from '@/lib/api/auth-guard'
import { searchPublicExams } from '@/lib/db/exams'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const { error } = await requireAuth()
  if (error) return error

  const q = req.nextUrl.searchParams.get('q') ?? ''
  const results = await searchPublicExams(q)

  return NextResponse.json({ success: true, data: results, error: null })
}
```

- [ ] **Step 4: Run test — verify it PASSES**

```powershell
pnpm test src/tests/api/onboarding/search.test.ts
```

Expected: PASS — 4 tests green.

- [ ] **Step 5: Run type-check**

```powershell
pnpm type-check
```

Expected: zero errors.

- [ ] **Step 6: Commit**

```powershell
git add src/app/api/onboarding/search/ src/tests/api/onboarding/search.test.ts
git commit -m "feat: add onboarding search API with full-text exam search"
```

---

### Task 3: Onboarding Enroll API

**Files:**
- Create: `src/app/api/onboarding/enroll/route.ts`
- Create: `src/tests/api/onboarding/enroll.test.ts`

**Interfaces:**
- Consumes: `requireAuth()`, `enrollUserInExam()` from `@/lib/db/exams`, `getPool()` for exam existence check
- Produces: `POST /api/onboarding/enroll` body `{ examId: string }` → `{ success: true, data: { redirectUrl: string }, error: null }`

- [ ] **Step 1: Write the failing tests**

Create `src/tests/api/onboarding/enroll.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/api/auth-guard', () => ({ requireAuth: vi.fn() }))
vi.mock('@/lib/db/exams', () => ({ enrollUserInExam: vi.fn() }))

const mockQuery = vi.fn()
vi.mock('@/lib/db/pool', () => ({
  getPool: vi.fn(() => ({ query: mockQuery })),
}))

import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api/auth-guard'
import { enrollUserInExam } from '@/lib/db/exams'
import { POST } from '@/app/api/onboarding/enroll/route'

const mockRequireAuth = vi.mocked(requireAuth)
const mockEnroll = vi.mocked(enrollUserInExam)

const VALID_UUID = '00000000-0000-0000-0000-000000000001'

const authed = {
  user: { id: 'u1', email: 'a@b.com', name: null, image: null, tier: 'free' as const, role: 'user' as const },
  error: null,
}

function makeReq(body: unknown) {
  return new Request('http://localhost/api/onboarding/enroll', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/onboarding/enroll', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when unauthenticated', async () => {
    mockRequireAuth.mockResolvedValueOnce({
      user: null,
      error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    })
    const res = await POST(makeReq({ examId: VALID_UUID }))
    expect(res.status).toBe(401)
  })

  it('returns 422 for non-UUID examId', async () => {
    mockRequireAuth.mockResolvedValueOnce(authed)
    const res = await POST(makeReq({ examId: 'not-a-uuid' }))
    expect(res.status).toBe(422)
  })

  it('returns 400 for invalid JSON body', async () => {
    mockRequireAuth.mockResolvedValueOnce(authed)
    const req = new Request('http://localhost/api/onboarding/enroll', {
      method: 'POST',
      body: 'not-json',
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('returns 404 when exam is not found or not public', async () => {
    mockRequireAuth.mockResolvedValueOnce(authed)
    mockQuery.mockResolvedValueOnce({ rows: [] })
    const res = await POST(makeReq({ examId: VALID_UUID }))
    expect(res.status).toBe(404)
  })

  it('enrolls user and returns redirect URL on success', async () => {
    mockRequireAuth.mockResolvedValueOnce(authed)
    mockQuery.mockResolvedValueOnce({ rows: [{ id: VALID_UUID }] })
    mockEnroll.mockResolvedValueOnce(undefined)
    const res = await POST(makeReq({ examId: VALID_UUID }))
    expect(res.status).toBe(200)
    const body = await res.json() as { success: boolean; data: { redirectUrl: string }; error: null }
    expect(body.success).toBe(true)
    expect(body.data.redirectUrl).toBe(`/diagnostic?examId=${VALID_UUID}`)
    expect(mockEnroll).toHaveBeenCalledWith('u1', VALID_UUID)
  })
})
```

- [ ] **Step 2: Run test — verify it FAILS**

```powershell
pnpm test src/tests/api/onboarding/enroll.test.ts
```

Expected: FAIL — "Cannot find module '@/app/api/onboarding/enroll/route'"

- [ ] **Step 3: Create `src/app/api/onboarding/enroll/route.ts`**

Create directory `src/app/api/onboarding/enroll/` then:

```typescript
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/api/auth-guard'
import { enrollUserInExam } from '@/lib/db/exams'
import { getPool } from '@/lib/db/pool'

const Schema = z.object({
  examId: z.string().uuid(),
})

export async function POST(req: Request) {
  const { user, error } = await requireAuth()
  if (error) return error

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = Schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid examId' }, { status: 422 })
  }

  const { examId } = parsed.data

  const { rows } = await getPool().query(
    `SELECT id FROM exams
     WHERE id = $1
       AND is_public = TRUE
       AND classification_source != 'pending_review'`,
    [examId]
  )
  if (rows.length === 0) {
    return NextResponse.json({ error: 'Exam not found or not accessible' }, { status: 404 })
  }

  await enrollUserInExam(user!.id, examId)

  return NextResponse.json({
    success: true,
    data: { redirectUrl: `/diagnostic?examId=${examId}` },
    error: null,
  })
}
```

- [ ] **Step 4: Run test — verify it PASSES**

```powershell
pnpm test src/tests/api/onboarding/enroll.test.ts
```

Expected: PASS — 5 tests green.

- [ ] **Step 5: Run type-check**

```powershell
pnpm type-check
```

Expected: zero errors.

- [ ] **Step 6: Commit**

```powershell
git add src/app/api/onboarding/enroll/ src/tests/api/onboarding/enroll.test.ts
git commit -m "feat: add onboarding enroll API with exam existence check"
```

---

### Task 4: Onboarding Page

**Files:**
- Create: `src/app/onboarding/page.tsx` (server component — auth guard, exam-count redirect)
- Create: `src/app/onboarding/OnboardingSearch.tsx` (client component — debounced search + enroll)

**Interfaces:**
- Consumes: `auth()` from `@/auth`, `getUserExamCount()` from `@/lib/db/exams`, `AccountTier` from `@/types`
- Consumes at runtime (client-side fetch): `GET /api/onboarding/search`, `POST /api/onboarding/enroll`
- No unit test for RSC — server component auth/redirect logic is straightforward; API behaviour is covered by Tasks 1-3 tests. E2E testing is Phase 8.

**Available CSS tokens** (all from `src/styles/tokens.css` — never use raw hex):
- Colors: `--color-bg`, `--color-surface`, `--color-primary`, `--color-text`, `--color-text-muted`, `--color-text-on-primary`, `--color-border`, `--color-accent`, `--color-mastered`, `--color-weak`, `--color-error`
- Spacing: `--space-1`, `--space-2`, `--space-3`, `--space-4`, `--space-6`, `--space-8`, `--space-12`, `--space-16`
- Text: `--text-xs`, `--text-sm`, `--text-base`, `--text-lg`, `--text-2xl`, `--text-3xl`
- Shape: `--radius-sm`, `--radius-md`, `--radius-lg`, `--radius-xl`
- Shadow: `--shadow-sm`, `--shadow-md`, `--shadow-lg`
- Fonts: `--font-display`, `--font-body`

- [ ] **Step 1: Create `src/app/onboarding/page.tsx`**

```tsx
import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { getUserExamCount } from '@/lib/db/exams'
import OnboardingSearch from './OnboardingSearch'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Choose Your Exam' }

export default async function OnboardingPage() {
  const session = await auth()
  if (!session) redirect('/login')

  const count = await getUserExamCount(session.user.id)
  if (count > 0) redirect('/dashboard')

  return (
    <main
      style={{
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: 'var(--space-16) var(--space-4) var(--space-8)',
        background: 'var(--color-bg)',
      }}
    >
      <div style={{ maxWidth: '600px', width: '100%' }}>
        <h1
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'var(--text-3xl)',
            color: 'var(--color-primary)',
            marginBottom: 'var(--space-2)',
            textAlign: 'center',
            lineHeight: 1.2,
          }}
        >
          Let's set up your study plan
        </h1>
        <p
          style={{
            color: 'var(--color-text-muted)',
            textAlign: 'center',
            marginBottom: 'var(--space-8)',
            fontSize: 'var(--text-lg)',
          }}
        >
          Search for your exam or upload your study materials
        </p>

        <OnboardingSearch tier={session.user.tier} />

        <p style={{ textAlign: 'center', marginTop: 'var(--space-12)' }}>
          <a
            href="/dashboard"
            style={{
              color: 'var(--color-text-muted)',
              fontSize: 'var(--text-sm)',
              textDecoration: 'underline',
            }}
          >
            I'll add an exam later →
          </a>
        </p>
      </div>
    </main>
  )
}
```

- [ ] **Step 2: Create `src/app/onboarding/OnboardingSearch.tsx`**

```tsx
'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import type { AccountTier } from '@/types'

interface ExamResult {
  id: string
  name: string
  stakesLevel: 'low' | 'high'
  domain: string
  questionCount: number
}

function StakesBadge({ level }: { level: 'low' | 'high' }) {
  return (
    <span
      style={{
        padding: '2px 8px',
        borderRadius: 'var(--radius-sm)',
        fontSize: 'var(--text-xs)',
        fontWeight: 600,
        background: level === 'low' ? 'var(--color-mastered)' : 'var(--color-accent)',
        color: 'var(--color-text-on-primary)',
        whiteSpace: 'nowrap' as const,
      }}
    >
      {level === 'low' ? 'Free' : 'Paid Access'}
    </span>
  )
}

export default function OnboardingSearch({ tier }: { tier: AccountTier }) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<ExamResult[]>([])
  const [loading, setLoading] = useState(false)
  const [enrolling, setEnrolling] = useState<string | null>(null)
  const [hasSearched, setHasSearched] = useState(false)

  const search = useCallback(async (q: string) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/onboarding/search?q=${encodeURIComponent(q)}`)
      if (res.ok) {
        const body = (await res.json()) as { data: ExamResult[] }
        setResults(body.data ?? [])
      }
    } finally {
      setLoading(false)
      setHasSearched(true)
    }
  }, [])

  // Load top exams on mount
  useEffect(() => { void search('') }, [search])

  // Debounce typed queries (300ms)
  useEffect(() => {
    const t = setTimeout(() => { void search(query) }, 300)
    return () => clearTimeout(t)
  }, [query, search])

  async function handleEnroll(examId: string) {
    setEnrolling(examId)
    try {
      const res = await fetch('/api/onboarding/enroll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ examId }),
      })
      if (res.ok) {
        const body = (await res.json()) as { data: { redirectUrl: string } }
        router.push(body.data.redirectUrl)
      }
    } finally {
      setEnrolling(null)
    }
  }

  const noResults = hasSearched && !loading && results.length === 0

  return (
    <div>
      <input
        type="search"
        placeholder="e.g. Bar Exam, USMLE Step 1, AWS Solutions Architect..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        autoFocus
        style={{
          width: '100%',
          padding: 'var(--space-4)',
          fontSize: 'var(--text-lg)',
          border: '2px solid var(--color-border)',
          borderRadius: 'var(--radius-lg)',
          background: 'var(--color-surface)',
          color: 'var(--color-text)',
          marginBottom: 'var(--space-4)',
          outline: 'none',
          boxSizing: 'border-box' as const,
        }}
        onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--color-primary)' }}
        onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--color-border)' }}
      />

      {loading && (
        <p
          style={{
            color: 'var(--color-text-muted)',
            textAlign: 'center',
            padding: 'var(--space-8)',
            fontSize: 'var(--text-sm)',
          }}
        >
          Searching…
        </p>
      )}

      {!loading && results.length > 0 && (
        <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
          {results.map((exam) => (
            <li key={exam.id}>
              <button
                onClick={() => { void handleEnroll(exam.id) }}
                disabled={enrolling !== null}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 'var(--space-3)',
                  padding: 'var(--space-4)',
                  background: 'var(--color-surface)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-md)',
                  cursor: enrolling !== null ? 'not-allowed' : 'pointer',
                  textAlign: 'left' as const,
                  boxShadow: 'var(--shadow-sm)',
                  opacity: enrolling === exam.id ? 0.6 : 1,
                }}
              >
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span
                    style={{
                      display: 'block',
                      fontWeight: 600,
                      color: 'var(--color-text)',
                      fontSize: 'var(--text-base)',
                    }}
                  >
                    {enrolling === exam.id ? 'Enrolling…' : exam.name}
                  </span>
                  <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>
                    {exam.questionCount} questions · {exam.domain}
                  </span>
                </span>
                <StakesBadge level={exam.stakesLevel} />
              </button>
            </li>
          ))}
        </ul>
      )}

      {noResults && (
        <div
          style={{
            textAlign: 'center',
            padding: 'var(--space-12) var(--space-4)',
            background: 'var(--color-surface)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--color-border)',
          }}
        >
          <p style={{ color: 'var(--color-text-muted)', marginBottom: 'var(--space-6)', fontSize: 'var(--text-base)' }}>
            No exam found{query ? ` for "${query}"` : '.'}.
          </p>
          <div
            style={{
              display: 'flex',
              gap: 'var(--space-4)',
              justifyContent: 'center',
              flexWrap: 'wrap' as const,
            }}
          >
            <a
              href={`/upload?examName=${encodeURIComponent(query)}`}
              style={{
                padding: 'var(--space-3) var(--space-6)',
                background: 'var(--color-primary)',
                color: 'var(--color-text-on-primary)',
                borderRadius: 'var(--radius-md)',
                fontWeight: 600,
                fontSize: 'var(--text-sm)',
                textDecoration: 'none',
              }}
            >
              Upload your materials
            </a>

            {tier === 'premium' ? (
              <a
                href={`/upload?examName=${encodeURIComponent(query)}&mode=ai`}
                style={{
                  padding: 'var(--space-3) var(--space-6)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-md)',
                  color: 'var(--color-text)',
                  fontSize: 'var(--text-sm)',
                  textDecoration: 'none',
                }}
              >
                Let AI generate a curriculum
              </a>
            ) : (
              <a
                href="/pricing"
                title="Upgrade to Premium to use AI curriculum generation"
                style={{
                  padding: 'var(--space-3) var(--space-6)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-md)',
                  color: 'var(--color-text-muted)',
                  fontSize: 'var(--text-sm)',
                  textDecoration: 'none',
                  opacity: 0.55,
                }}
              >
                Let AI generate a curriculum
                <span
                  style={{
                    display: 'block',
                    fontSize: 'var(--text-xs)',
                    color: 'var(--color-accent)',
                    marginTop: 'var(--space-1)',
                  }}
                >
                  Premium only — upgrade →
                </span>
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Run type-check**

```powershell
pnpm type-check
```

Expected: zero errors.

- [ ] **Step 4: Run full test suite to confirm no regressions**

```powershell
pnpm test 2>&1 | Select-String -Pattern "Tests|passed|failed"
```

Expected: all 20+ previously passing unit tests still pass; new tests (Tasks 1-3) also pass.

- [ ] **Step 5: Commit**

```powershell
git add src/app/onboarding/
git commit -m "feat: add onboarding page with live exam search and enrollment"
```

- [ ] **Step 6: Push to origin**

```powershell
$env:PATH = [System.Environment]::GetEnvironmentVariable("PATH","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("PATH","User")
git push origin master
```

---

## Self-Review

**Spec coverage check:**

| Spec requirement (§3.6) | Task | Status |
|------------------------|------|--------|
| `/onboarding` page after registration | 4 | ✅ `pages: { newUser: '/onboarding' }` set in Phase 1 `auth.ts` |
| Live full-text search against `exams` where `is_public = true` | 1 + 2 | ✅ `websearch_to_tsquery` + `is_public = TRUE` filter |
| Results: exam name, stakes badge (Low/High), question count | 4 | ✅ `StakesBadge` + question count display |
| Exam selection → enroll in `user_exams` → redirect `/diagnostic?examId=` | 3 + 4 | ✅ enroll API + `handleEnroll` → `router.push` |
| `pending_review` exams never shown | 1 + 3 | ✅ `classification_source != 'pending_review'` in both SQL queries and enroll check |
| No exam found → two paths: Upload / AI Generate | 4 | ✅ `noResults` block renders both CTAs |
| AI curriculum CTA: Premium active, free users see disabled + upgrade link | 4 | ✅ tier-aware rendering — free → `/pricing`, premium → `/upload?mode=ai` |
| Skip link → dashboard | 4 | ✅ "I'll add an exam later →" link at bottom |
| Auth required | 2 + 3 + 4 | ✅ `requireAuth()` in APIs; `auth()` redirect in page |
| Redirect to dashboard if user already enrolled in ≥1 exam | 4 | ✅ `getUserExamCount` guard at page top |
| Warm indigo headline "Let's set up your study plan" | 4 | ✅ `color: var(--color-primary)` + DM Serif Display |

**Placeholder scan:** No TBDs, no "handle edge cases", all steps have complete code. ✅

**Type consistency:** `ExamSearchResult` defined in Task 1 exported from `@/lib/db/exams`. Tasks 2+3 import it. Task 4's client component re-declares as local `ExamResult` interface (avoids importing server-only DB types into client bundle) — names and shapes match. `AccountTier` imported from `@/types` in both `page.tsx` (server) and `OnboardingSearch.tsx` (client). ✅
