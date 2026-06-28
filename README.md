# CogniPrep

AI-powered adaptive exam preparation platform. Prepare for any exam worldwide using intelligent diagnostics, spaced repetition, and Socratic AI tutoring.

Built for the [H0: Hack the Zero Stack](https://h01.devpost.com) hackathon — Vercel v0 + AWS Databases track.

## What It Does

- **Cold Start Diagnostic** — 15-question adaptive test maps your knowledge on day one, no history needed
- **Any Exam** — upload your own study materials or let AI generate a curriculum from an exam name
- **Weak Area Detection** — topic mastery heat map shows exactly what needs work
- **Readiness Prediction** — predicted score with confidence interval updates after every session
- **Socratic AI Tutor** — wrong answers trigger a 3-step explanation that teaches, not just reveals

## Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 15 (App Router) on Vercel |
| Database | AWS Aurora PostgreSQL Serverless v2 + pgvector |
| Auth | NextAuth.js v5 |
| AI | Anthropic Claude (Haiku + Sonnet) |
| Async Processing | AWS Lambda |
| Storage | AWS S3 |
| Embeddings | AWS Bedrock Titan Embed Text v2 |

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm
- AWS account (Aurora PostgreSQL + S3 + Lambda + Bedrock)
- Anthropic API key

### Setup

```bash
pnpm install
cp .env.example .env.local
# fill in .env.local with your credentials
pnpm db:migrate
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

### Environment Variables

See `.env.example` for all required variables. Key ones:

```env
DATABASE_URL=
NEXTAUTH_SECRET=
ANTHROPIC_API_KEY=
AWS_REGION=
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_S3_BUCKET_NAME=
AURORA_HOST=
```

## Architecture

Full design and architecture specification: [`docs/spec-document.md`](docs/spec-document.md)

### Seven Learning Subsystems

All custom TypeScript, all free/OSS algorithms — no single engine for all tasks:

| Engine | File | Algorithm |
|--------|------|-----------|
| Cold Start | `src/lib/engines/cold-start.ts` | IRT 2PL + CAT |
| Mastery Estimation | `src/lib/engines/bkt.ts` | Bayesian Knowledge Tracing |
| Study Scheduling | `src/lib/engines/sm2.ts` | Modified SM-2 |
| Next-Question Selector | `src/lib/engines/selector.ts` | Multi-criteria scoring |
| Readiness Prediction | `src/lib/engines/readiness.ts` | Weighted mastery + CI |
| Content Generation | `src/lib/engines/generator.ts` | Claude Haiku / Sonnet |
| Assessment & Feedback | `src/lib/engines/socratic.ts` | Socratic prompt chain |

### Monetization

Two independent revenue streams — fully non-interacting in v1:

**Premium subscription** (platform feature richness):

| Feature | Free | Premium |
|---------|------|---------|
| Document input | Upload own materials | Upload + AI curriculum from exam name |
| PDF processing | pdf-parse (OSS) | AWS Textract |
| LLM | Claude Haiku | Claude Haiku + Sonnet |
| Community library | Low-stakes curricula | Low-stakes curricula |

**Per-exam purchase** (high-stakes content access):
- Every exam has a `stakes_level`: `low` or `high`
- High-stakes exams (medical, legal, financial, engineering, grad admissions, professional certs) require a one-time per-exam purchase at an individual price set per exam
- Both free and premium users can purchase any high-stakes exam
- Premium does **not** unlock high-stakes exams — the two revenue streams are independent
- Purchases tracked in `user_exam_purchases`; `account_tier` is never modified by a purchase

## Project Structure

```
src/
├── app/                    # Next.js App Router
│   ├── (auth)/            # Login, register
│   ├── dashboard/         # Home dashboard
│   ├── diagnostic/        # Cold start flow
│   ├── study/             # Study session
│   ├── progress/          # Analytics (dark mode)
│   ├── upload/            # Document upload
│   └── api/               # API routes
├── components/
│   ├── ui/                # Primitive components
│   ├── dashboard/
│   ├── study/
│   ├── diagnostic/
│   └── progress/
├── lib/
│   ├── engines/           # Seven learning subsystems
│   ├── db/                # Database queries
│   ├── ai/                # Anthropic SDK wrappers
│   └── s3/                # AWS S3 utilities
└── types/
docs/
└── spec-document.md       # Full design specification
```

## Design

**Visual direction:** A+D+C hybrid — Focused & Minimal (Linear/Notion) + Warm & Coach-Like (Headspace) + Dark Dashboard (Figma dark mode)

**Two visual modes:**
- Study sessions: warm cream background, indigo primary, amber accent
- Analytics/Progress: deep navy dark mode, electric violet, amber carries over

**Typography:** DM Serif Display (headers, scores, tutor voice) + Inter (all UI text)
