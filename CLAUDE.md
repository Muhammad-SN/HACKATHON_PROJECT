# CogniPrep — Claude Code Instructions

## Read Before Writing Any Code

Read these three files at the start of every session, in order:

1. [`docs/spec-document.md`](docs/spec-document.md) — full design and architecture specification
2. [`README.md`](README.md) — project overview, stack, structure
3. This file

Do not write a single line of implementation code without reading all three.

---

## Project Context

CogniPrep is an AI-powered adaptive exam preparation platform. Hackathon deadline: June 29, 2026, 5:00 PM PDT. Stack: Next.js 15 + Vercel + Aurora PostgreSQL + AWS Lambda + S3.

---

## Hard Constraints

- **Framework:** Next.js 15 App Router only. No Pages Router. No mixing.
- **Database:** Aurora PostgreSQL via direct `pg` connection pool. pgvector extension must be enabled.
- **Auth:** NextAuth.js v5 with PostgreSQL adapter. Providers: Google OAuth (primary) + Credentials email/password (fallback). No other auth library. No magic links in v1.
- **LLMs:** Anthropic SDK only. `claude-haiku-4-5-20251001` for free tier. `claude-sonnet-4-6` for premium. No other LLM provider.
- **PDF processing:** `pdf-parse` for free tier Lambda. AWS Textract SDK for premium. Never process PDFs in the Next.js server — always Lambda.
- **File uploads:** AWS S3 presigned URLs only. Never proxy file uploads through Next.js API routes.
- **Secrets:** All via environment variables. Never hardcode. Validate at startup.
- **Payments:** Stripe for both Premium subscriptions (`STRIPE_PREMIUM_PRICE_ID`) and per-exam purchases. All Stripe events flow through `/api/webhooks/stripe` — verify signature using `stripe.webhooks.constructEvent` on every inbound POST using the raw body (not parsed JSON). Never trust unverified webhook bodies. The webhook handler is the **only** place `users.tier` is set to `'premium'`.
- **Admin role:** Admin-only routes must use `requireAdmin()` from `src/lib/api/auth-guard.ts`. Never manually check `session.user.role` in route handlers — always use the guard.
- **Onboarding gate:** New users must select a target exam on `/onboarding` before accessing `/diagnostic`. The `newUser` NextAuth callback redirects first-time OAuth users to `/onboarding` automatically.
- **Stripe customer ID:** Created lazily on first Stripe interaction (`users.stripe_customer_id`). Never create it at registration — it wastes Stripe API calls for users who never upgrade.
- **Lambda:** All Lambda code lives in `lambda/` at the repo root. Never import from `src/` inside `lambda/` — they are completely separate build targets.

---

## Architecture Rules

### Seven Learning Engines

Each engine lives in `src/lib/engines/` as a pure TypeScript module:

| File | Purpose |
|------|---------|
| `cold-start.ts` | IRT 2PL + CAT adaptive diagnostic |
| `bkt.ts` | Bayesian Knowledge Tracing mastery updates |
| `sm2.ts` | Modified SM-2 spaced repetition scheduling |
| `selector.ts` | Multi-criteria next-question priority scoring |
| `readiness.ts` | Weighted mastery aggregation + confidence interval |
| `generator.ts` | Claude Haiku/Sonnet question generation pipelines |
| `socratic.ts` | 3-step Socratic explanation prompt chain |

**Engines are pure functions — no database calls inside them.** They receive data, return data. API routes handle all DB reads/writes before and after calling engines.

### Access Control — Two Independent Flags

`stakes_level` and `account_tier` are orthogonal. **Never conflate them.**

- `account_tier` (`free` | `premium`) — governs platform features only
- `stakes_level` (`low` | `high`) — governs exam content access

Rules:
- Low-stakes exams: free to ALL authenticated users when `is_public = true`. Creator always has access to their own upload regardless of `is_public`. Premium subscription does NOT gate low-stakes community content.
- High-stakes exams: gated by `user_exam_purchases`. Tier is irrelevant — Premium does NOT unlock high-stakes content.
- Any exam with `classification_source = 'pending_review'` must be treated as `high` and access denied — never grant access to an unreviewed exam.
- Access check logic lives in `src/lib/access/check.ts` (pure function, no DB calls inside).
- Classification logic lives in `src/lib/access/classifier.ts` (rules list + AI fallback).
- Every study session load must call `/api/exams/[examId]/access` first. No exceptions.

### Database Layer

All queries live in `src/lib/db/`. Never write raw SQL in components or API routes — always call a typed function from the db layer. All queries use parameterized statements. No string concatenation in SQL.

### AI Layer

All Anthropic SDK calls live in `src/lib/ai/`. Every LLM call must log to the `usage_events` table using `trackUsage()` from `src/lib/ai/usage.ts`. This is mandatory — not optional.

---

## Coding Standards

- TypeScript strict mode throughout. No `any` without explicit justification in a comment.
- Files max 800 lines. Functions max 50 lines. Split before hitting the limit.
- Immutable patterns — never mutate objects. Return new copies.
- All user inputs validated with Zod at every API route boundary.
- Error handling at every level — never silently swallow errors.
- No `console.log` in committed code.
- No hardcoded color hex values in components — always use CSS custom properties from `src/styles/tokens.css`.

---

## Design System

### Color Tokens (always use these, never raw hex)

```css
/* Light mode */
--color-bg, --color-surface, --color-primary, --color-accent,
--color-text, --color-text-muted, --color-weak, --color-mastered, --color-border

/* Dark mode */
--color-bg-dark, --color-surface-dark, --color-primary-dark,
--color-accent-dark, --color-text-dark
```

### Typography

- `font-display`: DM Serif Display — large numbers, headers, Socratic tutor voice
- `font-body`: Inter — all UI text, labels, buttons, body copy
- Never use a third typeface

### Motion Rules

- Socratic panel slide-up: 300ms ease-out-expo
- Question fade: 200ms ease-in-out (fade only, no slide — motion sickness risk)
- No spring physics, no bounce, no confetti
- Respect `prefers-reduced-motion` — disable non-essential motion

---

## Project Structure

```
lambda/                     # AWS Lambda processor — separate from Next.js app
├── src/index.ts            # Lambda handler entry point
├── src/processor.ts        # PDF/text → chunk → generate questions → store
├── src/chunker.ts          # 500-token chunking with 50-token overlap
├── src/pdf.ts              # pdf-parse (free) + Textract (premium)
└── src/db.ts               # Single pg Client (no pool — Lambda is single-invocation)

src/
├── app/
│   ├── (auth)/             # /login, /register
│   ├── onboarding/         # /onboarding — post-registration exam selection (REQUIRED before diagnostic)
│   ├── dashboard/          # / (home after login)
│   ├── diagnostic/         # /diagnostic
│   ├── study/              # /study/[sessionId]
│   ├── progress/           # /progress
│   ├── upload/             # /upload
│   ├── library/            # /library — community exam discovery (My Exams + Community tabs)
│   ├── pricing/            # /pricing — Free vs Premium comparison, public page
│   ├── settings/           # /settings — tier, upgrade CTA, purchase history, Stripe portal
│   ├── admin/              # /admin — admin-only, review queue + audit log
│   └── api/
│       ├── auth/           # NextAuth handler (Google OAuth + email/password)
│       ├── diagnostic/     # start, answer, complete
│       ├── study/          # next-question, answer
│       ├── upload/         # presigned-url, process, text, status
│       ├── progress/       # readiness, mastery
│       ├── exams/          # list, create, access-check, purchase, topics
│       ├── billing/        # checkout (subscription), portal (Stripe Billing Portal)
│       ├── webhooks/       # stripe — handles ALL Stripe events (sig-verified)
│       ├── onboarding/     # search — full-text exam search for onboarding step
│       └── admin/          # review-queue, classify, publish
├── components/
│   ├── ui/                 # Button, Card, Badge, Input, etc.
│   ├── dashboard/          # ReadinessIsland, MasteryHeatMap, ActionTiles
│   ├── study/              # QuestionCard, AnswerChoices, SocraticPanel
│   ├── diagnostic/         # DiagnosticQuestion, DiagnosticProgress
│   ├── library/            # ExamCard, StakesBadge, LibraryFilter
│   ├── settings/           # TierBadge, PurchaseHistoryTable, UpgradeCTA
│   ├── admin/              # ReviewQueueTable, AuditLogTable
│   └── progress/           # ProgressChart, WeakAreaCard
├── lib/
│   ├── engines/            # Seven learning subsystems (pure functions)
│   ├── db/                 # All database query functions
│   ├── ai/                 # Anthropic SDK wrappers + usage tracking
│   ├── access/             # check.ts (access guard), classifier.ts (stakes rules + AI fallback)
│   ├── stripe/             # Stripe SDK wrappers (checkout, portal, subscription helpers)
│   ├── schemas/            # Zod schemas for all API route validation (one file per domain)
│   └── s3/                 # Presigned URL generation
├── styles/
│   └── tokens.css          # All CSS custom properties (colors, spacing, type)
└── types/
    └── index.ts            # Shared TypeScript types

migrations/                 # Numbered SQL files applied by scripts/migrate.ts
├── 0001_initial_schema.sql
└── 0002_add_pgvector.sql

scripts/
├── migrate.ts              # pnpm db:migrate — applies pending migrations in order
└── seed.ts                 # pnpm db:seed — optional local dev seed data
```

---

## Implementation Sequence

Build in this order. Do not jump ahead.

1. **Setup** — Next.js 15 scaffold, Aurora connection, schema migration, NextAuth (Google OAuth + email/password), tokens.css, layout shell, `requireAuth` + `requireAdmin` guards
2. **Onboarding** — `/onboarding` exam search page, `/api/onboarding/search`, exam enrollment → redirect to diagnostic
3. **Cold Start Diagnostic** — IRT engine, `/api/exams/[examId]/topics`, diagnostic API routes, diagnostic UI, mastery seeding
4. **Document Upload** — textarea input, S3 presigned URL flow, Lambda processor (`lambda/` dir), question generation, community auto-publish rule
5. **Adaptive Study Session** — BKT + SM-2 + selector engines, study API routes, question UI, Socratic slide-up panel
6. **Readiness Dashboard** — prediction engine, mastery heat map, analytics dark mode page
7. **Monetization** — Stripe subscription checkout + webhook handler + Billing Portal, per-exam purchase, `/pricing`, `/settings`, upload limit enforcement
8. **Library & Admin** — `/library` community browsing, `/admin` review queue + audit log
9. **Polish** — rate limiting middleware, error states, loading states, responsive layout

---

## Agents to Use

| Situation | Agent |
|-----------|-------|
| After writing any code | `code-reviewer` |
| Auth, API routes, user input handling | `security-reviewer` |
| Build fails | `build-error-resolver` |
| New feature planning | `planner` |
| TypeScript errors | `build-error-resolver` |

---

## Testing

- Write tests before implementation (TDD — RED then GREEN then REFACTOR)
- Minimum 80% coverage
- Unit tests for all engine functions in `src/lib/engines/`
- Integration tests for all API routes
- Use Vitest
