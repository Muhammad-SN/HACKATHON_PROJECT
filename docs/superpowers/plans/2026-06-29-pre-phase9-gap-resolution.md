# Pre-Phase 9 Gap Resolution Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 8 integration test failures, create the 2 missing engine files (`socratic.ts` + `generator.ts`) with TDD, fix the `ClassificationSource` type mismatch, and add coverage for the mandatory `trackUsage` function.

**Architecture:** Extract Anthropic SDK calls from `src/app/api/study/socratic/route.ts` into a pure engine. Use vitest `exclude` to isolate DB integration tests so `pnpm test` is always green without a live database. Fix the type discrepancy between `check.ts` and the actual DB-stored classification source values.

**Tech Stack:** TypeScript, Vitest, Anthropic SDK (`claude-haiku-4-5-20251001` / `claude-sonnet-4-6`), Next.js 15 App Router, PostgreSQL (pg)

---

## File Map

| Operation | Path | Reason |
|---|---|---|
| Modify | `vitest.config.ts` | Exclude `*.integration.test.ts` from default run |
| Create | `vitest.config.integration.ts` | Separate config for DB tests |
| Create | `src/tests/lib/db/pool.integration.test.ts` | Move pool tests (need live DB) |
| Create | `src/tests/scripts/migrate.integration.test.ts` | Move migrate tests (need live DB) |
| Delete | `src/tests/lib/db/pool.test.ts` | Replaced by above |
| Delete | `src/tests/scripts/migrate.test.ts` | Replaced by above |
| Modify | `package.json` | Add `test:integration` script |
| Modify | `src/lib/access/check.ts` | Fix `ClassificationSource` type (line 2) |
| Create | `src/tests/lib/ai/usage.test.ts` | Tests for mandatory trackUsage |
| Create | `src/lib/engines/socratic.ts` | 3-step Socratic engine (spec gap) |
| Create | `src/tests/lib/engines/socratic.test.ts` | Tests for socratic engine |
| Modify | `src/app/api/study/socratic/route.ts` | Use engine instead of inline SDK |
| Create | `src/lib/engines/generator.ts` | Question generation engine (spec gap) |
| Create | `src/tests/lib/engines/generator.test.ts` | Tests for generator engine |

---

## Task 1 — Isolate integration tests (fixes all 8 failing tests)

**Files:**
- Create: `src/tests/lib/db/pool.integration.test.ts`
- Create: `src/tests/scripts/migrate.integration.test.ts`
- Create: `vitest.config.integration.ts`
- Modify: `vitest.config.ts`
- Modify: `package.json`
- Delete: `src/tests/lib/db/pool.test.ts`
- Delete: `src/tests/scripts/migrate.test.ts`

**Why:** `pool.test.ts` (3 failures) and `migrate.test.ts` (5 failures) connect to a live PostgreSQL database. They fail with `ECONNREFUSED` or missing env vars in any environment without a running database. The default `pnpm test` run should be infrastructure-free.

- [ ] **Step 1: Copy pool.test.ts → pool.integration.test.ts**

Create `src/tests/lib/db/pool.integration.test.ts` with the **exact same content** as `src/tests/lib/db/pool.test.ts`. Do not change any test logic.

- [ ] **Step 2: Copy migrate.test.ts → migrate.integration.test.ts**

Create `src/tests/scripts/migrate.integration.test.ts` with the **exact same content** as `src/tests/scripts/migrate.test.ts`. Do not change any test logic.

- [ ] **Step 3: Create vitest.config.integration.ts**

```typescript
import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    setupFiles: ['./src/tests/setup.ts'],
    include: ['src/tests/**/*.integration.test.ts'],
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
})
```

- [ ] **Step 4: Update vitest.config.ts**

Full replacement:
```typescript
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/tests/setup.ts'],
    include: ['src/tests/**/*.test.ts', 'src/tests/**/*.test.tsx'],
    exclude: ['src/tests/**/*.integration.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['src/tests/**/*.integration.test.ts'],
      thresholds: { lines: 80, functions: 80, branches: 80, statements: 80 },
    },
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
})
```

- [ ] **Step 5: Add test:integration script to package.json**

In the `"scripts"` section, add:
```json
"test:integration": "vitest run --config vitest.config.integration.ts"
```

- [ ] **Step 6: Remove old test files**

```bash
git rm src/tests/lib/db/pool.test.ts src/tests/scripts/migrate.test.ts
```

- [ ] **Step 7: Run default test suite — verify 0 failures**

```bash
pnpm test
```

Expected: **144 passing, 0 failing, 0 skipped**

- [ ] **Step 8: Commit**

```bash
git add src/tests/lib/db/pool.integration.test.ts src/tests/scripts/migrate.integration.test.ts vitest.config.ts vitest.config.integration.ts package.json
git commit -m "test: isolate DB integration tests into *.integration.test.ts — pnpm test now infrastructure-free"
```

---

## Task 2 — Fix ClassificationSource type mismatch (MEDIUM)

**Files:**
- Modify: `src/lib/access/check.ts` (line 2)
- Modify: `src/tests/lib/access/check.test.ts` (add one test case)

**Why:** `check.ts` declares `ClassificationSource = 'manual' | 'ai' | 'rules' | 'pending_review'` but the actual database values written by `classifier.ts` and `admin.ts` are `'ai_suggestion' | 'rules_list' | 'admin_override'`. Passing a real DB value like `'admin_override'` to `checkExamAccess` would be a TypeScript compile error today.

- [ ] **Step 1: Add failing type-level test (RED)**

In the existing `src/tests/lib/access/check.test.ts`, inside the `describe('checkExamAccess')` block, add:

```typescript
it('grants access for a low-stakes public exam classified via admin_override', () => {
  const exam: ExamContext = {
    examId: 'exam-1',
    ownerId: 'owner-1',
    stakesLevel: 'low',
    isPublic: true,
    classificationSource: 'admin_override',  // actual DB value — compile error before fix
  }
  const user: UserContext = { userId: 'user-1', tier: 'free', hasExamPurchase: false }
  expect(checkExamAccess(exam, user).granted).toBe(true)
})
```

Run: `pnpm tsc --noEmit`
Expected: **Type error** — `'admin_override'` not assignable to `ClassificationSource`

- [ ] **Step 2: Fix the type**

In `src/lib/access/check.ts`, change line 2 from:
```typescript
export type ClassificationSource = 'manual' | 'ai' | 'rules' | 'pending_review'
```
To:
```typescript
export type ClassificationSource = 'ai_suggestion' | 'rules_list' | 'admin_override' | 'pending_review'
```

- [ ] **Step 3: Verify GREEN**

```bash
pnpm tsc --noEmit && pnpm test src/tests/lib/access/check.test.ts
```

Expected: No type errors. All tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/lib/access/check.ts src/tests/lib/access/check.test.ts
git commit -m "fix: align ClassificationSource type with actual DB values (ai_suggestion | rules_list | admin_override)"
```

---

## Task 3 — Add tests for the mandatory trackUsage function (MEDIUM)

**Files:**
- Create: `src/tests/lib/ai/usage.test.ts`

**Why:** `trackUsage` is called after every LLM interaction. CLAUDE.md states: "Every LLM call must log to the `usage_events` table using `trackUsage()`. This is mandatory — not optional." It currently has zero test coverage.

- [ ] **Step 1: Write tests (RED)**

Create `src/tests/lib/ai/usage.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockQuery = vi.hoisted(() => vi.fn())
vi.mock('@/lib/db/pool', () => ({
  getPool: () => ({ query: mockQuery }),
}))

import { trackUsage } from '@/lib/ai/usage'

describe('trackUsage', () => {
  beforeEach(() => { mockQuery.mockReset() })

  it('inserts a usage event row with correct parameters', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] })

    await trackUsage('user-123', 'socratic_explanation', 'claude-haiku-4-5-20251001', 150, 80)

    expect(mockQuery).toHaveBeenCalledOnce()
    const [sql, params] = mockQuery.mock.calls[0] as [string, unknown[]]
    expect(sql).toContain('INSERT INTO usage_events')
    expect(params).toEqual(['user-123', 'socratic_explanation', 'claude-haiku-4-5-20251001', 150, 80])
  })

  it('includes all 5 required columns in the INSERT statement', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] })
    await trackUsage('u', 'ev', 'model', 1, 2)
    const [sql] = mockQuery.mock.calls[0] as [string, unknown[]]
    expect(sql).toMatch(/user_id/i)
    expect(sql).toMatch(/event_type/i)
    expect(sql).toMatch(/model/i)
    expect(sql).toMatch(/input_tokens/i)
    expect(sql).toMatch(/output_tokens/i)
  })

  it('propagates database errors without swallowing them', async () => {
    mockQuery.mockRejectedValueOnce(new Error('connection refused'))
    await expect(trackUsage('u', 'ev', 'model', 1, 2)).rejects.toThrow('connection refused')
  })
})
```

- [ ] **Step 2: Run test (RED)**

```bash
pnpm test src/tests/lib/ai/usage.test.ts
```

Expected: FAIL — file not found error (the test file doesn't exist yet, but `usage.ts` does).

- [ ] **Step 3: Run after file is created (GREEN)**

```bash
pnpm test src/tests/lib/ai/usage.test.ts
```

Expected: **3 passing**

- [ ] **Step 4: Commit**

```bash
git add src/tests/lib/ai/usage.test.ts
git commit -m "test: add coverage for mandatory trackUsage — every LLM call must log to usage_events"
```

---

## Task 4 — Create src/lib/engines/socratic.ts with TDD (HIGH)

**Files:**
- Create: `src/tests/lib/engines/socratic.test.ts` (write first — RED)
- Create: `src/lib/engines/socratic.ts` (implement to GREEN)
- Modify: `src/app/api/study/socratic/route.ts` (use engine)

**Why:** Spec requires `src/lib/engines/socratic.ts` as a pure engine. The Anthropic SDK is currently called inline in the API route. The 3-step Socratic chain (acknowledge → surface gap → correct reasoning) is not implemented — only a single unstructured prompt exists. Per spec: "3-step Socratic prompt chain (Claude Haiku, ~$0.002 each)."

**Contract:**
```typescript
interface SocraticParams {
  questionStem:  string   // the question text
  chosenOption:  string   // what the student picked
  correctOption: string   // the correct answer
  isCorrect:     boolean
  model:         string   // haiku for free, sonnet for premium
  apiKey:        string   // passed in — no module-level Anthropic instance
}

interface SocraticResult {
  steps:        string[]  // 3 strings for incorrect, 1 for correct
  inputTokens:  number
  outputTokens: number
}
```

- [ ] **Step 1: Write failing tests (RED)**

Create `src/tests/lib/engines/socratic.test.ts`:
```typescript
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

  it('handles malformed response (no delimiters) — returns at least 1 step', async () => {
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
```

- [ ] **Step 2: Run — verify RED**

```bash
pnpm test src/tests/lib/engines/socratic.test.ts
```

Expected: FAIL — `Cannot find module '@/lib/engines/socratic'`

- [ ] **Step 3: Implement src/lib/engines/socratic.ts (GREEN)**

Create `src/lib/engines/socratic.ts`:
```typescript
import Anthropic from '@anthropic-ai/sdk'

export interface SocraticResult {
  steps:        string[]
  inputTokens:  number
  outputTokens: number
}

export interface SocraticParams {
  questionStem:  string
  chosenOption:  string
  correctOption: string
  isCorrect:     boolean
  model:         string
  apiKey:        string
}

const DELIMITER = '|||'

export async function generateSocraticExplanation(params: SocraticParams): Promise<SocraticResult> {
  const { questionStem, chosenOption, correctOption, isCorrect, model, apiKey } = params
  const client = new Anthropic({ apiKey })

  if (isCorrect) {
    const msg = await client.messages.create({
      model,
      max_tokens: 200,
      messages: [{
        role: 'user',
        content: `The student answered correctly. Write one sentence reinforcing WHY this answer is correct to deepen understanding.

Question: ${questionStem}
Correct answer: ${correctOption}

One sentence only. No preamble.`,
      }],
    })
    const text = msg.content[0]?.type === 'text' ? msg.content[0].text.trim() : ''
    return { steps: [text], inputTokens: msg.usage.input_tokens, outputTokens: msg.usage.output_tokens }
  }

  const msg = await client.messages.create({
    model,
    max_tokens: 450,
    messages: [{
      role: 'user',
      content: `The student answered this question incorrectly. Guide them using the Socratic method — do NOT state the correct answer outright.

Question: ${questionStem}
Student chose: ${chosenOption}
Correct answer: ${correctOption}

Write exactly 3 steps separated by "${DELIMITER}":
1. Acknowledge what they were likely thinking ("You probably chose ${chosenOption} because...")
2. Surface the key conceptual gap ("The key thing that changes this is...")
3. Lead them to the correct reasoning without stating it ("Think about what ${correctOption} actually does...")

Format: Step1 text${DELIMITER}Step2 text${DELIMITER}Step3 text

No labels, no preamble — just the three steps separated by |||.`,
    }],
  })

  const text = msg.content[0]?.type === 'text' ? msg.content[0].text.trim() : ''
  const raw   = text.split(DELIMITER).map((s) => s.trim()).filter(Boolean)
  const steps = raw.length >= 1
    ? raw.slice(0, 3)
    : ['Reflect on what makes this question unique and reconsider your initial reasoning.']

  return { steps, inputTokens: msg.usage.input_tokens, outputTokens: msg.usage.output_tokens }
}
```

- [ ] **Step 4: Run — verify GREEN**

```bash
pnpm test src/tests/lib/engines/socratic.test.ts
```

Expected: **6 passing, 0 failing**

- [ ] **Step 5: Update src/app/api/study/socratic/route.ts to use the engine**

Full replacement:
```typescript
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/api/auth-guard'
import { generateSocraticExplanation } from '@/lib/engines/socratic'
import { trackUsage } from '@/lib/ai/usage'

const Schema = z.object({
  questionStem:  z.string().min(1).max(2000),
  chosenOption:  z.string().min(1).max(500),
  correctOption: z.string().min(1).max(500),
  isCorrect:     z.boolean(),
})

export async function POST(req: Request) {
  const { user, error } = await requireAuth()
  if (error) return error

  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = Schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request' }, { status: 422 })

  const apiKey = process.env['ANTHROPIC_API_KEY']
  if (!apiKey) return NextResponse.json({ error: 'AI not configured' }, { status: 500 })

  const model = user!.tier === 'premium' ? 'claude-sonnet-4-6' : 'claude-haiku-4-5-20251001'

  try {
    const result = await generateSocraticExplanation({ ...parsed.data, model, apiKey })

    await trackUsage(user!.id, 'socratic_explanation', model, result.inputTokens, result.outputTokens)

    return NextResponse.json({ success: true, data: { steps: result.steps }, error: null })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'AI error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
```

- [ ] **Step 6: Run full test suite**

```bash
pnpm test
```

Expected: All unit tests pass (count increases by 6 from socratic tests).

- [ ] **Step 7: Commit**

```bash
git add src/lib/engines/socratic.ts src/tests/lib/engines/socratic.test.ts src/app/api/study/socratic/route.ts
git commit -m "feat: add socratic.ts engine — 3-step Socratic chain, extract from API route inline code"
```

---

## Task 5 — Create src/lib/engines/generator.ts with TDD (HIGH)

**Files:**
- Create: `src/tests/lib/engines/generator.test.ts` (write first — RED)
- Create: `src/lib/engines/generator.ts` (implement to GREEN)

**Why:** Spec requires `src/lib/engines/generator.ts`. The Lambda has its own isolated processor but the Next.js server needs a reusable engine for on-demand question generation (e.g., premium AI curriculum from exam name, study session top-ups). Per CLAUDE.md: "Never import from `src/` inside `lambda/` — they are completely separate build targets."

**Contract:**
```typescript
interface GeneratorParams {
  chunk:  string          // source text (500-token chunk or full content)
  topic:  string          // exam topic label
  model:  string          // haiku for free, sonnet for premium
  count?: number          // questions to generate (default: 5)
  apiKey: string
}

interface GeneratedQuestion {
  stem:         string
  choices:      [string, string, string, string]
  correctIndex: number    // 0–3
  explanation:  string
  topic:        string
}

interface GeneratorResult {
  questions:    GeneratedQuestion[]
  inputTokens:  number
  outputTokens: number
}
```

- [ ] **Step 1: Write failing tests (RED)**

Create `src/tests/lib/engines/generator.test.ts`:
```typescript
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
```

- [ ] **Step 2: Run — verify RED**

```bash
pnpm test src/tests/lib/engines/generator.test.ts
```

Expected: FAIL — `Cannot find module '@/lib/engines/generator'`

- [ ] **Step 3: Implement src/lib/engines/generator.ts (GREEN)**

Create `src/lib/engines/generator.ts`:
```typescript
import Anthropic from '@anthropic-ai/sdk'

export interface GeneratedQuestion {
  stem:         string
  choices:      [string, string, string, string]
  correctIndex: number
  explanation:  string
  topic:        string
}

export interface GeneratorResult {
  questions:    GeneratedQuestion[]
  inputTokens:  number
  outputTokens: number
}

export interface GeneratorParams {
  chunk:  string
  topic:  string
  model:  string
  count?: number
  apiKey: string
}

export async function generateQuestionsFromChunk(params: GeneratorParams): Promise<GeneratorResult> {
  const { chunk, topic, model, count = 5, apiKey } = params
  const client = new Anthropic({ apiKey })

  const msg = await client.messages.create({
    model,
    max_tokens: 2000,
    messages: [{
      role: 'user',
      content: `Generate exactly ${count} multiple-choice questions from the study material below.

Topic: ${topic}

Study material:
${chunk}

Return ONLY a JSON array. Each element must match this shape exactly:
{
  "stem": "the question text",
  "choices": ["option A", "option B", "option C", "option D"],
  "correctIndex": 0,
  "explanation": "why this answer is correct",
  "topic": "${topic}"
}

Rules:
- correctIndex is the 0-based index of the correct choice in the choices array
- All 4 choices must be plausible (no obviously wrong distractors)
- Explanation must reference specific content from the study material
- Return ONLY the JSON array — no markdown, no preamble, no explanation outside the array`,
    }],
  })

  const text = msg.content[0]?.type === 'text' ? msg.content[0].text.trim() : '[]'

  let questions: GeneratedQuestion[] = []
  try {
    const parsed: unknown = JSON.parse(text)
    if (Array.isArray(parsed)) {
      questions = parsed as GeneratedQuestion[]
    }
  } catch {
    questions = []
  }

  return {
    questions,
    inputTokens:  msg.usage.input_tokens,
    outputTokens: msg.usage.output_tokens,
  }
}
```

- [ ] **Step 4: Run — verify GREEN**

```bash
pnpm test src/tests/lib/engines/generator.test.ts
```

Expected: **6 passing, 0 failing**

- [ ] **Step 5: Run full test suite**

```bash
pnpm test
```

Expected: All unit tests pass. Total count: ~156 passing, 0 failing.

- [ ] **Step 6: Commit**

```bash
git add src/lib/engines/generator.ts src/tests/lib/engines/generator.test.ts
git commit -m "feat: add generator.ts engine — on-demand question generation from text chunks (spec gap)"
```

---

## Task 6 — Update SDD ledger

**Files:**
- Modify: `.superpowers/sdd/progress.md`

- [ ] **Step 1: Append the pre-phase-9 block**

Add after the Phase 8 block:

```markdown
## Pre-Phase 9 Gap Resolution

Base commit: cfaf81c (Phase 8 medium fixes)

Task 1: complete — isolate DB integration tests into *.integration.test.ts; pnpm test now 0 failures without a live database
Task 2: complete — fix ClassificationSource type: 'ai_suggestion' | 'rules_list' | 'admin_override' | 'pending_review'
Task 3: complete — add trackUsage tests (mandatory per CLAUDE.md spec — 3 tests)
Task 4: complete — src/lib/engines/socratic.ts: generateSocraticExplanation, 3-step Socratic chain (6 tests); refactored /api/study/socratic/route.ts to use engine
Task 5: complete — src/lib/engines/generator.ts: generateQuestionsFromChunk, pure async, JSON parse guard (6 tests)
```

- [ ] **Step 2: Commit**

```bash
git add .superpowers/sdd/progress.md
git commit -m "docs: update SDD ledger with pre-phase-9 gap resolution"
```

---

## Task 7 — Add S3 + upload API tests (LOW — defer to after Phase 9 if time allows)

Scope when ready:
- `src/tests/lib/s3/presigned.test.ts` — mock `@aws-sdk/s3-request-presigner` and `@aws-sdk/client-s3`; verify URL generation logic
- `src/tests/api/upload.test.ts` — mock `requireAuth` + Lambda invoke; cover `/api/upload/text` and `/api/upload/status`

These do not block Phase 9 or any running feature.

---

## Final state after all tasks

| Metric | Before | After |
|---|---|---|
| `pnpm test` failures | 8 (DB infra) | **0** |
| Engine files (7 required) | 5/7 | **7/7** |
| `ClassificationSource` type | Wrong (manual/ai/rules) | **Correct** |
| `trackUsage` test coverage | 0% | **100%** |
| All 7 engines have tests | No | **Yes** |
| Total unit tests (approx.) | 144 | **~156** |

## Execution order

Tasks 1 and 2 must run first (fix infra + types). Tasks 3–5 are independent of each other and can run in parallel after that.

```
Task 1 → Task 2 → [Task 3 + Task 4 + Task 5] in parallel → Task 6
```
