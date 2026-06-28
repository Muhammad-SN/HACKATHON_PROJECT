# CogniPrep — Design & Architecture Specification

**Date:** 2026-06-25
**Hackathon:** H0: Hack the Zero Stack (Vercel v0 + AWS Databases)
**Deadline:** June 29, 2026, 5:00 PM PDT
**Track:** Monetizable B2C

---

## 1. Product Vision

CogniPrep is an AI-powered adaptive exam preparation platform that personalizes the learning experience for any exam worldwide. Unlike static flashcard apps or generic question banks, CogniPrep uses seven specialized learning subsystems to diagnose what students know, identify what they don't, and guide them toward exam readiness with Socratic AI tutoring.

**The core promise:** A student opens CogniPrep, tells it what exam they're preparing for, and within 15 minutes has a fully personalized study plan — even with zero prior history on the platform.

---

## 2. Core Problems Solved

| Priority | Problem | Solution |
|----------|---------|---------|
| 1 | Cold Start — new users have no history | IRT-based adaptive diagnostic (15-20 questions) seeds mastery table |
| 2 | Any Domain — students prepare for any exam worldwide | Document ingestion + AI curriculum generation |
| 3 | Weak Area Detection — students don't know what they don't know | Mastery heat map, BKT-based per-topic confidence scores |
| 4 | Readiness Prediction — students can't gauge readiness objectively | Weighted mastery aggregation with confidence interval |
| 5 | Socratic Explanations — wrong answers go unexplained | 3-step Socratic AI prompt chain after each incorrect answer |

---

## 3. Feature Specifications

### 3.1 Cold Start Adaptive Diagnostic

**Algorithm:** Item Response Theory — 2-Parameter Logistic (2PL) model with Computer Adaptive Testing (CAT)

**Flow:**
1. New user registers and selects or uploads their target exam
2. System identifies 5-7 key topics from the exam curriculum
3. Binary-search difficulty selection picks opening question per topic at difficulty 0.5
4. After each answer, IRT updates ability estimate; next question difficulty adjusts
5. Stops at 15-20 questions or when ability estimate converges (SE < 0.3)
6. Seeds `user_topic_mastery` with initial mastery probabilities per topic
7. No score shown during diagnostic — warm completion screen: "Your learning map is ready."
8. Redirects to fully populated dashboard

**UI:**
- Centered layout, no sidebar, no distractions
- Warm amber banner: "Let's map what you already know. 15 quick questions, no pressure."
- One question card at a time, 4 answer choices
- "Step 8 of 15" progress indicator at bottom
- No back button (adaptive — prior answers affect what comes next)

### 3.2 Any Domain — Document Ingestion

**Free Tier (Option A):**
- Input: textarea (paste text) OR PDF file upload
- PDF processing: `pdf-parse` npm package (OSS, runs in AWS Lambda, $0)
- Chunking: Split text into ~500 token chunks with 50-token overlap
- Question generation: Claude Haiku — 50 questions per upload (~$0.015)
- Full-text indexing: tsvector/tsquery in Aurora PostgreSQL ($0)

**Premium Tier (Option C):**
- Input: Both document upload AND exam name only (AI generates full curriculum)
- Curriculum generation: Claude Sonnet from exam name alone (~$0.20)
- PDF processing: AWS Textract for scanned/image PDFs (~$1.50/1K pages)
- Semantic search: pgvector + AWS Bedrock Titan Embed Text v2 ($0.00002/1K tokens)

### 3.3 Adaptive Study Session

**Next-Question Selector — multi-criteria priority scoring:**
```
Priority = 0.40 × (1 - mastery_probability)
         + 0.30 × overdue_factor
         + 0.20 × exam_topic_weight
         + 0.10 × prerequisite_availability
```
Where `overdue_factor = days_overdue / max_days` capped at 1.0.

**Mastery Update — Bayesian Knowledge Tracing (BKT):**
- 4 parameters per topic: P(prior)=0.3, P(learn)=0.1, P(slip)=0.1, P(guess)=0.2
- Updates `user_topic_mastery.mastery_probability` after every answer

**Scheduling — Modified SM-2:**
- Computes `next_review_date` per (user, question) pair
- Modified to incorporate prerequisite mastery — prerequisite questions get boosted priority when prerequisites are weak

**UI (Option C — Focus + Slide-up):**
- Top: 4px indigo progress bar, topic label left, "Q7 of 20" right
- Center: white elevated question card (elevated shadow), 4 answer choice cards
- After answer: choices lock (emerald for correct, coral for wrong)
- Slide-up dark navy panel (300ms ease-out-expo, 60% screen height) with Socratic explanation
- Panel dismiss: "Got it, next question →" returns to clean question view

### 3.4 Readiness Prediction Engine

**Predicted Score:**
```
Predicted_Score = Σ(topic_weight × mastery_probability) / Σ(topic_weight) × max_exam_score
```

**Confidence Interval:**
```
CI = ±1.96 × √(mastery_variance / total_attempts)
```

Displayed as: "73% ± 8%" — the confidence interval shrinks as students answer more questions.

**Dashboard Display:**
- Large amber number in DM Serif Display inside a dark navy card
- Confidence interval in small cream text below the number
- Thin amber progress ring around the score
- Updates in real time after each study session

### 3.5 Socratic Explanation Engine

**Prompt Chain (3 steps, Claude Haiku, ~$0.002 each):**
1. Acknowledge what the student likely thought ("You probably chose B because...")
2. Surface the gap ("The key thing that changes this is...")
3. Explain the correct reasoning ("The right answer is C because...")

**UI:**
- Delivered via slide-up panel after every answer (wrong = full explanation, correct = abbreviated insight)
- First line in DM Serif Display ("Here's where your thinking went sideways.")
- Body in Inter
- Amber mastery badge showing BKT update: "+4% on Functions" or "−2% on Calculus"

### 3.6 Post-Registration Onboarding Flow

**Page:** `/onboarding`

After registration, a new user is redirected to `/onboarding` — not to the diagnostic. The diagnostic cannot start without a target exam selected. This is a single focused step, not a multi-step wizard.

**Flow:**
1. User lands on `/onboarding` after successful registration
2. Search bar: "What exam are you preparing for?" with live full-text search against `exams` where `is_public = true`
3. Results show exam name, stakes badge (Low / High), and question count
4. **If exam found:** User selects it → enrolled in `user_exams` → redirected to `/diagnostic?examId={id}`
5. **If exam not found:** Two paths shown side by side:
   - **"Upload your materials"** → redirected to `/upload` with exam name pre-filled as the new exam title
   - **"Let AI generate a curriculum"** (Premium only, greyed out for free users with upgrade tooltip) → redirected to `/upload` in AI-generation mode

**UI:**
- Centered layout, no nav sidebar
- Warm indigo headline: "Let's set up your study plan"
- Subhead in Inter: "Search for your exam or upload your study materials"
- Prominent search bar, full-width
- Results list with subtle entrance animation
- Skip link at bottom: "I'll add an exam later →" → dashboard (but dashboard will show empty state prompting exam selection)

**Access:** Authentication required. Redirect logic (evaluated in middleware, not page-level):
- If `users.created_at > NOW() - INTERVAL '5 minutes'` AND `user_exams` count = 0 → show onboarding (brand-new user)
- If `user_exams` count = 0 but account is older → show onboarding with message: "Add an exam to get started"
- If `user_exams` count > 0 → skip onboarding, redirect to dashboard

Using both conditions prevents the contradiction where a returning user with no exams (deleted all) would be incorrectly treated as a `newUser` by NextAuth's one-time redirect.

---

### 3.7 Exam Library & Community Discovery

**Page:** `/library`

Where users browse and discover available exams. Split into two tabs.

**My Exams tab:**
- Lists all exams in `user_exams` for the current user
- Each card: exam name, readiness score, last studied date, "Continue" CTA
- "Add Exam" button → `/onboarding`

**Community tab:**
- Lists all `exams` where `is_public = true`, ordered by enrollment count desc
- Free users: low-stakes exams shown fully; high-stakes shown with a lock icon + price + "Purchase" CTA
- Search/filter bar: filter by domain (medical, legal, finance, engineering, etc.)
- Clicking a low-stakes exam the user hasn't enrolled in → enroll + redirect to diagnostic
- Clicking a high-stakes exam the user hasn't purchased → redirect to Stripe Checkout

**Exam cards display:**
- Exam name, stakes badge, question count, enrolled user count, price (if high-stakes)
- Lock icon overlay for inaccessible high-stakes exams

---

### 3.8 User Settings & Account Page

**Page:** `/settings`

**Sections:**

**Profile:**
- Name (editable), email (read-only), avatar (from OAuth provider)

**Subscription:**
- Current tier badge (Free / Premium)
- Free: "Upgrade to Premium — $X/month" → Stripe Checkout (subscription mode)
- Premium: "Manage Subscription →" → Stripe Billing Portal (cancel, update card)
- Premium: shows renewal date, monthly cost

**Purchase History:**
- Table of `user_exam_purchases`: exam name, amount paid, purchased date

**Danger Zone:**
- "Delete Account" — soft delete (marks `users.deleted_at`, purges personal data within 30 days)

**URL Params Handled:**
- `?subscribed=true` → show success banner: "Welcome to Premium! All features are now unlocked."
- `?purchased=true` → show success banner for per-exam purchase (though usually landing on `/study` instead)
- `?canceled=true` → neutral info banner: "Your subscription has been canceled."

---

### 3.9 Admin Panel

**Page:** `/admin` (and `/admin/review-queue`, `/admin/exams`)

Accessible only to users with `role = 'admin'`. Middleware redirects non-admins to `/dashboard`.

**Review Queue view (`/admin/review-queue`):**
- Table of `classification_review_queue` where `reviewed_at IS NULL`, ordered by `queued_at` asc (oldest first)
- Columns: Exam Name, Creator Email, Creator Declared Stakes, AI Suggestion, AI Confidence (%), AI Reasoning (expandable), Queued At
- Per-row actions: "Mark Low Stakes" / "Mark High Stakes" + optional note field
- Submitting writes to `exam_stakes_audit`, updates `exams.stakes_level` and `classification_source = 'admin_override'`, sets `reviewed_at` and `reviewed_by`

**Audit Log view (`/admin/audit`):**
- Table of `exam_stakes_audit`, newest first
- Columns: Exam Name, Changed By, From → To, AI Suggestion, Note, Changed At

**Stats header:**
- Count of exams pending review, total classified this week

---

### 3.10 Pricing Page

**Page:** `/pricing`

Public page (no auth required). Where free users are sent when they hit a Premium gate, and where Stripe upgrade cancel redirects.

**Layout:**
- Two-column card comparison: Free vs Premium
- Feature checklist with clear visual differentiation (checkmark vs locked icon)
- Premium price: "$X/month, cancel anytime"
- CTA: "Start Premium" → requires login, then Stripe Checkout
- Below cards: FAQ (3-4 questions: "Does Premium unlock high-stakes exams?", "What happens when I cancel?", "Can I upload unlimited PDFs?")

**The key message to communicate:**
- Free = your own materials, low-stakes community exams
- Premium = AI-generated curricula, Textract, unlimited uploads, Sonnet
- Neither tier alone unlocks high-stakes content — that's a separate per-exam purchase

---

## 4. Monetization & Access Control Architecture

### 4.1 Two Independent Revenue Streams

CogniPrep has two revenue streams that are **fully non-interacting in v1**:

1. **Premium subscription** — governs platform feature richness (AI depth, PDF processing, analytics, semantic search)
2. **Per-exam purchase** — governs access to high-stakes exam content, independent of subscription status

Premium does not unlock high-stakes exams. High-stakes purchases do not upgrade platform features. These are separate products, separately priced, separately charged via Stripe.

> **v2 idea — do not build now:** Tier-based exam discounts or purchase credits for Premium subscribers. Flagged here only; out of scope for v1. Do not introduce any tier-aware pricing logic for exam purchases.

### 4.2 Platform Feature Split (Premium Subscription)

| Feature | Free Tier | Premium Tier |
|---------|-----------|--------------|
| Document input | Textarea + PDF upload | Same + AI curriculum from exam name |
| PDF processing | pdf-parse (OSS) | AWS Textract (tables, scans, images) |
| LLM model | Claude Haiku | Claude Haiku + Sonnet |
| Questions per upload | 50 | Unlimited |
| Semantic search | Full-text (PostgreSQL) | Vector search (pgvector + Titan) |
| Community library | Low-stakes curricula | Low-stakes curricula |

Both tiers access the community curriculum library for low-stakes content. High-stakes curricula require a per-exam purchase regardless of tier — that is a content gate, not a feature gate.

All costs tracked via `usage_events` table from day one. Structured for Stripe webhook integration.

### 4.3 Stakes Classification System

Every exam carries a `stakes_level` of `low` or `high`. This is a **content/liability classification — orthogonal to `account_tier`**. It determines content access independently of subscription status.

**Classification pipeline (evaluated in priority order):**

**1. Rules-list match (primary — deterministic, no AI):**
Keyword matching against the exam name (case-insensitive). Any exam name matching a rule is auto-flagged `high`. The matched rule name is written to `classification_matched_rule` for auditability. Implemented in `src/lib/access/classifier.ts`:

```typescript
// src/lib/access/classifier.ts
export const HIGH_STAKES_RULES = [
  { name: 'medical_licensing',        patterns: [/\busmle\b/i, /\bnclex\b/i, /\bmcat\b/i, /\bplex\b/i, /medical.*(licens|board|exam)/i, /nursing.*board/i] },
  { name: 'legal_bar',                patterns: [/\bbar exam\b/i, /\blsat\b/i, /multistate.*bar/i, /law.*admission/i] },
  { name: 'financial_certification',  patterns: [/\bcpa\b/i, /\bcfa\b/i, /\bseries\s*\d+\b/i, /\bcfp\b/i, /\bfrm\b/i, /\bcma\b/i, /finra/i] },
  { name: 'engineering_licensure',    patterns: [/\bpe exam\b/i, /\bfe exam\b/i, /professional engineer/i, /engineering.*licens/i] },
  { name: 'grad_admissions',          patterns: [/\bgre\b/i, /\bgmat\b/i, /graduate.*admis/i, /\blsat\b/i, /\bmcat\b/i] },
  { name: 'professional_cert_it',     patterns: [/\bcissp\b/i, /\bccna\b/i, /\bccnp\b/i, /comptia/i, /aws.*certif/i, /google.*certif/i, /azure.*certif/i] },
  { name: 'professional_cert_mgmt',   patterns: [/\bpmp\b/i, /\bpmi\b/i, /\bsix sigma\b/i, /\bscrum master\b/i] },
  { name: 'government_civil_service', patterns: [/civil service/i, /government.*exam/i, /\bupsc\b/i, /\bips\b/i] },
] as const

export type HighStakesRuleName = typeof HIGH_STAKES_RULES[number]['name']

export function classifyByRules(examName: string): { matched: true; rule: HighStakesRuleName } | { matched: false } {
  for (const rule of HIGH_STAKES_RULES) {
    if (rule.patterns.some(p => p.test(examName))) {
      return { matched: true, rule: rule.name }
    }
  }
  return { matched: false }
}
```

The AI fallback (Claude Haiku) is invoked only when no rule matches. AI confidence score is **informational for admin review only** — no confidence threshold bypasses admin review in v1. Safety first.

**2. No match → fail-safe default (never fail-open):**
If no rule matches, the exam defaults to `high` — never `low`. Simultaneously, Claude Haiku generates an AI-suggested classification + confidence score, which is placed in `classification_review_queue`. The exam remains `high` (fully gated) until an admin reviews it. It must never be silently treated as cleared while a review is pending.

**3. Admin override:**
Admins can reclassify any exam in either direction at any time. Every override writes a full record to `exam_stakes_audit`: who changed it, when, previous value, new value, and the AI suggestion + confidence if one exists. No reclassification is silent.

**4. Creator-declared stakes level:**
Collected at upload time as a contextual signal for admin review only. It has zero authority over `stakes_level` and is never used as the actual classifier.

### 4.4 Access Control Model

Two flags — always evaluated independently, never conflated:

| Flag | Values | Governs |
|------|--------|---------|
| `account_tier` | `free` \| `premium` | Platform feature richness |
| `stakes_level` | `low` \| `high` | Exam content access |

**Access check logic (pseudocode — implemented in `src/lib/access/check.ts`):**

```
canAccess(user, exam):
  // Deleted users have no access regardless of anything else
  if user.deleted_at IS NOT NULL:
    return false

  // Never grant access while classification is unresolved — fail-closed
  if exam.classification_source == 'pending_review':
    return false

  if exam.stakes_level == 'low':
    // Own private uploads always accessible to creator
    if exam.created_by == user.id: return true
    // Public community low-stakes exams are accessible to ALL authenticated users (free AND premium)
    // Premium subscription governs platform FEATURES, not low-stakes content access
    return exam.is_public == true

  if exam.stakes_level == 'high':
    return user_exam_purchases contains (user.id, exam.id)
    // account_tier is irrelevant for this branch — Premium does NOT unlock high-stakes content
```

> **Critical note:** The previous version of this pseudocode incorrectly gated low-stakes community exams behind `account_tier == 'premium'`. That was wrong. Free users CAN access low-stakes community exams — that is the product's free-tier value proposition. Premium subscription only affects platform features (Textract, Sonnet, unlimited uploads, semantic search).

**Community library access:**
- Low-stakes validated curricula: all users (free and premium)
- High-stakes validated curricula: visible to all, accessible only after per-exam purchase

### 4.5 Per-Exam Pricing

Each high-stakes exam has its own independently configured price — no universal price across exams. Prices are set per exam by platform admins (e.g., Bar Exam $49, USMLE Step 1 $79, CFA Level 1 $59). Price is stored on the exam record (`exams.price`) and charged via Stripe Checkout at purchase time. On successful payment, a record is written to `user_exam_purchases`; `account_tier` is never modified.

### 4.6 Premium Subscription Stripe Flow

This governs `account_tier` only — completely independent of per-exam purchases.

**Stripe objects involved:**
- A Stripe **Price** (monthly recurring) stored as `STRIPE_PREMIUM_PRICE_ID` env var
- A Stripe **Customer** per user, ID stored in `users.stripe_customer_id` (created lazily on first checkout, not at registration)
- A Stripe **Subscription** per premium user

**Upgrade flow:**
1. User clicks "Start Premium" on `/pricing` or upgrade CTA in `/settings`
2. `POST /api/billing/checkout` → creates (or retrieves existing) Stripe Customer, creates Stripe Checkout session (subscription mode), returns `{ url }` → redirect to Stripe-hosted page
3. User completes payment on Stripe
4. Stripe sends `checkout.session.completed` webhook to `/api/webhooks/stripe`
5. Webhook verifies signature, reads `customer` and `subscription` from event, sets `users.tier = 'premium'` for the matching `stripe_customer_id`

**Webhook events handled (`POST /api/webhooks/stripe`):**

| Event | Action |
|-------|--------|
| `checkout.session.completed` (mode: subscription) | Set `users.tier = 'premium'` |
| `checkout.session.completed` (mode: payment) | Insert `user_exam_purchases` record |
| `customer.subscription.updated` | Sync tier: `active`/`trialing` → `premium`, else → `free` |
| `customer.subscription.deleted` | Set `users.tier = 'free'` |
| `invoice.payment_failed` | Log to `usage_events`; begin 7-day grace period before downgrade |

**Stripe signature verification — required on every inbound POST:**
```typescript
// First line inside /api/webhooks/stripe POST handler — no exceptions
const sig = request.headers.get('stripe-signature')!
const body = await request.text()  // must be raw text, not parsed JSON
stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!)
```

**Downgrade flow (cancel or payment failure):**
- `customer.subscription.deleted` → immediately set `users.tier = 'free'`
- `invoice.payment_failed` → log event, retain `premium` for 7 days (grace period), then set `free` if still unpaid
- No pro-rated refunds in v1

**Subscription management:**
- `POST /api/billing/portal` → creates Stripe Billing Portal session, returns `{ url }` → redirect
- Portal handles: cancel, plan change, card update, invoice history
- CogniPrep never stores card numbers — entirely delegated to Stripe

**Redirect URLs:**
- Subscription upgrade success: `NEXT_PUBLIC_APP_URL/settings?subscribed=true`
- Subscription upgrade cancel: `NEXT_PUBLIC_APP_URL/pricing`
- Per-exam purchase success: `NEXT_PUBLIC_APP_URL/study/{examId}?purchased=true`
- Per-exam purchase cancel: `NEXT_PUBLIC_APP_URL/library`

---

### 4.7 Free Tier Usage Limits

Only one hard limit on the free tier — everything else stays unlimited to maximize engagement and reduce churn risk.

| Resource | Free Tier | Premium Tier |
|----------|-----------|--------------|
| Document uploads | 3 per rolling 30-day window | Unlimited |
| Study sessions | Unlimited | Unlimited |
| Socratic explanations | Unlimited | Unlimited |
| Questions generated per upload | 50 | Unlimited |
| Exam enrollments | Unlimited | Unlimited |

**Enforcement:** At `POST /api/upload/text` and `POST /api/upload/process`, count `usage_events` where `event_type IN ('upload_text', 'upload_pdf')` AND `user_id = ?` AND `created_at > NOW() - INTERVAL '30 days'`. If count ≥ 3 and `tier = 'free'` → return HTTP 402 with `{ error: 'upload_limit_reached', upgradeUrl: '/pricing' }`.

**Why only uploads are gated:** Gating study sessions or explanations would directly hurt the product's core value proposition and slow down the BKT/SM-2 data collection that makes the product smarter. Upload limits are a natural monetization boundary — premium users genuinely need more throughput.

---

### 4.8 Community Curriculum Publishing Workflow

Defines when a user-created exam becomes visible in the community library (`exams.is_public = true`).

**Auto-publish rule (no admin action required):**
When a classification job completes and `classification_source = 'rules_list'` AND `stakes_level = 'low'` → automatically set `is_public = true`. This is the happy path — a clearly low-stakes exam (e.g., "Basic Python Programming") gets instant community visibility.

**Manual publish (admin action required):**
Any exam that goes through `pending_review` (AI fallback path) stays `is_public = false` until an admin:
1. Reviews it in `/admin/review-queue`
2. Classifies it as low-stakes (admin override)
3. The `/api/admin/exams/[examId]/classify` handler **automatically sets `is_public = true`** when an admin overrides to `stakes_level = 'low'` — admins do not need a separate publish step
4. Admins can still separately toggle `is_public` via `/api/admin/exams/[examId]/publish` if they want to un-publish a low-stakes exam

**Creator cannot directly publish:** The `is_public` flag is never exposed in the creator's upload UI. Creators do not choose whether their content goes to the community — the classification pipeline and admin review determine it. This prevents gaming and maintains library quality.

**Un-publishing:** Admins can set `is_public = false` on any exam at any time via `/admin/exams`. No notification to the creator in v1.

---

## 5. Technical Architecture

### 5.1 Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| Frontend | Next.js 15 (App Router) on Vercel | Hackathon requirement |
| Database | Aurora PostgreSQL Serverless v2 | Scales to zero, pgvector support |
| Async jobs | AWS Lambda | Pay-per-invocation, no idle cost |
| Storage | AWS S3 + presigned URLs | Direct browser upload, no proxy |
| Auth | NextAuth.js v5 + PostgreSQL adapter | OSS, zero cost |
| Embeddings | AWS Bedrock Titan Embed Text v2 | Cheapest production embeddings |
| PDF (free) | pdf-parse npm package | OSS, runs in Lambda |
| PDF (premium) | AWS Textract | Handles scans and tables |
| DB Connectivity | Aurora public endpoint + `sslmode=require` | Vercel → VPC bypass (hackathon); replace with RDS Proxy in production |
| Connection Pool | `pg` Pool, max 5 per worker | Prevents Aurora connection exhaustion under serverless concurrency |

### 5.2 LLM Architecture

| Model | Use Cases | Approximate Cost |
|-------|-----------|---------|
| claude-haiku-4-5-20251001 | Question generation (free), Socratic explanations, real-time interactions | ~$0.015/50Q, ~$0.002/explanation |
| claude-sonnet-4-6 | Premium curriculum generation from exam name | ~$0.20/curriculum |

No Claude Opus (too expensive). No open-source LLMs (GPU EC2 more expensive than API at early scale).

### 5.3 Data Flow

```
User uploads PDF
  → Browser → S3 presigned URL (direct upload, no Next.js proxy)
  → Browser notifies /api/upload/process (passes S3 key + jobId)
  → /api/upload/process → Lambda InvokeCommand (async, Event invocation type)
       ↳ No S3 event trigger — direct invocation is simpler to debug
  → Lambda reads PDF bytes from S3
  → Lambda → Aurora: update document_jobs.status = 'processing'
  → Lambda → Aurora: store document_chunks (500-token chunks, 50-token overlap)
  → Lambda → Claude Haiku: generate questions per chunk
  → Lambda → Aurora: store questions, update document_jobs.status = 'complete'
  → Lambda → Bedrock Titan: generate embeddings (premium only)
  → Lambda → Aurora pgvector: store question_embeddings (premium only)
  → Frontend: poll /api/upload/status?jobId={id} every 3 seconds
       ↳ Reads document_jobs.status from DB — no in-memory state
       ↳ Returns 'failed' with failed_reason if Lambda timed out or errored
```

---

## 6. Seven Learning Subsystems

Each subsystem lives in `src/lib/engines/`. Each is a pure TypeScript module — no direct database calls inside engines. All DB reads/writes happen in the API routes that call them.

| Engine | File | Algorithm |
|--------|------|-----------|
| Cold Start | `cold-start.ts` | IRT 2PL + CAT binary search |
| Mastery Estimation | `bkt.ts` | Bayesian Knowledge Tracing |
| Study Scheduling | `sm2.ts` | Modified SM-2 spaced repetition |
| Next-Question Selector | `selector.ts` | Multi-criteria priority scoring |
| Readiness Prediction | `readiness.ts` | Weighted mastery aggregation + CI |
| Content Generation | `generator.ts` | Claude Haiku/Sonnet prompt pipelines |
| Assessment & Feedback | `socratic.ts` | 3-step Socratic prompt chain |

---

## 7. Database Schema

```sql
-- ============================================================
-- NextAuth.js v5 adapter tables (required — auth breaks without these)
-- ============================================================
CREATE TABLE users (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email              TEXT UNIQUE NOT NULL,
  name               TEXT,
  image              TEXT,
  password_hash      TEXT,          -- bcrypt cost-12 hash; NULL for OAuth-only users; NEVER store plaintext
  tier               TEXT DEFAULT 'free' CHECK (tier IN ('free', 'premium')),
  role               TEXT DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  stripe_customer_id TEXT UNIQUE,   -- created lazily on first Stripe interaction; NULL until first checkout
  deleted_at         TIMESTAMPTZ,   -- soft delete; NULL = active. Anonymize name/email 30 days after deletion.
  created_at         TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE accounts (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type                TEXT NOT NULL,
  provider            TEXT NOT NULL,
  provider_account_id TEXT NOT NULL,
  refresh_token       TEXT,
  access_token        TEXT,
  expires_at          INTEGER,
  token_type          TEXT,
  scope               TEXT,
  id_token            TEXT,
  session_state       TEXT,
  UNIQUE(provider, provider_account_id)
);

CREATE TABLE sessions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_token TEXT UNIQUE NOT NULL,
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires       TIMESTAMPTZ NOT NULL
);

CREATE TABLE verification_tokens (
  identifier TEXT NOT NULL,
  token      TEXT UNIQUE NOT NULL,
  expires    TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (identifier, token)
);

-- ============================================================
-- Exams and enrollment
-- ============================================================
CREATE TABLE exams (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  description TEXT,
  max_score   INTEGER DEFAULT 100,
  created_by  UUID REFERENCES users(id),
  is_public   BOOLEAN DEFAULT FALSE,
  domain      TEXT DEFAULT 'general'
              CHECK (domain IN ('medical', 'legal', 'finance', 'engineering', 'technology', 'language', 'academic', 'professional', 'general')),

  -- Stakes classification (content gate — orthogonal to account_tier)
  -- Default is 'high' (fail-safe). Never default to 'low'.
  stakes_level                 TEXT    NOT NULL DEFAULT 'high'
                               CHECK (stakes_level IN ('low', 'high')),
  price                        NUMERIC(10,2),  -- only set when stakes_level = 'high'; NULL for low-stakes
  creator_declared_stakes      TEXT    CHECK (creator_declared_stakes IN ('low', 'high')),  -- signal only, zero authority
  classification_source        TEXT    NOT NULL DEFAULT 'pending_review'
                               CHECK (classification_source IN ('rules_list', 'pending_review', 'admin_override')),
  classification_matched_rule  TEXT,   -- rule name that matched, when source = 'rules_list'
  classification_ai_suggestion TEXT,   -- Claude's suggestion, when source = 'pending_review'
  classification_ai_confidence NUMERIC(4,3),  -- 0.000–1.000, populated alongside ai_suggestion

  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Tracks which exams a user is enrolled in and which is active
CREATE TABLE user_exams (
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  exam_id     UUID NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  is_active   BOOLEAN DEFAULT TRUE,
  enrolled_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, exam_id)
);

-- Topics within exams (supports prerequisite graph via parent_topic_id)
CREATE TABLE exam_topics (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id         UUID REFERENCES exams(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  weight          NUMERIC(4,3) DEFAULT 0.1,
  parent_topic_id UUID REFERENCES exam_topics(id) ON DELETE SET NULL  -- orphan children rather than cascade-delete them
);

-- ============================================================
-- Questions
-- options JSONB contract: { "choices": [string, string, string, string] }
-- correct_index is 0–3, referencing choices[n]
-- explanation is cached on first Socratic generation to avoid repeat LLM calls
-- ============================================================
CREATE TABLE questions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id        UUID REFERENCES exams(id),
  topic_id       UUID REFERENCES exam_topics(id),
  content        TEXT NOT NULL,
  options        JSONB NOT NULL,   -- { "choices": ["A ...", "B ...", "C ...", "D ..."] }
  correct_index  INTEGER NOT NULL CHECK (correct_index BETWEEN 0 AND 3),
  explanation    TEXT,
  difficulty     NUMERIC(3,2) DEFAULT 0.5 CHECK (difficulty BETWEEN 0 AND 1),
  discrimination NUMERIC(3,2) DEFAULT 1.0,
  source         TEXT DEFAULT 'ai_generated'
);

-- ============================================================
-- Document processing pipeline
-- ============================================================

-- Raw text chunks produced by Lambda (text → chunks → questions)
CREATE TABLE document_chunks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id     UUID NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  content     TEXT NOT NULL,
  chunk_index INTEGER NOT NULL,
  source_file TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Async job status for Lambda PDF processing (polled by /api/upload/status)
CREATE TABLE document_jobs (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES users(id),
  exam_id             UUID NOT NULL REFERENCES exams(id),
  status              TEXT DEFAULT 'pending'
                      CHECK (status IN ('pending', 'processing', 'complete', 'failed')),
  source_type         TEXT CHECK (source_type IN ('pdf', 'text')),
  s3_key              TEXT,
  failed_reason       TEXT,
  questions_generated INTEGER DEFAULT 0,
  started_at          TIMESTAMPTZ DEFAULT NOW(),
  finished_at         TIMESTAMPTZ
);

-- ============================================================
-- Learning state
-- ============================================================

-- Per-user BKT mastery state per topic
CREATE TABLE user_topic_mastery (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID REFERENCES users(id),
  topic_id            UUID REFERENCES exam_topics(id),
  mastery_probability NUMERIC(4,3) DEFAULT 0.3,
  attempts            INTEGER DEFAULT 0,
  correct_count       INTEGER DEFAULT 0,
  last_updated        TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, topic_id)
);

-- Per-question SM-2 spaced repetition schedule
CREATE TABLE user_question_schedule (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID REFERENCES users(id),
  question_id      UUID REFERENCES questions(id),
  next_review_date TIMESTAMPTZ DEFAULT NOW(),
  interval_days    INTEGER DEFAULT 1,
  ease_factor      NUMERIC(4,2) DEFAULT 2.5,
  repetitions      INTEGER DEFAULT 0,
  UNIQUE(user_id, question_id)
);

-- Study sessions (created by POST /api/study/start, drives /study/[sessionId] URL)
CREATE TABLE study_sessions (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID REFERENCES users(id),
  exam_id            UUID REFERENCES exams(id),
  session_type       TEXT CHECK (session_type IN ('diagnostic', 'study', 'mock_exam')),  -- 'mock_exam' is v2 scope; never set by v1 application code
  started_at         TIMESTAMPTZ DEFAULT NOW(),
  ended_at           TIMESTAMPTZ,
  questions_answered INTEGER DEFAULT 0,
  correct_count      INTEGER DEFAULT 0
);

-- Individual answer events
CREATE TABLE answer_events (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id     UUID REFERENCES study_sessions(id),
  question_id    UUID REFERENCES questions(id),
  user_id        UUID REFERENCES users(id),
  selected_index INTEGER NOT NULL,
  is_correct     BOOLEAN NOT NULL,
  time_spent_ms  INTEGER,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- Billing / usage metering
-- ============================================================
CREATE TABLE usage_events (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID REFERENCES users(id),
  event_type    TEXT NOT NULL,
  model         TEXT,
  input_tokens  INTEGER,
  output_tokens INTEGER,
  cost_usd      NUMERIC(10,6),
  tier          TEXT CHECK (tier IN ('free', 'premium')),
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- Vector embeddings (premium tier only)
-- ============================================================
CREATE EXTENSION IF NOT EXISTS vector;
CREATE TABLE question_embeddings (
  question_id UUID REFERENCES questions(id) PRIMARY KEY,
  embedding   vector(1536)
);

-- ============================================================
-- Access control: per-exam purchases (high-stakes content)
-- Premium does NOT grant access to high-stakes exams.
-- account_tier and user_exam_purchases are fully independent.
-- ============================================================
CREATE TABLE user_exam_purchases (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                  UUID NOT NULL REFERENCES users(id),
  exam_id                  UUID NOT NULL REFERENCES exams(id),
  amount_paid_usd          NUMERIC(10,2) NOT NULL,
  stripe_payment_intent_id TEXT UNIQUE NOT NULL,
  purchased_at             TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, exam_id)
);

-- ============================================================
-- Stakes classification: admin override audit trail
-- Every classification change is written here — no silent reclassification.
-- ============================================================
CREATE TABLE exam_stakes_audit (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id               UUID NOT NULL REFERENCES exams(id),
  changed_by            UUID REFERENCES users(id),   -- NULL if system action
  previous_stakes_level TEXT NOT NULL CHECK (previous_stakes_level IN ('low', 'high')),
  new_stakes_level      TEXT NOT NULL CHECK (new_stakes_level IN ('low', 'high')),
  previous_source       TEXT NOT NULL,
  ai_suggestion         TEXT CHECK (ai_suggestion IN ('low', 'high')),
  ai_confidence         NUMERIC(4,3),
  note                  TEXT,   -- admin's optional justification
  changed_at            TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- Stakes classification: admin review queue
-- Populated when no rules-list match is found (fallback path).
-- Exam stays stakes_level = 'high' until reviewed_at is set.
-- ============================================================
CREATE TABLE classification_review_queue (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id          UUID NOT NULL REFERENCES exams(id) UNIQUE,
  ai_suggestion    TEXT NOT NULL CHECK (ai_suggestion IN ('low', 'high')),
  ai_confidence    NUMERIC(4,3) NOT NULL,
  ai_reasoning     TEXT,    -- Claude's explanation for its suggestion
  creator_declared TEXT CHECK (creator_declared IN ('low', 'high')),  -- for admin context only
  queued_at        TIMESTAMPTZ DEFAULT NOW(),
  reviewed_at      TIMESTAMPTZ,    -- NULL until admin acts
  reviewed_by      UUID REFERENCES users(id)
);

-- ============================================================
-- Indexes
-- ============================================================
CREATE INDEX idx_user_topic_mastery_user      ON user_topic_mastery(user_id);
CREATE INDEX idx_user_topic_mastery_topic     ON user_topic_mastery(topic_id);
CREATE INDEX idx_user_question_schedule_user  ON user_question_schedule(user_id, next_review_date);
CREATE INDEX idx_questions_topic_difficulty   ON questions(topic_id, difficulty);
CREATE INDEX idx_questions_exam               ON questions(exam_id);
CREATE INDEX idx_answer_events_session        ON answer_events(session_id);
CREATE INDEX idx_answer_events_user           ON answer_events(user_id);
CREATE INDEX idx_usage_events_user_date       ON usage_events(user_id, created_at);
CREATE INDEX idx_document_jobs_user_status    ON document_jobs(user_id, status);
CREATE INDEX idx_study_sessions_user_exam     ON study_sessions(user_id, exam_id);
CREATE INDEX idx_user_exams_user                   ON user_exams(user_id);
CREATE INDEX idx_exams_stakes_level                ON exams(stakes_level);
CREATE INDEX idx_exams_classification_source       ON exams(classification_source);
CREATE INDEX idx_user_exam_purchases_user          ON user_exam_purchases(user_id);
CREATE INDEX idx_user_exam_purchases_exam          ON user_exam_purchases(exam_id);
CREATE INDEX idx_exam_stakes_audit_exam            ON exam_stakes_audit(exam_id, changed_at);
CREATE INDEX idx_review_queue_unreviewed           ON classification_review_queue(queued_at) WHERE reviewed_at IS NULL;
CREATE INDEX idx_exams_domain                      ON exams(domain);
CREATE INDEX idx_exams_is_public                   ON exams(is_public) WHERE is_public = TRUE;
CREATE INDEX idx_users_deleted_at                  ON users(deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX idx_user_exams_composite              ON user_exams(user_id, exam_id, is_active);  -- covers dashboard "My Exams" query
CREATE INDEX idx_questions_options_gin             ON questions USING gin(options);             -- fast JSONB lookup

-- Uniqueness constraint: at most one active (incomplete) diagnostic per user+exam pair.
-- An active diagnostic is one with session_type = 'diagnostic' AND ended_at IS NULL.
-- This prevents duplicate diagnostics from corrupting the mastery table.
CREATE UNIQUE INDEX idx_one_active_diagnostic_per_user_exam
  ON study_sessions(user_id, exam_id)
  WHERE session_type = 'diagnostic' AND ended_at IS NULL;

-- Vector similarity index (HNSW — required for sub-second semantic search; premium tier only)
-- Without this index, every vector search does a full O(n) table scan.
-- Add BEFORE loading any embeddings. m=16 and ef_construction=64 are the recommended
-- production defaults for recall/speed balance at this scale.
CREATE INDEX idx_question_embeddings_hnsw ON question_embeddings
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);
```

---

## 8. UI/UX Design System

### 8.1 Visual Direction

**A+D+C Hybrid:**
- **A (Focused & Minimal):** Structural discipline, whitespace, typography-first hierarchy
- **D (Warm & Coach-Like):** Color temperature, encouraging microcopy, personal coaching tone
- **C (Dark Dashboard / Data-Rich):** Analytics mode surfaces, vivid data visualization

Two distinct visual modes that shift naturally:
- **Study mode (light):** Warm cream surfaces, indigo primary, amber accents
- **Analytics mode (dark):** Deep navy surfaces, electric violet, amber carries over

### 8.2 Color Tokens

```css
/* Light mode (study sessions) */
--color-bg: #F9F7F4;
--color-surface: #FFFFFF;
--color-primary: #4F46E5;
--color-accent: #F59E0B;
--color-text: #1A1A2E;
--color-text-muted: #6B7280;
--color-weak: #FF6B6B;
--color-mastered: #10B981;
--color-border: #E5E3E0;

/* Dark mode (analytics) */
--color-bg-dark: #0D1117;
--color-surface-dark: #161B22;
--color-primary-dark: #6366F1;
--color-accent-dark: #F59E0B;
--color-text-dark: #E8E6E3;
```

### 8.3 Typography

- **DM Serif Display:** Large display numbers, section headers, Socratic tutor voice, dashboard greeting
- **Inter:** All UI text — labels, body, answer choices, navigation, buttons
- No third typeface

### 8.4 Motion

| Element | Duration | Easing |
|---------|----------|--------|
| Socratic panel slide-up | 300ms | ease-out-expo |
| Question transitions | 200ms | ease-in-out (fade only) |
| Readiness score counter | 800ms | ease-out |
| Heat map cell fill | 40ms stagger per cell | ease-in |
| Page transitions | 150ms | ease-in-out |

### 8.5 Key Screen Layouts

**Dashboard (Home):**
- 60px top nav: DM Serif logo left, exam dropdown + avatar right
- Personal greeting in DM Serif Display
- Left 65%: Dark navy Readiness Score island (amber score, CI, progress ring) + Topic Mastery Heat Map
- Right 35%: 3 action tiles (Continue Studying/indigo, Review Weak Areas/amber, Take Mock Exam/outline) + review queue + streak

**Diagnostic (Cold Start):**
- Centered layout, no sidebar
- Amber banner, single question card, "Step N of 15"
- Completion screen → dashboard

**Study Session (Option C):**
- 4px progress bar, topic label, question count
- Elevated white question card, 4 answer choices
- Post-answer: slide-up dark navy Socratic panel (300ms)
- DM Serif first line, Inter body, amber mastery badge, dismiss CTA

**Analytics / Progress:**
- Full page dark mode transition
- Hero readiness score + CI, mastery heat map, weak area cards, charts

**Document Upload:**
- Tabs: "Paste Text" | "Upload PDF"
- Textarea or drag-and-drop zone
- "Generate Questions" CTA

**Onboarding (`/onboarding`):**
- Centered, no sidebar, no nav
- Indigo "CogniPrep" wordmark top-left, no other chrome
- Warm headline (DM Serif Display): "Let's set up your study plan"
- Full-width search bar with placeholder: "Search for your exam (e.g. IELTS, CFA, Bar Exam...)"
- Results below: exam name, stakes badge chip, question count, "Select →"
- Empty state: two side-by-side action cards — "Upload Materials" (available to all) / "AI Curriculum" (Premium badge, greyed for free users)
- Skip link at bottom

**Library (`/library`):**
- Standard nav with active "Library" tab
- Tab row: "My Exams" | "Community"
- My Exams: cards with readiness score chip, heat map thumbnail, "Continue →" CTA
- Community: grid of exam cards, stakes badge, question count, enrolled count, lock icon overlay on inaccessible high-stakes
- Search/filter bar: exam domain categories (Medical, Legal, Finance, Engineering, General)

**Pricing (`/pricing`):**
- Public page, light mode always
- Two-column card layout (Free | Premium), premium card slightly elevated with amber border
- Feature checklist per column
- Premium CTA: "Start Premium — $X/month" (indigo filled button)
- FAQ accordion below
- Footer: "High-stakes exam access is a separate per-exam purchase, independent of tier"

**Settings (`/settings`):**
- Standard nav
- Vertical sections with section headings
- Subscription section: tier badge (amber for premium, grey for free), upgrade/manage CTA
- Purchase history: table with exam name, amount, date
- Danger zone: muted red "Delete Account" link (requires confirmation modal)

**Admin (`/admin`):**
- Dark sidebar: "Review Queue" | "Audit Log" | "Exams"
- Review queue: data table, oldest items first, two action buttons per row
- AI reasoning shown in expandable drawer per row (not inline — too verbose)
- Stats bar at top: "7 pending review" / "12 classified this week"

### 8.6 Device Target

Desktop-first. Mobile responsive as secondary.

---

## 9. API Routes

| Route | Method | Auth | Purpose |
|-------|--------|------|---------|
| `/api/auth/[...nextauth]` | ANY | — | NextAuth.js handler |
| `/api/diagnostic/start` | POST | required | Start adaptive diagnostic session |
| `/api/diagnostic/answer` | POST | required | Submit answer, get next question |
| `/api/diagnostic/complete` | POST | required | End diagnostic, seed mastery table |
| `/api/study/start` | POST | required | Create study session record, return `sessionId` for `/study/[sessionId]` URL |
| `/api/study/next-question` | GET | required | Get next question via selector engine |
| `/api/study/answer` | POST | required | Submit answer, run BKT + SM-2, return Socratic |
| `/api/upload/presigned-url` | POST | required | Get S3 presigned URL for PDF upload |
| `/api/upload/process` | POST | required | Trigger Lambda PDF processing job |
| `/api/upload/text` | POST | required | Process pasted text, generate questions |
| `/api/upload/status` | GET | required | Poll Lambda job completion |
| `/api/progress/readiness` | GET | required | Get readiness score + CI |
| `/api/progress/mastery` | GET | required | Get topic mastery heat map data |
| `/api/exams` | GET/POST | required | List/create exams |
| `/api/exams/[examId]/enroll` | POST | required | Enroll user in an exam (writes to `user_exams`) |
| `/api/exams/[examId]/access` | GET | required | Check if user can access exam; returns `{ canAccess, reason }` — always call before loading study session |
| `/api/exams/[examId]/purchase` | POST | required | Initiate Stripe Checkout for per-exam high-stakes purchase; tier is irrelevant |
| `/api/admin/review-queue` | GET | admin | List exams pending stakes classification review, ordered by `queued_at` |
| `/api/admin/exams/[examId]/classify` | POST | admin | Override stakes classification; writes to `exam_stakes_audit` |
| `/api/admin/exams/[examId]/publish` | POST | admin | Toggle `exams.is_public`; no classification change |
| `/api/billing/checkout` | POST | required | Create Stripe Checkout session for Premium subscription upgrade |
| `/api/billing/portal` | POST | required | Create Stripe Billing Portal session (cancel, update card) |
| `/api/webhooks/stripe` | POST | public (sig-verified) | Handle all Stripe events: subscription lifecycle + per-exam purchase completion |
| `/api/onboarding/search` | GET | required | Full-text search against public exams for onboarding exam-selection step |
| `/api/exams/[examId]/topics` | GET | required | List topics for an exam (used by diagnostic start to identify topics for IRT CAT) |
| `/api/health` | GET | public | DB ping for Aurora warm-up cron |

---

## 10. Environment Variables

```env
# ── Database ─────────────────────────────────────────────────────────────
DATABASE_URL=postgresql://USER:PASS@HOST:5432/cogniprep?sslmode=require

# ── Auth ─────────────────────────────────────────────────────────────────
NEXTAUTH_SECRET=          # generate: openssl rand -base64 32
NEXTAUTH_URL=http://localhost:3000

# ── Anthropic ────────────────────────────────────────────────────────────
ANTHROPIC_API_KEY=

# ── AWS (used by Next.js API routes) ─────────────────────────────────────
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_S3_BUCKET_NAME=cogniprep-uploads
AWS_LAMBDA_FUNCTION_NAME=cogniprep-processor
AWS_BEDROCK_REGION=us-east-1  # Bedrock must be us-east-1 for Titan Embed v2

# ── Auth providers ───────────────────────────────────────────────────────
GOOGLE_CLIENT_ID=        # Google OAuth — primary provider for B2C login
GOOGLE_CLIENT_SECRET=

# ── Stripe ───────────────────────────────────────────────────────────────
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=          # for verifying /api/webhooks/stripe POST signature
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
STRIPE_PREMIUM_PRICE_ID=        # Stripe Price ID for the monthly Premium subscription

# ── App URL (used for Stripe redirect URLs — do not use NEXTAUTH_URL for this) ──
NEXT_PUBLIC_APP_URL=http://localhost:3000   # production: https://your-project.vercel.app

# ── Aurora PostgreSQL (used by migration / seed scripts) ──────────────────
AURORA_HOST=
AURORA_PORT=5432
AURORA_DB=cogniprep
AURORA_USER=
AURORA_PASSWORD=
AURORA_MIN_CAPACITY=0.5   # prevents full scale-to-zero; avoids cold start during demo
```

---

## 11. Implementation Sequence

Build in this order — each phase is independently demoable:

1. **Setup:** Next.js 15 project, Aurora PostgreSQL, schema migration (`pnpm db:migrate`), seed demo data (`pnpm db:seed`), NextAuth.js (Google OAuth + email/password), layout shell + design tokens, `requireAuth` + `requireAdmin` guards
2. **Onboarding:** `/onboarding` exam search page, `/api/onboarding/search`, exam enrollment flow → redirects to diagnostic
3. **Cold Start Diagnostic:** IRT engine, `/api/exams/[examId]/topics`, diagnostic API routes + UI, mastery table seeding, completion screen → dashboard
4. **Document Upload:** Textarea + PDF upload (S3 + Lambda + pdf-parse), question generation, Lambda source (`lambda/` dir), community auto-publish rule
5. **Adaptive Study Session:** BKT + SM-2 + selector engines, study API routes, question UI, Socratic slide-up panel
6. **Readiness Dashboard + Progress:** Prediction engine, mastery heat map, analytics dark mode page
7. **Monetization:** Stripe subscription checkout + webhook handler + Billing Portal + per-exam purchase, `/pricing` page, `/settings` page, free tier upload limit enforcement
8. **Library & Admin:** `/library` community browsing, `/admin` review queue + audit log, community auto-publish trigger
9. **Polish:** Rate limiting middleware, error states, loading states, Aurora cold-start UX, responsive layout

---

## 12. Hackathon Demo Script

**Flow (5-7 minutes):**
1. Register as new user → select "IELTS General Training"
2. Cold start diagnostic — adaptive questions, warm tone
3. Diagnostic completion → dashboard populates
4. Dashboard: readiness score island, heat map, action tiles
5. "Continue Studying" → study session with Socratic slide-up after wrong answer
6. Navigate to Progress → dark mode transition, full analytics view
7. Document upload — paste text → questions generated live

**Key talking points:** Any exam, cold start solved in 15 questions, real algorithms not just prompting, monetization built in from day one.

---

## 13. TypeScript Data Contracts

All shared types live in `src/types/index.ts`. These are the contracts between engines, API routes, and components.

```typescript
// Question options — JSONB column shape enforced at insert time via Zod
export type QuestionOptions = {
  choices: [string, string, string, string]  // exactly 4 elements, index 0–3
}

// IRT ability state (maintained in memory during a diagnostic session)
export type AbilityEstimate = {
  theta: number   // ability estimate; starts at 0.0
  se: number      // standard error; CAT stops when se < 0.3
}

// A question as seen by the IRT / CAT engine
export type IRTQuestion = {
  id: string
  difficulty: number      // b parameter (0–1)
  discrimination: number  // a parameter (default 1.0)
}

// BKT parameters — one set per topic
export type BKTParams = {
  pPrior: number   // P(L0): initial mastery probability = 0.3
  pLearn: number   // P(T):  learning probability per attempt = 0.1
  pSlip:  number   // P(S):  slip probability despite knowing = 0.1
  pGuess: number   // P(G):  guess probability without knowing = 0.2
}

// Mastery display labels (maps mastery_probability to human-readable text)
export type MasteryLabel = 'Building' | 'Almost There' | 'Solid' | 'Mastered'

export function masteryToLabel(p: number): MasteryLabel {
  if (p < 0.40) return 'Building'
  if (p < 0.65) return 'Almost There'
  if (p < 0.85) return 'Solid'
  return 'Mastered'
}

// Lambda job status (mirrors document_jobs.status column)
export type DocumentJobStatus = 'pending' | 'processing' | 'complete' | 'failed'

// Session user shape (extends NextAuth session.user)
// NOTE: tier governs platform features only — it does not determine exam content access.
// High-stakes exam access is determined by user_exam_purchases, independently of tier.
export type UserRole = 'user' | 'admin'

export type SessionUser = {
  id: string
  email: string
  tier: 'free' | 'premium'
  role: UserRole
}

// Stripe subscription status values (subset of what Stripe returns)
export type SubscriptionStatus =
  | 'active'
  | 'trialing'
  | 'past_due'
  | 'canceled'
  | 'unpaid'

// All valid usage_events.event_type values — every LLM call and upload must use one of these
export type UsageEventType =
  | 'upload_text'               // free/premium: pasted-text upload processed
  | 'upload_pdf_free'           // free: pdf-parse Lambda processing
  | 'upload_pdf_premium'        // premium: AWS Textract Lambda processing
  | 'generate_questions'        // Claude Haiku question generation (any tier)
  | 'generate_curriculum'       // Claude Sonnet curriculum-from-name (premium only)
  | 'socratic_explanation'      // Claude Haiku Socratic panel explanation
  | 'classify_exam'             // Claude Haiku AI stakes classification suggestion
  | 'generate_embedding'        // Bedrock Titan embedding (premium only)

// Exam domain — must match exams.domain CHECK constraint
export type ExamDomain =
  | 'medical'
  | 'legal'
  | 'finance'
  | 'engineering'
  | 'technology'
  | 'language'
  | 'academic'
  | 'professional'
  | 'general'

// Stakes classification
export type StakesLevel = 'low' | 'high'
export type ClassificationSource = 'rules_list' | 'pending_review' | 'admin_override'

// Result of /api/exams/[examId]/access — always call this before loading a study session
export type ExamAccessResult =
  | { canAccess: true;  reason: 'low_stakes_own_exam' | 'low_stakes_tier_ok' | 'high_stakes_purchased' }
  | { canAccess: false; reason: 'low_stakes_tier_blocked' | 'high_stakes_not_purchased' | 'pending_classification' }

// Exam surface shape (price only present when stakes_level = 'high')
export type ExamSummary = {
  id: string
  name: string
  stakesLevel: StakesLevel
  price: number | null
  classificationSource: ClassificationSource
}
```

---

## 14. API Auth Pattern

Every protected API route uses a shared guard. No route checks the session manually.

```typescript
// src/lib/api/auth-guard.ts
import { auth } from '@/auth'
import { NextResponse } from 'next/server'
import type { SessionUser } from '@/types'

export async function requireAuth(): Promise<
  | { user: SessionUser; error: null }
  | { user: null; error: NextResponse }
> {
  const session = await auth()
  if (!session?.user?.id) {
    return { user: null, error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }
  return {
    user: session.user as SessionUser,
    error: null,
  }
}
```

Usage in every protected route — first line, no exceptions:

```typescript
export async function POST(request: NextRequest) {
  const { user, error } = await requireAuth()
  if (error) return error
  // user.id, user.tier, user.role are guaranteed below this line
}
```

Admin routes use a second guard that calls `requireAuth` internally:

```typescript
// src/lib/api/auth-guard.ts (continued)
export async function requireAdmin(): Promise<
  | { user: SessionUser; error: null }
  | { user: null; error: NextResponse }
> {
  const result = await requireAuth()
  if (result.error) return result
  if (result.user.role !== 'admin') {
    return { user: null, error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }
  return result
}
```

Usage in every admin route — first line, no exceptions:

```typescript
export async function GET(request: NextRequest) {
  const { user, error } = await requireAdmin()
  if (error) return error
  // user.role === 'admin' guaranteed below this line
}
```

---

## 15. Infrastructure & Connectivity

### Vercel → Aurora PostgreSQL

Aurora lives inside an AWS VPC. Vercel is on the public internet with no static IP. The hackathon solution:

1. Enable **Public access** on the Aurora cluster
2. Security group inbound: TCP 5432 from `0.0.0.0/0`
3. Enforce TLS via `?sslmode=require` in `DATABASE_URL`
4. Cap pg pool at 5 connections per worker (Aurora Serverless v2 has a 90-connection limit on 0.5 ACU)

Production upgrade path: RDS Proxy with IAM authentication removes the public endpoint requirement entirely.

### Connection Pool (singleton per worker)

```typescript
// src/lib/db/pool.ts
import { Pool } from 'pg'

let pool: Pool | null = null

export function getPool(): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      max: 5,
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 5_000,
    })
  }
  return pool
}
```

### Aurora Warm-Up

`MinCapacity = 0.5` prevents full pause. A Vercel Cron (`*/10 * * * *`) pings `/api/health` every 10 minutes to keep the connection pool alive before and during the demo.

### Lambda Connectivity

Lambda invoked via `InvokeCommand` (no VPC config on the function). It connects to Aurora via the public endpoint exactly like Vercel does. This avoids NAT Gateway cost while keeping the architecture simple.

### Manual Infrastructure Setup

All AWS provisioning steps (Aurora, S3, Lambda, Bedrock, IAM) with exact CLI commands and console steps are documented in [`docs/manual-setup.md`](manual-setup.md).

---

## 16. Lambda Source Structure

The Lambda processor lives in a `lambda/` directory at the repo root — completely separate from the Next.js app. It has its own `package.json` and build pipeline. No source imports are shared between `lambda/` and `src/`.

```
lambda/
├── package.json         # separate dependencies (pdf-parse, @aws-sdk/client-s3, @anthropic-ai/sdk, pg)
├── esbuild.config.mjs   # bundles everything into dist/lambda.js, then zips to dist/lambda.zip
├── src/
│   ├── index.ts         # Lambda handler entry point — exports { handler }
│   ├── processor.ts     # Orchestrates: fetch PDF → chunk → generate questions → store
│   ├── chunker.ts       # 500-token chunking with 50-token overlap
│   ├── pdf.ts           # pdf-parse wrapper (free) + Textract client (premium)
│   └── db.ts            # Minimal pg client for Lambda (no pool — Lambda is single-invocation)
└── dist/                # gitignored — output of pnpm lambda:build
    ├── lambda.js
    └── lambda.zip
```

**Root `package.json` scripts:**
```json
{
  "scripts": {
    "lambda:build": "cd lambda && pnpm install && node esbuild.config.mjs",
    "lambda:deploy": "pnpm lambda:build && aws lambda update-function-code --function-name cogniprep-processor --zip-file fileb://lambda/dist/lambda.zip --region us-east-1"
  }
}
```

**Handler contract (`lambda/src/index.ts`):**
```typescript
export const handler = async (event: LambdaEvent): Promise<LambdaResult> => {
  if (event.type === 'health_check') return { status: 'ok' }
  if (event.type === 'process_document') return processorHandler(event)
  throw new Error(`Unknown event type: ${event.type}`)
}

type LambdaEvent =
  | { type: 'health_check' }
  | { type: 'process_document'; jobId: string; examId: string; userId: string; s3Key?: string; sourceType: 'pdf' | 'text'; isPremium: boolean }

type LambdaResult = { status: 'ok' } | { status: 'complete'; questionsGenerated: number } | { status: 'failed'; reason: string }
```

Lambda has its own `db.ts` that creates a single pg `Client` (not a `Pool`) — Lambda is single-invocation, connection pools waste resources in this context.

---

## 17. Authentication Configuration

**Provider decision:** Google OAuth (primary) + Email/Password credentials (fallback).

Google OAuth covers 95%+ of B2C users, eliminates email verification + password reset complexity, and dramatically lowers registration friction. Email/password is retained as a fallback for users without Google accounts.

No magic links in v1 — they require an email delivery service (Resend/SES) that adds infrastructure cost and operational complexity without meaningful conversion benefit over Google OAuth.

**NextAuth v5 config skeleton (`src/auth.ts`):**
```typescript
import NextAuth from 'next-auth'
import Google from 'next-auth/providers/google'
import Credentials from 'next-auth/providers/credentials'
import { PostgresAdapter } from '@auth/pg-adapter'
import { getPool } from '@/lib/db/pool'

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: PostgresAdapter(getPool()),
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    Credentials({
      credentials: { email: {}, password: {} },
      authorize: async (credentials) => {
        // validate email + bcrypt password check against users table
        // return user object or null
      },
    }),
  ],
  callbacks: {
    session({ session, user }) {
      // Block soft-deleted users — their sessions remain in the DB until TTL expires
      // but we deny access here so they can't use the app after deletion
      if ((user as any).deleted_at) {
        throw new Error('Account deleted')   // NextAuth treats this as an auth failure
      }
      session.user.id   = user.id
      session.user.tier = (user as any).tier ?? 'free'
      session.user.role = (user as any).role ?? 'user'
      return session
    },
  },
  pages: {
    signIn: '/login',
    newUser: '/onboarding',   // redirect after first OAuth sign-in
  },
})
```

The `newUser` page redirect (`/onboarding`) handles the post-registration exam selection step automatically for OAuth users. Credentials users are redirected to `/onboarding` explicitly after account creation.

---

## 18. Rate Limiting

CLAUDE.md requires rate limiting on all endpoints. Implementation uses Vercel Edge middleware with an in-memory sliding window for v1 (sufficient at early scale; upgrade to Upstash Redis when concurrent users exceed ~50).

**Limits by endpoint category:**

| Category | Endpoints | Limit | Window |
|----------|-----------|-------|--------|
| Auth | `/api/auth/*` | 10 req | 1 min per IP |
| Upload | `/api/upload/*` | 5 req | 1 min per user |
| LLM-backed | `/api/study/answer`, `/api/diagnostic/answer` | 60 req | 1 min per user |
| Admin | `/api/admin/*` | 30 req | 1 min per user |
| Stripe webhook | `/api/webhooks/stripe` | 100 req | 1 min per IP (Stripe's servers; no user session) |
| General API | All other `/api/*` | 120 req | 1 min per user |
| Public | `/api/health`, `/api/onboarding/search` | unlimited | — |

**Middleware location:** `src/middleware.ts` — runs at Vercel Edge before any API handler.

**Rate limit exceeded response:**
```json
HTTP 429 Too Many Requests
{ "error": "rate_limit_exceeded", "retryAfter": 60 }
```

**Upstash Redis upgrade path:** When traffic grows, swap the in-memory counter for `@upstash/ratelimit` with a sliding window algorithm. The middleware interface stays the same — only the counter backend changes.

---

## 19. Error Handling & Resilience

Concrete handling for each known failure mode — not vague "error states."

| Failure | Detection | User-facing response | Recovery |
|---------|-----------|---------------------|----------|
| Aurora cold start (first request, 5-10s) | Connection timeout > 3s | Loading spinner with "Setting things up..." — no error, just patience | Cron keeps Aurora warm; this only happens if cron gap occurs |
| Lambda timeout (PDF too large, > 300s) | `document_jobs.status = 'failed'` with `failed_reason` | "Processing took too long. Try a smaller file or paste text instead." + link to textarea input | User retries with smaller file or text input |
| Anthropic API down or rate-limited | HTTP 529 or 5xx from Anthropic | "Question generation is temporarily unavailable. Your upload is saved — we'll process it shortly." | Queue is not retried automatically in v1; user can re-trigger via UI |
| Stripe webhook fails (delivery failure) | Stripe retries up to 3 days | No user-facing impact — Stripe manages retry schedule | Ensure idempotent webhook handler (check if tier already set before updating) |
| Vector search returns 0 results | Empty embedding results | Fall back to full-text search silently; no user-visible degradation | Log `usage_events` event for monitoring |
| Invalid Stripe webhook signature | `stripe.webhooks.constructEvent` throws | HTTP 400 — log and discard | Never process unsigned webhooks |

**Idempotency requirement on webhook handler:** The Stripe webhook for `checkout.session.completed` may fire more than once. Always check if `user_exam_purchases` already has a record with `stripe_payment_intent_id` before inserting. For subscription events, check current `tier` before updating — avoid redundant writes.

---

## 20. Database Migration Approach

**Tool:** Custom numbered SQL migrations using `pg` directly — no ORM migration library in v1.

**Directory layout:**
```
migrations/
├── 0001_initial_schema.sql
├── 0002_add_pgvector.sql
├── 0003_add_hnsw_index.sql
└── ...
scripts/
└── migrate.ts          # node-ts runner that applies pending migrations
```

**Tracking table (created automatically on first run):**
```sql
CREATE TABLE IF NOT EXISTS schema_migrations (
  version    TEXT PRIMARY KEY,              -- e.g. '0001_initial_schema'
  applied_at TIMESTAMPTZ DEFAULT NOW()
);
```

**`scripts/migrate.ts` behaviour:**
1. Reads all `.sql` files in `migrations/` sorted lexicographically.
2. Queries `schema_migrations` for already-applied versions.
3. Runs only unapplied migrations, in order, each in a single transaction (`BEGIN` / `COMMIT`).
4. Inserts the version into `schema_migrations` on success.
5. Exits with code 1 on any error — never skips a failed migration.

**npm script (`package.json`):**
```json
"scripts": {
  "db:migrate": "tsx scripts/migrate.ts",
  "db:seed":    "tsx scripts/seed.ts"
}
```

**Rule:** Never run raw SQL against production databases by hand. All schema changes go through a numbered migration file.

---

## 21. Learning Engine Implementation Details

### 21.1 IRT Difficulty Calibration for AI-Generated Questions

When Claude Haiku generates questions, it does not produce psychometric parameters. Use these defaults and calibrate post-hoc:

| Parameter | Default seed | Notes |
|-----------|-------------|-------|
| `difficulty` (b) | `0.5` | Midpoint of the 0–1 scale — neutral assumption |
| `discrimination` (a) | `1.0` | Moderate discrimination — acceptable until real response data exists |

**Post-hoc calibration (v2):** After ≥ 30 answer events on a question, recalibrate via Maximum Likelihood Estimation (MLE) using the `answer_events` table. Store updated values back in `questions.difficulty` and `questions.discrimination`. This is a background job, not real-time. For v1, defaults are used throughout.

**CAT item selection impact:** With uniform difficulty=0.5, the cold-start CAT will not discriminate well at ability extremes (very strong or very weak users). This is acceptable for v1 — the diagnostic still provides a useful starting mastery seed. Flag in the UI: "Accuracy improves as more learners use the platform."

### 21.2 BKT Global Default Parameters

All topics share the same BKT parameters in v1. Per-topic tuning (via EM algorithm on answer history) is a v2 enhancement.

| BKT Parameter | Symbol | v1 Default | Rationale |
|--------------|--------|-----------|-----------|
| Prior knowledge | P(L₀) | 0.3 | 30% probability learner knows topic before any practice |
| Learning rate | P(T) | 0.1 | 10% chance of mastering a concept per correct answer |
| Slip rate | P(S) | 0.1 | 10% chance of answering wrong despite knowing the material |
| Guess rate | P(G) | 0.2 | 20% chance of answering correctly without knowing (4-option MCQ baseline) |

These match the commonly cited BKT defaults from Corbett & Anderson (1994). Store in a `bkt_params` config file or table for easy override.

### 21.3 SM-2 Prerequisite Boosting Algorithm

When a topic has a parent (prerequisite) with low mastery, prioritize the parent to unblock learning.

**Priority formula** (from selector.ts):
```
base_priority = 0.40 × (1 - mastery_probability)     // urgency
              + 0.30 × overdue_factor                  // recency
              + 0.20 × topic_weight                    // curriculum weight
              + 0.10 × prerequisite_availability       // availability (0 or 1)
```

**Prerequisite boost applied WHEN scheduling:** If a topic has `parent_topic_id` AND the parent's `mastery_probability < 0.5`:

```typescript
// In src/lib/engines/selector.ts
function applyPrerequisiteBoost(basePriority: number, parentMastery: number | null): number {
  if (parentMastery === null || parentMastery >= 0.5) return basePriority
  // Parent is weak — amplify urgency by up to 2× when parent mastery = 0
  return basePriority * (2 - parentMastery)
}
```

This means a topic whose prerequisite has 0% mastery gets up to 2× priority multiplier. At 40% mastery (just below the 0.5 threshold), the multiplier is 1.6×.

**Effect:** The selector naturally promotes foundational topics over advanced ones when the foundation is shaky — without hard-coding curriculum order.

### 21.4 Socratic Explanation Caching

**Goal:** Never call the LLM twice for the same wrong answer to the same question. Cache the explanation in `questions.explanation`.

**Flow:**
```
user answers wrong
→ check questions.explanation IS NOT NULL
→ if not null: return cached explanation immediately (no LLM call)
→ if null:
    1. call Claude Haiku with 3-step Socratic prompt
    2. UPDATE questions SET explanation = <result> WHERE id = <question_id>
    3. return explanation to user
```

**Concurrency:** If two users answer the same question wrong at the same millisecond (race condition), both will call the LLM. The second `UPDATE` overwrites the first with an identical or near-identical explanation. This is acceptable in v1 — the waste is one extra LLM call, not a correctness error. Use `UPDATE ... WHERE explanation IS NULL` to make it idempotent on the write side.

**Cost implication:** Each unique question generates exactly one Socratic explanation over its lifetime. Usage is tracked via `trackUsage('socratic_explanation', ...)` regardless of cache hit/miss — only track on actual LLM calls, not on cache hits.

**Correct answers:** No explanation is stored or generated. The Socratic panel only appears on wrong answers.

---

## 22. Data Deletion & GDPR Cleanup

### 22.1 Soft Delete Flow

When a user requests account deletion from `/settings`:

1. Set `users.deleted_at = NOW()` — the session callback will reject their JWT on next request.
2. Anonymize personal data **immediately**:
   - `users.name = NULL`
   - `users.image = NULL`
   - `users.email = 'deleted-' || user.id || '@cogniprep.invalid'`
   - `users.password_hash = NULL`
   - `users.stripe_customer_id = NULL`
3. Cancel any active Stripe subscriptions via `stripe.subscriptions.cancel(subscriptionId, { prorate: true })`.
4. Return `200 OK`. The user's session will be terminated on next request via the `deleted_at` check in the NextAuth session callback.

**What is retained (anonymized, for platform analytics):**
- `answer_events` — linked to anonymized user_id, no PII
- `usage_events` — cost accounting
- `user_topic_mastery` — aggregate learning statistics

**What is hard-deleted 30 days after `deleted_at`:**
- `sessions`, `accounts` (NextAuth tables)
- `user_question_schedule`, `study_sessions`
- `user_exam_purchases` (purchase history purged)

### 22.2 Automated Purge Cron Job

**Vercel Cron** (`vercel.json`):
```json
{
  "crons": [
    { "path": "/api/cron/health",        "schedule": "*/10 * * * *" },
    { "path": "/api/cron/purge-deleted", "schedule": "0 2 * * *" }
  ]
}
```

**`/api/cron/purge-deleted` handler:**
- Protected by `Authorization: Bearer $CRON_SECRET` header (Vercel sets this automatically for cron routes).
- Queries `SELECT id FROM users WHERE deleted_at < NOW() - INTERVAL '30 days'`.
- Hard-deletes `sessions`, `accounts`, `user_question_schedule`, `study_sessions`, `user_exam_purchases` for those user IDs.
- Logs number of users purged to `usage_events` (or application logs).
- Runs in a single transaction per user to avoid partial deletes.

**GDPR compliance:** 30-day retention after deletion request satisfies most jurisdictions. PII (name, email, image) is removed immediately at deletion request time (step 2 above). The 30-day window retains operational data (purchases, sessions) for fraud investigation and chargeback defence.
