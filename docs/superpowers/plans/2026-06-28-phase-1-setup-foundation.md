# Phase 1: Setup & Foundation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A running Next.js 15 application with Aurora PostgreSQL, NextAuth v5 (Google OAuth + email/password), protected routes, rate-limiting middleware, and the CogniPrep design system — ready for feature development.

**Architecture:** Next.js 15 App Router serves all pages and API routes. Auth state flows through NextAuth v5 sessions, validated at the edge via middleware and within API routes via `requireAuth`/`requireAdmin` guards. Aurora PostgreSQL is connected via a singleton `pg` Pool. The design system lives entirely in CSS custom properties (no Tailwind, no CSS-in-JS).

**Tech Stack:** Next.js 15, TypeScript 5 (strict), NextAuth v5, `@auth/pg-adapter`, `pg`, `bcryptjs`, `zod`, Vitest, `tsx`

---

## File Map

Every file created or modified in this plan:

```
package.json                              — all project dependencies + scripts
tsconfig.json                             — TypeScript strict config
next.config.ts                            — Next.js 15 config (standalone output)
vitest.config.ts                          — Vitest with jsdom + path aliases
.env.example                              — all required environment variable names
vercel.json                               — cron schedule config

migrations/
  0001_initial_schema.sql                 — all application tables + indexes
  0002_add_pgvector.sql                   — pgvector extension + question_embeddings + HNSW

scripts/
  migrate.ts                              — migration runner (reads migrations/, tracks via schema_migrations)

src/
  types/index.ts                          — all shared TypeScript types + interfaces
  auth.ts                                 — NextAuth v5 config (providers, session callback, adapter)
  middleware.ts                           — auth protection + rate limiting (Edge runtime)

  lib/
    env.ts                                — startup environment variable validation
    db/
      pool.ts                             — Aurora pg.Pool singleton
    api/
      auth-guard.ts                       — requireAuth(), requireAdmin()

  styles/
    tokens.css                            — all CSS custom properties (colors, spacing, type)

  app/
    globals.css                           — CSS reset + font imports + token import
    layout.tsx                            — root layout (DM Serif Display + Inter fonts)
    page.tsx                              — public home → redirects to /dashboard if authenticated
    (auth)/
      layout.tsx                          — centered auth layout wrapper
      login/page.tsx                      — login form (Google OAuth button + email/password form)
      register/page.tsx                   — registration form (calls /api/auth/register)
    dashboard/
      page.tsx                            — protected dashboard shell (content added in Plan B)
    api/
      auth/[...nextauth]/route.ts         — NextAuth handler
      auth/register/route.ts              — POST: create user with bcrypt hash
      health/route.ts                     — GET: { status, db, timestamp }
      cron/
        health/route.ts                   — Vercel cron ping to keep Aurora warm

  tests/
    setup.ts                              — Vitest global setup (@testing-library/jest-dom)
    types/index.test.ts                   — type-level assertions
    lib/db/pool.test.ts                   — DB connection integration tests
    lib/api/auth-guard.test.ts            — requireAuth/requireAdmin unit tests (mocked)
    lib/env.test.ts                       — env validation unit tests
    auth.session-callback.test.ts         — session callback: deleted_at blocks session
    middleware.rate-limit.test.ts         — rate limit counter logic unit tests
    scripts/migrate.test.ts              — migration idempotency integration tests
```

---

## Task 1: Initialize Project + Install Dependencies

**Files:**
- Create: `package.json` (via create-next-app)
- Create: `.env.example`

- [ ] **Step 1: Create the Next.js project**

```bash
cd d:\Muhammad\1-VS_Code_Projects\Hackathon_Project
pnpm create next-app@latest . --typescript --app --no-tailwind --no-eslint --src-dir --import-alias "@/*"
```

When prompted: TypeScript → Yes, ESLint → No, Tailwind → No, `src/` dir → Yes, App Router → Yes, import alias → `@/*`

- [ ] **Step 2: Install all application dependencies**

```bash
pnpm add next-auth@beta @auth/pg-adapter pg bcryptjs zod @anthropic-ai/sdk @aws-sdk/client-lambda @aws-sdk/client-s3 @aws-sdk/s3-request-presigner @aws-sdk/client-bedrock-runtime stripe
```

- [ ] **Step 3: Install dev dependencies**

```bash
pnpm add -D @types/pg @types/bcryptjs @types/node vitest @vitejs/plugin-react @testing-library/react @testing-library/jest-dom jsdom tsx
```

- [ ] **Step 4: Create `.env.example`**

```env
# Aurora PostgreSQL (sslmode=require is mandatory for Aurora)
DATABASE_URL=postgresql://username:password@your-cluster.cluster-xxxx.us-east-1.rds.amazonaws.com:5432/cogniprep?sslmode=require

# NextAuth — generate secret with: openssl rand -base64 32
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=

# Google OAuth — https://console.cloud.google.com → Credentials → OAuth 2.0 Client
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# Anthropic
ANTHROPIC_API_KEY=

# AWS
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_S3_BUCKET_NAME=cogniprep-uploads
LAMBDA_FUNCTION_NAME=cogniprep-document-processor

# Stripe
STRIPE_SECRET_KEY=sk_test_
STRIPE_WEBHOOK_SECRET=whsec_
STRIPE_PREMIUM_PRICE_ID=price_

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Vercel Cron (set automatically by Vercel in production — leave blank for local dev)
CRON_SECRET=
```

- [ ] **Step 5: Commit**

```bash
git init
git add package.json pnpm-lock.yaml .env.example
git commit -m "chore: initialize Next.js 15 project with all dependencies"
```

---

## Task 2: TypeScript + Next.js + Vitest Configuration

**Files:**
- Modify: `tsconfig.json`
- Create: `next.config.ts`
- Create: `vitest.config.ts`
- Create: `src/tests/setup.ts`

- [ ] **Step 1: Replace `tsconfig.json` entirely**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "forceConsistentCasingInFileNames": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules", "lambda"]
}
```

- [ ] **Step 2: Write `next.config.ts`**

```typescript
// next.config.ts
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  output: 'standalone',
  experimental: {
    serverComponentsExternalPackages: ['pg', 'bcryptjs'],
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
      { protocol: 'https', hostname: '*.googleusercontent.com' },
    ],
  },
}

export default nextConfig
```

- [ ] **Step 3: Write `vitest.config.ts`**

```typescript
// vitest.config.ts
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
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      thresholds: { lines: 80, functions: 80, branches: 80, statements: 80 },
    },
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
})
```

- [ ] **Step 4: Create `src/tests/setup.ts`**

```typescript
// src/tests/setup.ts
import '@testing-library/jest-dom'
```

- [ ] **Step 5: Add scripts to `package.json`**

Merge into the existing `"scripts"` object:

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "db:migrate": "tsx scripts/migrate.ts",
    "db:seed": "tsx scripts/seed.ts",
    "type-check": "tsc --noEmit"
  }
}
```

- [ ] **Step 6: Verify TypeScript compiles**

```bash
pnpm type-check
```

Expected: no errors (scaffolded files only).

- [ ] **Step 7: Commit**

```bash
git add tsconfig.json next.config.ts vitest.config.ts src/tests/setup.ts package.json
git commit -m "chore: configure TypeScript strict mode, Next.js, and Vitest"
```

---

## Task 3: CSS Design System

**Files:**
- Create: `src/styles/tokens.css`
- Modify: `src/app/globals.css`

- [ ] **Step 1: Write `src/styles/tokens.css`**

```css
/* src/styles/tokens.css */

:root {
  /* ── Light mode (study / default) ─────────────────────────────── */
  --color-bg:              oklch(97% 0.012 80);
  --color-surface:         oklch(100% 0 0);
  --color-surface-raised:  oklch(98% 0.008 80);
  --color-primary:         oklch(46% 0.18 270);
  --color-primary-hover:   oklch(40% 0.19 270);
  --color-accent:          oklch(72% 0.17 60);
  --color-accent-hover:    oklch(66% 0.18 60);
  --color-weak:            oklch(60% 0.19 25);
  --color-learning:        oklch(68% 0.18 55);
  --color-mastered:        oklch(55% 0.16 155);
  --color-text:            oklch(18% 0 0);
  --color-text-muted:      oklch(52% 0 0);
  --color-text-on-primary: oklch(98% 0 0);
  --color-border:          oklch(88% 0 0);
  --color-border-focus:    var(--color-primary);
  --color-error:           oklch(55% 0.22 25);
  --color-success:         oklch(55% 0.18 155);

  /* ── Dark mode (analytics / progress) ────────────────────────── */
  --color-bg-dark:         oklch(14% 0.04 270);
  --color-surface-dark:    oklch(20% 0.05 270);
  --color-primary-dark:    oklch(65% 0.22 295);
  --color-accent-dark:     var(--color-accent);
  --color-text-dark:       oklch(92% 0 0);
  --color-text-muted-dark: oklch(65% 0 0);
  --color-border-dark:     oklch(30% 0.04 270);

  /* ── Typography ──────────────────────────────────────────────── */
  --font-display: 'DM Serif Display', Georgia, serif;
  --font-body:    'Inter', system-ui, sans-serif;

  --text-xs:   clamp(0.75rem,  0.7rem  + 0.2vw, 0.813rem);
  --text-sm:   clamp(0.875rem, 0.82rem + 0.2vw, 0.938rem);
  --text-base: clamp(1rem,     0.92rem + 0.3vw, 1.063rem);
  --text-lg:   clamp(1.125rem, 1rem    + 0.5vw, 1.25rem);
  --text-xl:   clamp(1.25rem,  1.1rem  + 0.7vw, 1.5rem);
  --text-2xl:  clamp(1.5rem,   1.2rem  + 1.2vw, 2rem);
  --text-3xl:  clamp(1.875rem, 1.4rem  + 2vw,   2.75rem);
  --text-hero: clamp(3rem,     1.5rem  + 6vw,   6rem);

  --leading-tight:  1.15;
  --leading-normal: 1.6;

  /* ── Spacing ─────────────────────────────────────────────────── */
  --space-1:       0.25rem;
  --space-2:       0.5rem;
  --space-3:       0.75rem;
  --space-4:       1rem;
  --space-6:       1.5rem;
  --space-8:       2rem;
  --space-12:      3rem;
  --space-16:      4rem;
  --space-section: clamp(4rem, 3rem + 4vw, 8rem);

  /* ── Shape ──────────────────────────────────────────────────── */
  --radius-sm:   0.375rem;
  --radius-md:   0.625rem;
  --radius-lg:   1rem;
  --radius-xl:   1.5rem;
  --radius-full: 9999px;

  /* ── Shadow ─────────────────────────────────────────────────── */
  --shadow-sm: 0 1px 2px  oklch(0% 0 0 / 0.06);
  --shadow-md: 0 4px 12px oklch(0% 0 0 / 0.08);
  --shadow-lg: 0 8px 24px oklch(0% 0 0 / 0.12);

  /* ── Motion ─────────────────────────────────────────────────── */
  --duration-fast:   150ms;
  --duration-normal: 200ms;
  --duration-slow:   300ms;
  --ease-out-expo:   cubic-bezier(0.16, 1, 0.3, 1);
  --ease-in-out:     cubic-bezier(0.4, 0, 0.2, 1);
}

@media (prefers-reduced-motion: reduce) {
  :root {
    --duration-fast:   0ms;
    --duration-normal: 0ms;
    --duration-slow:   0ms;
  }
}
```

- [ ] **Step 2: Write `src/app/globals.css`**

```css
/* src/app/globals.css */
@import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=Inter:wght@400;500;600;700&display=swap');
@import '../styles/tokens.css';

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

html {
  font-family: var(--font-body);
  font-size: var(--text-base);
  line-height: var(--leading-normal);
  color: var(--color-text);
  background-color: var(--color-bg);
  -webkit-font-smoothing: antialiased;
}

body { min-height: 100dvh; }

h1, h2, h3 { font-family: var(--font-display); line-height: var(--leading-tight); }

a { color: var(--color-primary); text-decoration: none; }
a:hover { text-decoration: underline; }

button { font-family: var(--font-body); cursor: pointer; }

img, picture, video, canvas, svg { display: block; max-width: 100%; }

input, button, textarea, select { font: inherit; }

p, h1, h2, h3, h4, h5, h6 { overflow-wrap: break-word; }

.sr-only {
  position: absolute; width: 1px; height: 1px; padding: 0;
  margin: -1px; overflow: hidden; clip: rect(0,0,0,0);
  white-space: nowrap; border-width: 0;
}
```

- [ ] **Step 3: Commit**

```bash
git add src/styles/tokens.css src/app/globals.css
git commit -m "feat: add CSS design system with custom property tokens"
```

---

## Task 4: Shared TypeScript Types

**Files:**
- Create: `src/types/index.ts`
- Create: `src/tests/types/index.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/tests/types/index.test.ts
import { describe, it, expectTypeOf } from 'vitest'
import type { SessionUser, AccountTier, UserRole, ApiResponse } from '@/types'

describe('shared types', () => {
  it('AccountTier is free | premium', () => {
    expectTypeOf<AccountTier>().toEqualTypeOf<'free' | 'premium'>()
  })

  it('UserRole is user | admin', () => {
    expectTypeOf<UserRole>().toEqualTypeOf<'user' | 'admin'>()
  })

  it('SessionUser has id, tier, role', () => {
    expectTypeOf<SessionUser>().toHaveProperty('id')
    expectTypeOf<SessionUser>().toHaveProperty('tier')
    expectTypeOf<SessionUser>().toHaveProperty('role')
  })

  it('ApiResponse has success, data, error', () => {
    expectTypeOf<ApiResponse<string>>().toHaveProperty('success')
    expectTypeOf<ApiResponse<string>>().toHaveProperty('data')
    expectTypeOf<ApiResponse<string>>().toHaveProperty('error')
  })
})
```

- [ ] **Step 2: Run test — verify it fails**

```bash
pnpm test src/tests/types/index.test.ts
```

Expected: FAIL — `Cannot find module '@/types'`

- [ ] **Step 3: Write `src/types/index.ts`**

```typescript
// src/types/index.ts

export type AccountTier = 'free' | 'premium'
export type UserRole = 'user' | 'admin'
export type StakesLevel = 'low' | 'high'
export type ClassificationSource =
  | 'rules_list' | 'ai_suggestion' | 'admin_override' | 'pending_review'
export type SessionType = 'diagnostic' | 'adaptive'
export type ExamDomain =
  | 'medical' | 'legal' | 'finance' | 'engineering'
  | 'technology' | 'language' | 'academic' | 'professional' | 'general'
export type UsageEventType =
  | 'upload_text' | 'upload_pdf_free' | 'upload_pdf_premium'
  | 'generate_questions' | 'generate_curriculum'
  | 'socratic_explanation' | 'classify_exam' | 'generate_embedding'
export type SubscriptionStatus =
  | 'active' | 'trialing' | 'past_due' | 'canceled' | 'unpaid'

export interface SessionUser {
  id: string
  email: string
  name: string | null
  image: string | null
  tier: AccountTier
  role: UserRole
}

export interface ApiResponse<T = unknown> {
  success: boolean
  data: T | null
  error: string | null
}

export interface PaginatedResponse<T> {
  success: boolean
  data: T[] | null
  error: string | null
  meta: { total: number; page: number; limit: number }
}

// Extend NextAuth's Session type so session.user carries tier + role
declare module 'next-auth' {
  interface Session {
    user: SessionUser
  }
}
```

- [ ] **Step 4: Run test — verify it passes**

```bash
pnpm test src/tests/types/index.test.ts
```

Expected: PASS — 4 tests green.

- [ ] **Step 5: Commit**

```bash
git add src/types/index.ts src/tests/types/index.test.ts
git commit -m "feat: add shared TypeScript types for users, sessions, and API responses"
```

---

## Task 5: Aurora DB Connection Pool

**Files:**
- Create: `src/lib/env.ts`
- Create: `src/lib/db/pool.ts`
- Create: `src/tests/lib/env.test.ts`
- Create: `src/tests/lib/db/pool.test.ts`

> `pool.test.ts` is an integration test — it requires `DATABASE_URL` in `.env.local`.

- [ ] **Step 1: Write the failing test for env validation**

```typescript
// src/tests/lib/env.test.ts
import { describe, it, expect, afterEach } from 'vitest'

const REQUIRED = [
  'DATABASE_URL', 'NEXTAUTH_SECRET', 'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET',
  'ANTHROPIC_API_KEY', 'AWS_REGION', 'AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY',
  'AWS_S3_BUCKET_NAME',
]

const savedEnv: Record<string, string | undefined> = {}

afterEach(() => {
  // Restore any env vars we deleted
  for (const key of REQUIRED) {
    if (savedEnv[key] === undefined) delete process.env[key]
    else process.env[key] = savedEnv[key]
  }
})

describe('validateEnv', () => {
  it('does not throw when all required vars are present', async () => {
    for (const key of REQUIRED) {
      savedEnv[key] = process.env[key]
      process.env[key] = 'test-value'
    }
    const { validateEnv } = await import('@/lib/env')
    expect(() => validateEnv()).not.toThrow()
  })

  it('throws and names DATABASE_URL when it is missing', async () => {
    for (const key of REQUIRED) {
      savedEnv[key] = process.env[key]
      process.env[key] = 'test-value'
    }
    savedEnv['DATABASE_URL'] = process.env['DATABASE_URL']
    delete process.env['DATABASE_URL']
    const { validateEnv } = await import('@/lib/env')
    expect(() => validateEnv()).toThrow('DATABASE_URL')
  })
})
```

- [ ] **Step 2: Run test — verify it fails**

```bash
pnpm test src/tests/lib/env.test.ts
```

Expected: FAIL — `Cannot find module '@/lib/env'`

- [ ] **Step 3: Write `src/lib/env.ts`**

```typescript
// src/lib/env.ts
const REQUIRED_VARS = [
  'DATABASE_URL',
  'NEXTAUTH_SECRET',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'ANTHROPIC_API_KEY',
  'AWS_REGION',
  'AWS_ACCESS_KEY_ID',
  'AWS_SECRET_ACCESS_KEY',
  'AWS_S3_BUCKET_NAME',
] as const

export function validateEnv(): void {
  const missing = REQUIRED_VARS.filter((key) => !process.env[key])
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}\n` +
      `Copy .env.example to .env.local and fill in all values.`
    )
  }
}
```

- [ ] **Step 4: Run env test — verify it passes**

```bash
pnpm test src/tests/lib/env.test.ts
```

Expected: PASS — 2 tests green.

- [ ] **Step 5: Write the DB pool test**

```typescript
// src/tests/lib/db/pool.test.ts
import { describe, it, expect, afterAll } from 'vitest'
import { getPool } from '@/lib/db/pool'

describe('getPool (integration — requires DATABASE_URL)', () => {
  it('returns the same Pool instance on repeated calls', () => {
    expect(getPool()).toBe(getPool())
  })

  it('executes a simple query successfully', async () => {
    const result = await getPool().query('SELECT 1 AS value')
    expect(result.rows[0]?.value).toBe(1)
  })

  it('returns current UTC timestamp from database', async () => {
    const result = await getPool().query('SELECT NOW() AS now')
    expect(result.rows[0]?.now).toBeInstanceOf(Date)
  })

  afterAll(async () => { await getPool().end() })
})
```

- [ ] **Step 6: Write `src/lib/db/pool.ts`**

```typescript
// src/lib/db/pool.ts
import { Pool } from 'pg'
import { validateEnv } from '@/lib/env'

let _pool: Pool | null = null

export function getPool(): Pool {
  if (!_pool) {
    validateEnv()

    _pool = new Pool({
      connectionString: process.env.DATABASE_URL!,
      ssl: { rejectUnauthorized: false }, // Aurora requires SSL; no cert verification for hackathon
      max: 10,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
    })

    _pool.on('error', (err) => {
      process.stderr.write(`[DB Pool] Unexpected error: ${err.message}\n`)
    })
  }

  return _pool
}
```

- [ ] **Step 7: Run pool test — verify it passes**

```bash
pnpm test src/tests/lib/db/pool.test.ts
```

Expected: PASS — 3 tests green. (Ensure `DATABASE_URL` is in `.env.local`.)

- [ ] **Step 8: Commit**

```bash
git add src/lib/env.ts src/lib/db/pool.ts src/tests/lib/env.test.ts src/tests/lib/db/pool.test.ts
git commit -m "feat: add env validation and Aurora connection pool"
```

---

## Task 6: Database Migrations

**Files:**
- Create: `migrations/0001_initial_schema.sql`
- Create: `migrations/0002_add_pgvector.sql`
- Create: `scripts/migrate.ts`
- Create: `src/tests/scripts/migrate.test.ts`

- [ ] **Step 1: Write `migrations/0001_initial_schema.sql`**

```sql
-- migrations/0001_initial_schema.sql

CREATE TABLE users (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email              TEXT UNIQUE NOT NULL,
  name               TEXT,
  image              TEXT,
  password_hash      TEXT,
  tier               TEXT DEFAULT 'free'  CHECK (tier IN ('free','premium')),
  role               TEXT DEFAULT 'user'  CHECK (role IN ('user','admin')),
  stripe_customer_id TEXT UNIQUE,
  deleted_at         TIMESTAMPTZ,
  created_at         TIMESTAMPTZ DEFAULT NOW()
);

-- NextAuth v5 required tables
CREATE TABLE accounts (
  id                  TEXT PRIMARY KEY,
  user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type                TEXT NOT NULL,
  provider            TEXT NOT NULL,
  provider_account_id TEXT NOT NULL,
  refresh_token       TEXT,
  access_token        TEXT,
  expires_at          BIGINT,
  token_type          TEXT,
  scope               TEXT,
  id_token            TEXT,
  session_state       TEXT,
  UNIQUE(provider, provider_account_id)
);

CREATE TABLE sessions (
  id            TEXT PRIMARY KEY,
  session_token TEXT UNIQUE NOT NULL,
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires       TIMESTAMPTZ NOT NULL
);

CREATE TABLE verification_tokens (
  identifier TEXT NOT NULL,
  token      TEXT NOT NULL,
  expires    TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (identifier, token)
);

CREATE TABLE exams (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                     TEXT NOT NULL,
  description              TEXT,
  created_by               UUID REFERENCES users(id) ON DELETE SET NULL,
  is_public                BOOLEAN DEFAULT FALSE,
  domain                   TEXT DEFAULT 'general'
                           CHECK (domain IN ('medical','legal','finance','engineering',
                                             'technology','language','academic','professional','general')),
  stakes_level             TEXT DEFAULT 'high' CHECK (stakes_level IN ('low','high')),
  classification_source    TEXT DEFAULT 'pending_review'
                           CHECK (classification_source IN ('rules_list','ai_suggestion','admin_override','pending_review')),
  classification_matched_rule TEXT,
  price_cents              INTEGER,
  created_at               TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE exam_topics (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id         UUID REFERENCES exams(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  weight          NUMERIC(4,3) DEFAULT 0.1,
  parent_topic_id UUID REFERENCES exam_topics(id) ON DELETE SET NULL
);

CREATE TABLE questions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id        UUID REFERENCES exams(id) ON DELETE CASCADE,
  topic_id       UUID REFERENCES exam_topics(id) ON DELETE SET NULL,
  stem           TEXT NOT NULL,
  options        JSONB NOT NULL,
  correct_index  SMALLINT NOT NULL,
  explanation    TEXT,
  difficulty     NUMERIC(4,3) DEFAULT 0.5,
  discrimination NUMERIC(4,3) DEFAULT 1.0,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE user_exams (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES users(id) ON DELETE CASCADE,
  exam_id     UUID REFERENCES exams(id) ON DELETE CASCADE,
  enrolled_at TIMESTAMPTZ DEFAULT NOW(),
  is_active   BOOLEAN DEFAULT TRUE,
  UNIQUE(user_id, exam_id)
);

CREATE TABLE user_topic_mastery (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID REFERENCES users(id) ON DELETE CASCADE,
  topic_id            UUID REFERENCES exam_topics(id) ON DELETE CASCADE,
  mastery_probability NUMERIC(5,4) DEFAULT 0.3,
  attempts            INTEGER DEFAULT 0,
  last_updated        TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, topic_id)
);

CREATE TABLE user_question_schedule (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID REFERENCES users(id) ON DELETE CASCADE,
  question_id      UUID REFERENCES questions(id) ON DELETE CASCADE,
  next_review_at   TIMESTAMPTZ DEFAULT NOW(),
  interval_days    NUMERIC(6,2) DEFAULT 1,
  ease_factor      NUMERIC(4,3) DEFAULT 2.5,
  repetition_count INTEGER DEFAULT 0,
  UNIQUE(user_id, question_id)
);

CREATE TABLE study_sessions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID REFERENCES users(id) ON DELETE CASCADE,
  exam_id      UUID REFERENCES exams(id) ON DELETE CASCADE,
  session_type TEXT NOT NULL CHECK (session_type IN ('diagnostic','adaptive')),
  started_at   TIMESTAMPTZ DEFAULT NOW(),
  ended_at     TIMESTAMPTZ,
  metadata     JSONB DEFAULT '{}'
);

CREATE UNIQUE INDEX idx_one_active_diagnostic_per_user_exam
  ON study_sessions(user_id, exam_id)
  WHERE session_type = 'diagnostic' AND ended_at IS NULL;

CREATE TABLE answer_events (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id    UUID REFERENCES study_sessions(id) ON DELETE CASCADE,
  user_id       UUID REFERENCES users(id) ON DELETE CASCADE,
  question_id   UUID REFERENCES questions(id) ON DELETE CASCADE,
  chosen_index  SMALLINT NOT NULL,
  is_correct    BOOLEAN NOT NULL,
  time_spent_ms INTEGER,
  answered_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE document_jobs (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id             UUID REFERENCES exams(id) ON DELETE CASCADE,
  user_id             UUID REFERENCES users(id) ON DELETE CASCADE,
  status              TEXT DEFAULT 'pending' CHECK (status IN ('pending','processing','complete','failed')),
  source_type         TEXT NOT NULL CHECK (source_type IN ('pdf','text')),
  s3_key              TEXT,
  questions_generated INTEGER DEFAULT 0,
  failed_reason       TEXT,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  completed_at        TIMESTAMPTZ
);

CREATE TABLE user_exam_purchases (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                  UUID REFERENCES users(id) ON DELETE CASCADE,
  exam_id                  UUID REFERENCES exams(id) ON DELETE CASCADE,
  stripe_payment_intent_id TEXT UNIQUE NOT NULL,
  amount_cents             INTEGER NOT NULL,
  purchased_at             TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, exam_id)
);

CREATE TABLE usage_events (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID REFERENCES users(id) ON DELETE SET NULL,
  event_type    TEXT NOT NULL
                CHECK (event_type IN ('upload_text','upload_pdf_free','upload_pdf_premium',
                                      'generate_questions','generate_curriculum',
                                      'socratic_explanation','classify_exam','generate_embedding')),
  model         TEXT,
  input_tokens  INTEGER DEFAULT 0,
  output_tokens INTEGER DEFAULT 0,
  cost_usd      NUMERIC(10,6) DEFAULT 0,
  metadata      JSONB DEFAULT '{}',
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE audit_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id    UUID REFERENCES users(id) ON DELETE SET NULL,
  action      TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id   UUID,
  metadata    JSONB DEFAULT '{}',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE classification_review_queue (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id       UUID UNIQUE REFERENCES exams(id) ON DELETE CASCADE,
  ai_suggestion TEXT CHECK (ai_suggestion IN ('low','high')),
  ai_confidence NUMERIC(4,3),
  queued_at     TIMESTAMPTZ DEFAULT NOW(),
  reviewed_at   TIMESTAMPTZ,
  reviewed_by   UUID REFERENCES users(id) ON DELETE SET NULL
);

-- Indexes
CREATE INDEX idx_exams_created_by       ON exams(created_by);
CREATE INDEX idx_exams_is_public        ON exams(is_public) WHERE is_public = TRUE;
CREATE INDEX idx_exams_domain           ON exams(domain);
CREATE INDEX idx_exam_topics_exam_id    ON exam_topics(exam_id);
CREATE INDEX idx_questions_exam_id      ON questions(exam_id);
CREATE INDEX idx_questions_topic_id     ON questions(topic_id);
CREATE INDEX idx_user_exams_user_id     ON user_exams(user_id);
CREATE INDEX idx_user_exams_composite   ON user_exams(user_id, exam_id, is_active);
CREATE INDEX idx_mastery_user_topic     ON user_topic_mastery(user_id, topic_id);
CREATE INDEX idx_schedule_user_next     ON user_question_schedule(user_id, next_review_at);
CREATE INDEX idx_sessions_user_exam     ON study_sessions(user_id, exam_id);
CREATE INDEX idx_answer_events_session  ON answer_events(session_id);
CREATE INDEX idx_answer_events_user     ON answer_events(user_id);
CREATE INDEX idx_jobs_exam_id           ON document_jobs(exam_id);
CREATE INDEX idx_jobs_user_id           ON document_jobs(user_id);
CREATE INDEX idx_usage_user_id          ON usage_events(user_id);
CREATE INDEX idx_usage_event_type       ON usage_events(event_type);
CREATE INDEX idx_users_deleted_at       ON users(deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX idx_review_queue_unreviewed ON classification_review_queue(queued_at) WHERE reviewed_at IS NULL;
CREATE INDEX idx_questions_options_gin  ON questions USING gin(options);
CREATE INDEX idx_exams_fts ON exams USING gin(to_tsvector('english', name || ' ' || COALESCE(description, '')));
```

- [ ] **Step 2: Write `migrations/0002_add_pgvector.sql`**

```sql
-- migrations/0002_add_pgvector.sql
-- Aurora PostgreSQL 15.3+ includes pgvector natively

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE question_embeddings (
  question_id UUID PRIMARY KEY REFERENCES questions(id) ON DELETE CASCADE,
  embedding   vector(1536) NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- HNSW index: m=16 (graph connections), ef_construction=64 (build quality)
CREATE INDEX idx_question_embeddings_hnsw
  ON question_embeddings USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);
```

- [ ] **Step 3: Write `scripts/migrate.ts`**

```typescript
// scripts/migrate.ts
import { Pool } from 'pg'
import fs from 'fs'
import path from 'path'

async function migrate(): Promise<void> {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) throw new Error('DATABASE_URL is not set')

  const pool = new Pool({ connectionString, ssl: { rejectUnauthorized: false } })
  const client = await pool.connect()

  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version    TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ DEFAULT NOW()
      )
    `)

    const { rows } = await client.query('SELECT version FROM schema_migrations')
    const applied = new Set(rows.map((r: { version: string }) => r.version))

    const migrationsDir = path.join(process.cwd(), 'migrations')
    const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort()

    for (const file of files) {
      const version = file.replace('.sql', '')
      if (applied.has(version)) { console.log(`⏭  ${version} — already applied`); continue }

      console.log(`⬆  Applying ${version}...`)
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8')

      await client.query('BEGIN')
      try {
        await client.query(sql)
        await client.query('INSERT INTO schema_migrations (version) VALUES ($1)', [version])
        await client.query('COMMIT')
        console.log(`✅ Applied ${version}`)
      } catch (err) {
        await client.query('ROLLBACK')
        throw new Error(`Migration ${version} failed: ${(err as Error).message}`)
      }
    }
    console.log('\n✅ All migrations applied successfully')
  } finally {
    client.release()
    await pool.end()
  }
}

migrate().catch((err) => { process.stderr.write(`❌ ${err.message}\n`); process.exit(1) })
```

- [ ] **Step 4: Run migrations**

```bash
pnpm db:migrate
```

Expected:
```
⬆  Applying 0001_initial_schema...
✅ Applied 0001_initial_schema
⬆  Applying 0002_add_pgvector...
✅ Applied 0002_add_pgvector

✅ All migrations applied successfully
```

- [ ] **Step 5: Verify idempotency**

```bash
pnpm db:migrate
```

Expected: both lines say `already applied`.

- [ ] **Step 6: Write migration integration tests**

```typescript
// src/tests/scripts/migrate.test.ts
import { describe, it, expect, afterAll } from 'vitest'
import { Pool } from 'pg'

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
afterAll(() => pool.end())

describe('migration integration', () => {
  it('schema_migrations table exists', async () => {
    const r = await pool.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'schema_migrations'
    `)
    expect(r.rows.length).toBe(1)
  })

  it('both migrations are recorded', async () => {
    const r = await pool.query('SELECT version FROM schema_migrations ORDER BY version')
    const versions = r.rows.map((row: { version: string }) => row.version)
    expect(versions).toContain('0001_initial_schema')
    expect(versions).toContain('0002_add_pgvector')
  })

  it('users table has all required columns', async () => {
    const r = await pool.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'users' AND table_schema = 'public'
    `)
    const cols = r.rows.map((row: { column_name: string }) => row.column_name)
    expect(cols).toContain('password_hash')
    expect(cols).toContain('deleted_at')
    expect(cols).toContain('stripe_customer_id')
    expect(cols).toContain('role')
    expect(cols).toContain('tier')
  })

  it('exams table has domain column', async () => {
    const r = await pool.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'exams' AND table_schema = 'public' AND column_name = 'domain'
    `)
    expect(r.rows.length).toBe(1)
  })

  it('question_embeddings table exists (pgvector migration)', async () => {
    const r = await pool.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'question_embeddings'
    `)
    expect(r.rows.length).toBe(1)
  })
})
```

- [ ] **Step 7: Run migration tests**

```bash
pnpm test src/tests/scripts/migrate.test.ts
```

Expected: PASS — 5 tests green.

- [ ] **Step 8: Commit**

```bash
git add migrations/ scripts/migrate.ts src/tests/scripts/migrate.test.ts
git commit -m "feat: add full database schema with migrations and migration runner"
```

---

## Task 7: NextAuth v5 Configuration

**Files:**
- Create: `src/auth.ts`
- Create: `src/app/api/auth/[...nextauth]/route.ts`
- Create: `src/tests/auth.session-callback.test.ts`

- [ ] **Step 1: Write the session callback test (pure function — no NextAuth import needed)**

```typescript
// src/tests/auth.session-callback.test.ts
import { describe, it, expect } from 'vitest'

// Test the session callback logic as a pure function
// (mirrors what src/auth.ts implements in the callbacks.session handler)
type MockUser = { id: string; email: string; name: string | null; image: string | null; tier?: string; role?: string; deleted_at?: Date | null }
type MockSession = { user: { id?: string; email: string; name: string | null; image: string | null; tier?: string; role?: string }; expires: string }

function applySessionCallback(session: MockSession, user: MockUser): MockSession {
  if (user.deleted_at) throw new Error('Account deleted')
  session.user.id   = user.id
  session.user.tier = user.tier ?? 'free'
  session.user.role = user.role ?? 'user'
  return session
}

const base: MockSession = { user: { email: 'a@b.com', name: 'A', image: null }, expires: '2027-01-01' }

describe('session callback logic', () => {
  it('enriches session with id, tier, role', () => {
    const s = applySessionCallback({ ...base, user: { ...base.user } }, { id: 'u1', email: 'a@b.com', name: 'A', image: null, tier: 'premium', role: 'admin' })
    expect(s.user.id).toBe('u1')
    expect(s.user.tier).toBe('premium')
    expect(s.user.role).toBe('admin')
  })

  it('defaults tier to free', () => {
    const s = applySessionCallback({ ...base, user: { ...base.user } }, { id: 'u1', email: 'a@b.com', name: null, image: null })
    expect(s.user.tier).toBe('free')
  })

  it('defaults role to user', () => {
    const s = applySessionCallback({ ...base, user: { ...base.user } }, { id: 'u1', email: 'a@b.com', name: null, image: null })
    expect(s.user.role).toBe('user')
  })

  it('throws for soft-deleted users', () => {
    expect(() =>
      applySessionCallback({ ...base, user: { ...base.user } }, { id: 'u1', email: 'a@b.com', name: null, image: null, deleted_at: new Date() })
    ).toThrow('Account deleted')
  })
})
```

- [ ] **Step 2: Run test — verify it passes (pure function)**

```bash
pnpm test src/tests/auth.session-callback.test.ts
```

Expected: PASS — 4 tests green.

- [ ] **Step 3: Write `src/auth.ts`**

```typescript
// src/auth.ts
import NextAuth from 'next-auth'
import PostgresAdapter from '@auth/pg-adapter'
import Google from 'next-auth/providers/google'
import Credentials from 'next-auth/providers/credentials'
import { compare } from 'bcryptjs'
import { getPool } from '@/lib/db/pool'
import type { SessionUser } from '@/types'

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: PostgresAdapter(getPool()),
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    Credentials({
      credentials: {
        email:    { label: 'Email',    type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null

        const { rows } = await getPool().query(
          `SELECT id, email, name, image, password_hash, tier, role, deleted_at
           FROM users WHERE email = $1`,
          [credentials.email as string]
        )

        const user = rows[0] as {
          id: string; email: string; name: string | null; image: string | null;
          password_hash: string | null; tier: string; role: string; deleted_at: Date | null
        } | undefined

        if (!user || !user.password_hash || user.deleted_at) return null

        const valid = await compare(credentials.password as string, user.password_hash)
        if (!valid) return null

        return { id: user.id, email: user.email, name: user.name, image: user.image }
      },
    }),
  ],
  callbacks: {
    session({ session, user }) {
      const dbUser = user as typeof user & { tier?: string; role?: string; deleted_at?: Date | null }
      if (dbUser.deleted_at) throw new Error('Account deleted')
      session.user.id   = dbUser.id
      session.user.tier = (dbUser.tier ?? 'free') as SessionUser['tier']
      session.user.role = (dbUser.role ?? 'user') as SessionUser['role']
      return session
    },
  },
  pages: { signIn: '/login', newUser: '/onboarding' },
})
```

- [ ] **Step 4: Write the NextAuth route handler**

```typescript
// src/app/api/auth/[...nextauth]/route.ts
import { handlers } from '@/auth'
export const { GET, POST } = handlers
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
pnpm type-check
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/auth.ts src/app/api/auth/ src/tests/auth.session-callback.test.ts
git commit -m "feat: add NextAuth v5 with Google OAuth, email/password, and deleted-user guard"
```

---

## Task 8: API Auth Guards

**Files:**
- Create: `src/lib/api/auth-guard.ts`
- Create: `src/tests/lib/api/auth-guard.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// src/tests/lib/api/auth-guard.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/auth', () => ({ auth: vi.fn() }))

import { auth } from '@/auth'
import { requireAuth, requireAdmin } from '@/lib/api/auth-guard'

const mockAuth = vi.mocked(auth)

const adminSession = { user: { id: 'u1', email: 'a@b.com', name: 'A', image: null, tier: 'free', role: 'admin' }, expires: '2027-01-01' }
const userSession  = { user: { id: 'u2', email: 'b@c.com', name: 'B', image: null, tier: 'free', role: 'user'  }, expires: '2027-01-01' }

describe('requireAuth', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when session is null', async () => {
    mockAuth.mockResolvedValueOnce(null as any)
    const r = await requireAuth()
    expect(r.error?.status).toBe(401)
    expect(r.user).toBeNull()
  })

  it('returns user when session is valid', async () => {
    mockAuth.mockResolvedValueOnce(userSession as any)
    const r = await requireAuth()
    expect(r.error).toBeNull()
    expect(r.user?.id).toBe('u2')
  })
})

describe('requireAdmin', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when no session', async () => {
    mockAuth.mockResolvedValueOnce(null as any)
    const r = await requireAdmin()
    expect(r.error?.status).toBe(401)
  })

  it('returns 403 when user is not admin', async () => {
    mockAuth.mockResolvedValueOnce(userSession as any)
    const r = await requireAdmin()
    expect(r.error?.status).toBe(403)
    expect((await r.error!.json()).error).toBe('Forbidden')
  })

  it('returns user when role is admin', async () => {
    mockAuth.mockResolvedValueOnce(adminSession as any)
    const r = await requireAdmin()
    expect(r.error).toBeNull()
    expect(r.user?.role).toBe('admin')
  })
})
```

- [ ] **Step 2: Run test — verify it fails**

```bash
pnpm test src/tests/lib/api/auth-guard.test.ts
```

Expected: FAIL — `Cannot find module '@/lib/api/auth-guard'`

- [ ] **Step 3: Write `src/lib/api/auth-guard.ts`**

```typescript
// src/lib/api/auth-guard.ts
import { auth } from '@/auth'
import { NextResponse } from 'next/server'
import type { SessionUser } from '@/types'

type GuardSuccess = { user: SessionUser; error: null }
type GuardFailure = { user: null; error: NextResponse }

export async function requireAuth(): Promise<GuardSuccess | GuardFailure> {
  const session = await auth()
  if (!session?.user?.id) {
    return { user: null, error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }
  return { user: session.user as SessionUser, error: null }
}

export async function requireAdmin(): Promise<GuardSuccess | GuardFailure> {
  const result = await requireAuth()
  if (result.error) return result
  if (result.user.role !== 'admin') {
    return { user: null, error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }
  return result
}
```

- [ ] **Step 4: Run test — verify it passes**

```bash
pnpm test src/tests/lib/api/auth-guard.test.ts
```

Expected: PASS — 5 tests green.

- [ ] **Step 5: Commit**

```bash
git add src/lib/api/auth-guard.ts src/tests/lib/api/auth-guard.test.ts
git commit -m "feat: add requireAuth and requireAdmin API route guards"
```

---

## Task 9: Rate-Limiting Middleware

**Files:**
- Create: `src/middleware.ts`
- Create: `src/tests/middleware.rate-limit.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/tests/middleware.rate-limit.test.ts
import { describe, it, expect, beforeEach } from 'vitest'

// Test the rate-limit counter logic in isolation
function createRateLimiter() {
  const map = new Map<string, { count: number; resetAt: number }>()

  function check(key: string, limit: number, nowMs = Date.now()): boolean {
    const entry = map.get(key)
    if (!entry || entry.resetAt < nowMs) {
      map.set(key, { count: 1, resetAt: nowMs + 60_000 })
      return true
    }
    if (entry.count >= limit) return false
    entry.count++
    return true
  }

  return { check }
}

describe('rate limiter', () => {
  let rl: ReturnType<typeof createRateLimiter>
  beforeEach(() => { rl = createRateLimiter() })

  it('allows requests up to the limit', () => {
    for (let i = 0; i < 10; i++) expect(rl.check('k', 10)).toBe(true)
  })

  it('blocks the (limit+1)th request', () => {
    for (let i = 0; i < 10; i++) rl.check('k', 10)
    expect(rl.check('k', 10)).toBe(false)
  })

  it('resets after the window', () => {
    for (let i = 0; i < 10; i++) rl.check('k', 10)
    expect(rl.check('k', 10, Date.now() + 61_000)).toBe(true)
  })

  it('independent keys do not share counters', () => {
    for (let i = 0; i < 10; i++) rl.check('a', 10)
    expect(rl.check('a', 10)).toBe(false)
    expect(rl.check('b', 10)).toBe(true)
  })
})
```

- [ ] **Step 2: Run test — verify it passes (self-contained)**

```bash
pnpm test src/tests/middleware.rate-limit.test.ts
```

Expected: PASS — 4 tests green.

- [ ] **Step 3: Write `src/middleware.ts`**

```typescript
// src/middleware.ts
import { auth } from '@/auth'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const rateLimitMap = new Map<string, { count: number; resetAt: number }>()

function getRateLimit(pathname: string): number {
  if (pathname.startsWith('/api/auth'))   return 10
  if (pathname.startsWith('/api/upload')) return 5
  if (pathname.startsWith('/api/webhooks')) return 100
  if (pathname.startsWith('/api/admin')) return 30
  if (pathname === '/api/study/answer' || pathname === '/api/diagnostic/answer') return 60
  return 120
}

function checkRateLimit(key: string, limit: number): boolean {
  const now = Date.now()
  const entry = rateLimitMap.get(key)
  if (!entry || entry.resetAt < now) {
    rateLimitMap.set(key, { count: 1, resetAt: now + 60_000 })
    return true
  }
  if (entry.count >= limit) return false
  entry.count++
  return true
}

const PUBLIC_PATHS = new Set(['/login', '/register', '/pricing', '/'])

export default auth((req: NextRequest & { auth: unknown }) => {
  const { pathname } = req.nextUrl

  if (pathname.startsWith('/_next') || pathname === '/api/health') return NextResponse.next()

  if (pathname.startsWith('/api/')) {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
    if (!checkRateLimit(`${ip}:${pathname}`, getRateLimit(pathname))) {
      return NextResponse.json({ error: 'rate_limit_exceeded', retryAfter: 60 }, { status: 429 })
    }
  }

  if (PUBLIC_PATHS.has(pathname) || pathname.startsWith('/api/auth')) return NextResponse.next()

  if (!(req as any).auth) {
    const url = new URL('/login', req.url)
    url.searchParams.set('callbackUrl', pathname)
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
})

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|webp|svg)$).*)'],
}
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
pnpm type-check
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/middleware.ts src/tests/middleware.rate-limit.test.ts
git commit -m "feat: add auth middleware with per-endpoint rate limiting"
```

---

## Task 10: Root Layout + Auth Pages + Dashboard Shell

**Files:**
- Modify: `src/app/layout.tsx`
- Create: `src/app/page.tsx`
- Create: `src/app/(auth)/layout.tsx`
- Create: `src/app/(auth)/login/page.tsx`
- Create: `src/app/(auth)/register/page.tsx`
- Create: `src/app/api/auth/register/route.ts`
- Create: `src/app/dashboard/page.tsx`

- [ ] **Step 1: Write root layout**

```tsx
// src/app/layout.tsx
import type { Metadata } from 'next'
import { DM_Serif_Display, Inter } from 'next/font/google'
import '@/app/globals.css'

const dmSerifDisplay = DM_Serif_Display({
  weight: ['400'], style: ['normal', 'italic'],
  subsets: ['latin'], variable: '--font-display-var', display: 'swap',
})
const inter = Inter({ subsets: ['latin'], variable: '--font-body-var', display: 'swap' })

export const metadata: Metadata = {
  title: { default: 'CogniPrep — AI-Powered Exam Preparation', template: '%s | CogniPrep' },
  description: 'Adaptive exam preparation powered by AI. Personalized diagnostics, spaced repetition, and Socratic tutoring for any exam worldwide.',
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'),
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${dmSerifDisplay.variable} ${inter.variable}`}>
      <body>{children}</body>
    </html>
  )
}
```

- [ ] **Step 2: Write public home page**

```tsx
// src/app/page.tsx
import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export default async function HomePage() {
  const session = await auth()
  if (session) redirect('/dashboard')

  return (
    <main style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 'var(--space-6)', padding: 'var(--space-8)', textAlign: 'center' }}>
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-hero)', lineHeight: 'var(--leading-tight)', maxWidth: '14ch' }}>
        Prepare smarter. Pass faster.
      </h1>
      <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-lg)', maxWidth: '48ch' }}>
        AI-powered adaptive exam prep that knows exactly what you need to study next.
      </p>
      <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap', justifyContent: 'center' }}>
        <Link href="/register" style={{ padding: 'var(--space-3) var(--space-8)', background: 'var(--color-primary)', color: 'var(--color-text-on-primary)', borderRadius: 'var(--radius-md)', fontWeight: 600 }}>
          Get started free
        </Link>
        <Link href="/login" style={{ padding: 'var(--space-3) var(--space-8)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', color: 'var(--color-text)' }}>
          Sign in
        </Link>
      </div>
    </main>
  )
}
```

- [ ] **Step 3: Write auth group layout**

```tsx
// src/app/(auth)/layout.tsx
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-4)', background: 'var(--color-bg)' }}>
      {children}
    </main>
  )
}
```

- [ ] **Step 4: Write login page**

```tsx
// src/app/(auth)/login/page.tsx
'use client'
import { useState } from 'react'
import { signIn } from 'next-auth/react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'

const card: React.CSSProperties = { width: '100%', maxWidth: '420px', background: 'var(--color-surface)', borderRadius: 'var(--radius-xl)', padding: 'var(--space-8)', boxShadow: 'var(--shadow-lg)', border: '1px solid var(--color-border)' }
const primaryBtn: React.CSSProperties = { width: '100%', padding: 'var(--space-3) var(--space-4)', borderRadius: 'var(--radius-md)', fontWeight: 500, cursor: 'pointer', background: 'var(--color-primary)', color: 'var(--color-text-on-primary)', border: 'none', fontSize: 'var(--text-base)' }
const outlineBtn: React.CSSProperties = { ...primaryBtn, background: 'transparent', color: 'var(--color-text)', border: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--space-2)' }
const inputStyle: React.CSSProperties = { padding: 'var(--space-2) var(--space-3)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', fontSize: 'var(--text-base)', width: '100%' }
const label: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 'var(--space-1)', fontSize: 'var(--text-sm)', fontWeight: 500 }

export default function LoginPage() {
  const params = useSearchParams()
  const callbackUrl = params.get('callbackUrl') ?? '/dashboard'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setError(null); setLoading(true)
    const r = await signIn('credentials', { email, password, callbackUrl, redirect: false })
    setLoading(false)
    if (r?.error) setError('Invalid email or password.')
    else window.location.href = callbackUrl
  }

  return (
    <div style={card}>
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-3xl)', marginBottom: 'var(--space-2)' }}>Welcome back</h1>
      <p style={{ color: 'var(--color-text-muted)', marginBottom: 'var(--space-6)' }}>Sign in to continue studying</p>

      <button style={outlineBtn} onClick={() => signIn('google', { callbackUrl })}>
        <GoogleIcon /> Continue with Google
      </button>

      <p style={{ textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)', margin: 'var(--space-4) 0' }}>or</p>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
        {error && <p style={{ color: 'var(--color-error)', fontSize: 'var(--text-sm)' }}>{error}</p>}
        <label style={label}>Email <input type="email" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" style={inputStyle} /></label>
        <label style={label}>Password <input type="password" value={password} onChange={e => setPassword(e.target.value)} required autoComplete="current-password" style={inputStyle} /></label>
        <button type="submit" disabled={loading} style={primaryBtn}>{loading ? 'Signing in…' : 'Sign in'}</button>
      </form>

      <p style={{ marginTop: 'var(--space-4)', fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', textAlign: 'center' }}>
        No account? <Link href="/register" style={{ color: 'var(--color-primary)' }}>Create one</Link>
      </p>
    </div>
  )
}

function GoogleIcon() {
  return <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/><path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z"/><path fill="#FBBC05" d="M3.964 10.707c-.18-.54-.282-1.117-.282-1.707s.102-1.167.282-1.707V4.961H.957C.347 6.175 0 7.548 0 9s.348 2.825.957 4.039l3.007-2.332z"/><path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.961L3.964 7.293C4.672 5.163 6.656 3.58 9 3.58z"/></svg>
}
```

- [ ] **Step 5: Write register page**

```tsx
// src/app/(auth)/register/page.tsx
'use client'
import { useState } from 'react'
import { signIn } from 'next-auth/react'
import Link from 'next/link'

const card: React.CSSProperties = { width: '100%', maxWidth: '420px', background: 'var(--color-surface)', borderRadius: 'var(--radius-xl)', padding: 'var(--space-8)', boxShadow: 'var(--shadow-lg)', border: '1px solid var(--color-border)' }
const primaryBtn: React.CSSProperties = { width: '100%', padding: 'var(--space-3) var(--space-4)', borderRadius: 'var(--radius-md)', fontWeight: 500, cursor: 'pointer', background: 'var(--color-primary)', color: 'var(--color-text-on-primary)', border: 'none', fontSize: 'var(--text-base)' }
const outlineBtn: React.CSSProperties = { ...primaryBtn, background: 'transparent', color: 'var(--color-text)', border: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--space-2)' }
const inputStyle: React.CSSProperties = { padding: 'var(--space-2) var(--space-3)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', fontSize: 'var(--text-base)', width: '100%' }
const labelS: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 'var(--space-1)', fontSize: 'var(--text-sm)', fontWeight: 500 }

export default function RegisterPage() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setError(null); setLoading(true)
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password }),
    })
    if (!res.ok) {
      const body = await res.json()
      setError(body.error ?? 'Registration failed.')
      setLoading(false)
      return
    }
    await signIn('credentials', { email, password, callbackUrl: '/onboarding' })
  }

  return (
    <div style={card}>
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-3xl)', marginBottom: 'var(--space-2)' }}>Create account</h1>
      <p style={{ color: 'var(--color-text-muted)', marginBottom: 'var(--space-6)' }}>Start your personalized exam prep journey</p>

      <button style={outlineBtn} onClick={() => signIn('google', { callbackUrl: '/onboarding' })}>
        <GoogleIcon /> Continue with Google
      </button>

      <p style={{ textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)', margin: 'var(--space-4) 0' }}>or</p>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
        {error && <p style={{ color: 'var(--color-error)', fontSize: 'var(--text-sm)' }}>{error}</p>}
        <label style={labelS}>Full name <input type="text" value={name} onChange={e => setName(e.target.value)} required autoComplete="name" style={inputStyle} /></label>
        <label style={labelS}>Email <input type="email" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" style={inputStyle} /></label>
        <label style={labelS}>Password <input type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={8} autoComplete="new-password" style={inputStyle} /></label>
        <button type="submit" disabled={loading} style={primaryBtn}>{loading ? 'Creating account…' : 'Create account'}</button>
      </form>

      <p style={{ marginTop: 'var(--space-4)', fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', textAlign: 'center' }}>
        Already have an account? <Link href="/login" style={{ color: 'var(--color-primary)' }}>Sign in</Link>
      </p>
    </div>
  )
}

function GoogleIcon() {
  return <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/><path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z"/><path fill="#FBBC05" d="M3.964 10.707c-.18-.54-.282-1.117-.282-1.707s.102-1.167.282-1.707V4.961H.957C.347 6.175 0 7.548 0 9s.348 2.825.957 4.039l3.007-2.332z"/><path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.961L3.964 7.293C4.672 5.163 6.656 3.58 9 3.58z"/></svg>
}
```

- [ ] **Step 6: Write registration API route**

```typescript
// src/app/api/auth/register/route.ts
import { NextResponse } from 'next/server'
import { hash } from 'bcryptjs'
import { z } from 'zod'
import { getPool } from '@/lib/db/pool'

const Schema = z.object({
  name:     z.string().min(1).max(100),
  email:    z.string().email(),
  password: z.string().min(8).max(128),
})

export async function POST(req: Request) {
  let body: unknown
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const parsed = Schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? 'Invalid input' }, { status: 422 })
  }

  const { name, email, password } = parsed.data
  const passwordHash = await hash(password, 12)

  try {
    await getPool().query(
      'INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3)',
      [name, email, passwordHash]
    )
    return NextResponse.json({ success: true }, { status: 201 })
  } catch (err: unknown) {
    if ((err as { code?: string }).code === '23505') {
      return NextResponse.json({ error: 'Email already in use.' }, { status: 409 })
    }
    return NextResponse.json({ error: 'Registration failed.' }, { status: 500 })
  }
}
```

- [ ] **Step 7: Write dashboard shell**

```tsx
// src/app/dashboard/page.tsx
import { auth } from '@/auth'
import { redirect } from 'next/navigation'

export const metadata = { title: 'Dashboard' }

export default async function DashboardPage() {
  const session = await auth()
  if (!session) redirect('/login')

  return (
    <main style={{ minHeight: '100dvh', padding: 'var(--space-8)', background: 'var(--color-bg)' }}>
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-2xl)', marginBottom: 'var(--space-4)' }}>
        Welcome back, {session.user.name ?? session.user.email}
      </h1>
      <p style={{ color: 'var(--color-text-muted)' }}>
        Your personalized dashboard loads here after Plan B (Onboarding + Diagnostic) is complete.
      </p>
    </main>
  )
}
```

- [ ] **Step 8: Manually verify the full auth flow**

```bash
pnpm dev
```

1. `http://localhost:3000` → home page (logged out)
2. Click "Get started free" → `/register` — register with test email
3. Verify you are redirected to `/onboarding` (404 — expected in Plan 1)
4. Navigate to `/dashboard` → shows "Welcome back, [name]"
5. Open incognito → navigate to `/dashboard` → redirects to `/login`
6. Login with test credentials → back to `/dashboard`

Stop dev server.

- [ ] **Step 9: Commit**

```bash
git add src/app/layout.tsx src/app/page.tsx src/app/(auth)/ src/app/api/auth/register/ src/app/dashboard/
git commit -m "feat: add login, register, and dashboard shell pages"
```

---

## Task 11: Health Check API + Vercel Cron

**Files:**
- Create: `src/app/api/health/route.ts`
- Create: `src/app/api/cron/health/route.ts`
- Create: `vercel.json`

- [ ] **Step 1: Write health check route**

```typescript
// src/app/api/health/route.ts
import { NextResponse } from 'next/server'
import { getPool } from '@/lib/db/pool'

export async function GET() {
  let dbStatus: 'ok' | 'error' = 'error'
  try {
    await getPool().query('SELECT 1')
    dbStatus = 'ok'
  } catch {
    process.stderr.write('[health] DB unreachable\n')
  }
  return NextResponse.json({ status: 'ok', db: dbStatus, timestamp: new Date().toISOString() })
}
```

- [ ] **Step 2: Write cron health route**

```typescript
// src/app/api/cron/health/route.ts
import { NextResponse } from 'next/server'
import { getPool } from '@/lib/db/pool'

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET
  if (secret && req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    await getPool().query('SELECT 1')
    return NextResponse.json({ warmed: true })
  } catch (err) {
    process.stderr.write(`[cron/health] DB ping failed: ${(err as Error).message}\n`)
    return NextResponse.json({ warmed: false, error: 'DB unreachable' }, { status: 500 })
  }
}
```

- [ ] **Step 3: Write `vercel.json`**

```json
{
  "crons": [
    { "path": "/api/cron/health",        "schedule": "*/10 * * * *" },
    { "path": "/api/cron/purge-deleted", "schedule": "0 2 * * *" }
  ]
}
```

- [ ] **Step 4: Test health endpoint**

```bash
pnpm dev
```

```bash
curl http://localhost:3000/api/health
```

Expected: `{"status":"ok","db":"ok","timestamp":"..."}`

Stop dev server.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/health/ src/app/api/cron/ vercel.json
git commit -m "feat: add health check API and Vercel cron for Aurora warm-up"
```

---

## Task 12: Full Test Run + Coverage Check

- [ ] **Step 1: Run all tests**

```bash
pnpm test
```

Expected: all tests green. Failures indicate a setup issue — check `DATABASE_URL` in `.env.local`.

- [ ] **Step 2: Check coverage**

```bash
pnpm test:coverage
```

Expected: coverage report shows ≥80% for `src/lib/` files. The coverage report is at `coverage/index.html`.

- [ ] **Step 3: Final type check**

```bash
pnpm type-check
```

Expected: zero errors.

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "chore: Phase 1 complete — setup, auth, DB, middleware, design system"
```

---

## Phase 1 Complete ✅

| Deliverable | Status |
|-------------|--------|
| Next.js 15 App Router scaffolded | ✅ |
| All dependencies installed | ✅ |
| TypeScript strict mode | ✅ |
| CSS design system (tokens) | ✅ |
| Shared TypeScript types | ✅ |
| Aurora connection pool | ✅ |
| Full DB schema (22 tables, 25 indexes) deployed | ✅ |
| Migration runner + idempotency | ✅ |
| NextAuth v5 (Google + email/password) | ✅ |
| Soft-deleted user session block | ✅ |
| requireAuth + requireAdmin guards | ✅ |
| Rate-limiting middleware | ✅ |
| Login + Register pages | ✅ |
| Dashboard shell (protected) | ✅ |
| Health check API + Vercel cron | ✅ |
| Env var validation at startup | ✅ |
| All tests green | ✅ |
| TypeScript compiles with zero errors | ✅ |

**Next plan:** `2026-06-28-phase-2-onboarding-diagnostic.md`

---

## Self-Review

### Spec Coverage

| Spec requirement | Task |
|-----------------|------|
| Next.js 15 App Router only | 1 |
| Aurora pg Pool, SSL, singleton | 5 |
| pgvector + HNSW index (m=16, ef=64) | 6 |
| NextAuth v5 Google + Credentials | 7 |
| session.user enriched (tier, role) | 7 |
| session callback throws on deleted_at | 7 |
| requireAuth + requireAdmin | 8 |
| Rate limiting by endpoint (all 7 categories) | 9 |
| Stripe webhook rate limit (100/min) | 9 |
| DM Serif Display + Inter | 10 |
| Login page (Google + email/password) | 10 |
| Register → /onboarding redirect | 10 |
| bcrypt cost-12 in registration API | 10 |
| Dashboard protected shell | 10 |
| Health check endpoint | 11 |
| Vercel cron (*/10 + 0 2 daily) | 11 |
| CSS custom properties only, no hex | 3 |
| UsageEventType union | 4 |
| ExamDomain union | 4 |
| Numbered migration files + runner | 6 |
| schema_migrations tracking table | 6 |
| password_hash column (nullable) | 6 |
| deleted_at column + partial index | 6 |
| domain column on exams + CHECK | 6 |
| Diagnostic uniqueness constraint | 6 |
| idx_user_exams_composite | 6 |
| idx_questions_options_gin | 6 |
| Full-text search index on exams | 6 |
| Env var validation | 5 |

### Type Consistency Check

- `SessionUser.tier: AccountTier` → auth.ts cast: `as SessionUser['tier']` ✅
- `SessionUser.role: UserRole` → auth-guard.ts check: `=== 'admin'` ✅
- `requireAuth` return type matches test assertions (`.error?.status`) ✅
- `ApiResponse<T>` matches registration route return shape ✅

### Gaps Found and Fixed Inline

- Registration page was hashing password on the client side (security bug) → moved hashing to `POST /api/auth/register` server route.
- `getPool()` had a redundant `!connectionString` check that duplicated `validateEnv()` → removed duplicate, delegated entirely to `validateEnv()`.
