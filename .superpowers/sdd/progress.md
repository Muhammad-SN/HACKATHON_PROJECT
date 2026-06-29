# SDD Progress Ledger

Base commit: 63e19a7

## Phase 1 — Setup & Foundation

Task 1: complete (commits 63e19a7..3873995, spec ✅, quality ✅) — NOTE: CVE-2025-66478 in next@15.3.3, evaluate patch before prod
Task 2: complete (commits 3873995..48c7cd9, spec ✅, quality ✅)
Task 3: complete (commits 48c7cd9..1383baf, spec ✅, quality ✅)
Task 4: complete (commits 1383baf..f201655, spec ✅, quality ✅) — NOTE: declare module 'next-auth' deferred to Task 7 src/auth.ts
Task 5: complete (commits f201655..20dbc70, spec ✅, quality ✅)
Task 6: complete (commits 20dbc70..24b218a, spec ✅, quality ✅) — integration tests need live DB
Task 7: complete (commits 24b218a..01d818a, spec ✅, quality ✅, security ✅)
Task 8: complete (commits 01d818a..c0892ef, spec ✅, quality ✅)
Task 9: complete (commits c0892ef..a64ddc9, spec ✅, quality ✅)
Task 10: complete (commits a64ddc9..bf48bf4, spec ✅, quality ✅)
Task 11: complete (commits bf48bf4..9ab7e43, spec ✅, quality ✅)
Task 12: complete (commits 9ab7e43, spec ✅, quality ✅) — 20 unit tests pass, 8 integration tests skip (no DB), coverage 7% overall (expected: Phase 1 is foundation-only)

## Phase 2 — Onboarding

Base commit: 9ab7e43

Task 1: complete (commit 8916c22, spec ✅, quality ✅) — src/lib/db/exams.ts: searchPublicExams, enrollUserInExam, getUserExamCount (7 tests)
Task 2: complete (commit 7162d6e, spec ✅, quality ✅) — GET /api/onboarding/search (4 tests)
Task 3: complete (commit f0eaecd, spec ✅, quality ✅, security ✅) — POST /api/onboarding/enroll (5 tests)
Task 4: complete (commit 1b7f77e, spec ✅, quality ✅) — /onboarding server page + OnboardingSearch client component; pushed to origin

## Phase 3 — Cold Start Diagnostic

Base commit: 1b7f77e

Task 1: complete (commit a3f94ae, spec ✅, quality ✅) — IRT 2PL engine: calculateProbability, calculateInformation, estimateAbility, selectNextQuestion, shouldStopDiagnostic (17 tests)
Task 2: complete (commit 959f202, spec ✅, quality ✅) — diagnostic DB: createDiagnosticSession, getUnansweredQuestions, recordAnswer, getSessionAnswers, completeDiagnosticSession, seedTopicMastery (8 tests)
Task 3: complete (commit 8665e23, spec ✅, quality ✅, security ✅) — GET /api/exams/[examId]/topics + POST /api/diagnostic/start + POST /api/diagnostic/answer (11 tests)
Task 4: complete (commit f964974, spec ✅, quality ✅) — /diagnostic server page + DiagnosticSession client component; pushed to origin

## Phase 4 — Document Upload

Base commit: f964974

Task A: complete (commit f5ddd03, spec ✅, quality ✅) — src/lib/s3/presigned.ts + src/lib/lambda/invoke.ts + /api/upload/presigned-url + /api/upload/text + /api/upload/status
Task B: complete (commit 752d218, spec ✅, quality ✅) — Lambda processor: lambda/src/{index,db,chunker,processor}.ts — Claude Haiku question generation, auto-promotes to rules_list if ≥10 questions
Task C: complete (commit d5e19ab, spec ✅, quality ✅) — /upload server page + UploadForm client component (text paste → processing → done); pushed to origin

## Phase 5 — Adaptive Study Session

Base commit: d5e19ab

Task 1: complete (commit f83d449, spec ✅, quality ✅) — BKT mastery updater (bkt.ts), SM-2 spaced repetition scheduler (sm2.ts), multi-criteria next-question selector (selector.ts), study DB layer (src/lib/db/study.ts)
Task 2: complete (commit 6f59d1e, spec ✅, quality ✅) — POST /api/study/next-question + POST /api/study/answer API routes; /study/[sessionId] server page + QuestionCard + AnswerChoices + SocraticPanel client components; pushed to origin

## Phase 6 — Readiness Dashboard

Base commit: 6f59d1e

Task 1: complete (commit 38f7fab, spec ✅, quality ✅) — src/lib/engines/readiness.ts: predictedScore (weighted mastery aggregation), confidenceInterval (1.96 sigma CI)
Task 2: complete (commit 7caecc0, spec ✅, quality ✅) — src/lib/db/progress.ts: getUserTopicMastery, getWeakTopics, TopicMasteryRow
Task 3: complete (commit 0172579, spec ✅, quality ✅) — GET /api/progress/readiness + GET /api/progress/mastery API routes
Task 4: complete (commit 225d566, spec ✅, quality ✅) — /progress dark-mode server page + ReadinessIsland + MasteryHeatMap + WeakAreaCard components; pushed to origin

## Phase 7 — Monetization

Base commit: 225d566

Task 1: complete (commit 2555a0e, spec ✅, quality ✅) — src/lib/db/billing.ts: getStripeCustomerId, saveStripeCustomerId, setUserPremium, setUserFree, recordExamPurchase, hasExamAccess, getPurchaseHistory, getUserTier
Task 2: complete (commit 3357a6a, spec ✅, quality ✅, security ✅) — src/lib/stripe/{client,customer,checkout,portal}.ts — lazy customer creation, subscription + per-exam checkout, Billing Portal; API version 2025-02-24.acacia
Task 3: complete (commit 2f2946a, spec ✅, quality ✅) — POST /api/billing/checkout + POST /api/billing/portal + POST /api/exams/[examId]/purchase API routes
Task 4: complete (commit fc68f59, spec ✅, quality ✅, security ✅) — POST /api/webhooks/stripe: raw body via req.text(), constructEvent sig verification, handles checkout.session.completed (subscription->premium, payment->exam_purchase) and customer.subscription.deleted (->free); ONLY place users.tier is set to premium
Task 5: complete (commit 996f071, spec ✅, quality ✅) — /pricing public static page: Free vs Premium comparison grid
Task 6: complete (commit f7ad065, spec ✅, quality ✅) — /settings auth-gated page + TierBadge + UpgradeCTA + PurchaseHistoryTable components; pushed to origin

## Phase 8 — Library & Admin

Base commit: f7ad065

Task 1: complete (commit 16cb08a, spec ✅, quality ✅) — src/lib/access/check.ts: checkExamAccess pure function, zero DB calls (6 tests) — pending_review always denied, high-stakes gated on purchase not tier
Task 2: complete (commit 18fc4a6, spec ✅, quality ✅) — src/lib/access/classifier.ts: classifyByRules (regex keyword list), classifyWithAI (Claude Haiku fallback), classifyExam orchestrator (4 tests)
Task 3: complete (commit 995b6f4, spec ✅, quality ✅) — src/lib/db/library.ts + src/lib/db/admin.ts — NOTE: schema uses created_by/name on exams table; audit_log table with actor_id + metadata JSONB; classification_source values are ai_suggestion/rules_list/admin_override
Task 4: complete (commit 7c4c349, spec ✅, quality ✅) — GET /api/exams/[examId]/access + GET /api/exams (tab=community|mine + search) API routes (3 tests)
Task 5: complete (commit 51bc11c, spec ✅, quality ✅, security ✅) — GET /api/admin/review-queue + POST /api/admin/classify + POST /api/admin/publish — all use requireAdmin(), never manual role check (6 tests)
Task 6: complete (commit af247d1, spec ✅, quality ✅) — /library server page + StakesBadge + ExamCard + LibraryFilter components — NOTE: --space-5 missing from tokens.css, ExamCard uses --space-4 fallback
Task 7: complete (commit 6fc957e, spec ✅, quality ✅) — /admin server page + ReviewQueueTable + AuditLogTable; pushed to origin — MEDIUM: buttons need type="button", th cells need scope="col", fetch errors should surface before reload

## Phase 9 — Polish

Base commit: cfaf81c

Task 1: complete (commit 4d5655f, spec ✅, quality ✅) — --space-10/--space-20 added, /api/onboarding/search rate-limit exempted
Task 2: complete (commit 01557e2, spec ✅, quality ✅) — 6 loading.tsx skeletons: root, dashboard, library, admin, diagnostic, study/[sessionId]
Task 3: complete (commit 84bff9e, spec ✅, quality ✅) — 4 error.tsx boundaries: root, dashboard, library, admin (all 'use client')
Task 4: complete (commit d813007, spec ✅, quality ✅) — purge-deleted cron route + 4 Vitest tests + vercel.json schedule
Task 5: complete (commit dda9988, spec ✅, quality ✅) — Nav component + layout wiring
Task 6: complete (commit e3b6bfb, spec ✅, quality ✅) — responsive.css, globals.css import, dashboard/library className hooks

## Pre-Phase 9 Gap Resolution

Base commit: e3b6bfb

Gap-1: complete (commit 2196e9c, spec ✅, quality ✅) — Integration test isolation: renamed pool.test.ts→pool.integration.test.ts and migrate.test.ts→migrate.integration.test.ts; added vitest.config.integration.ts (node env, includes *.integration.test.ts); vitest.config.ts now excludes *.integration.test.ts; package.json gains test:integration script; pnpm test 0 failures without DATABASE_URL; 171 tests pass

Gap-2: pending commit — src/lib/engines/generator.ts: generateQuestionsFromChunk pure engine (single-prompt Claude Haiku/Sonnet MCQ pipeline, JSON parse with empty-array fallback, returns { questions, inputTokens, outputTokens }); src/tests/lib/engines/generator.test.ts (6 tests); engine has zero DB calls

Gap-3: pending commit — src/lib/engines/socratic.ts: generateSocraticExplanation pure engine (3 steps via DELIMITER split for wrong answers, 1 reinforcing step for correct, returns { steps, inputTokens, outputTokens }); src/tests/lib/engines/socratic.test.ts (6 tests); src/app/api/study/socratic/route.ts refactored to delegate to engine (response keeps both steps[] and explanation string for backward compat with StudySession.tsx)

Gap-4: pending commit — src/tests/lib/ai/usage.test.ts (3 tests): trackUsage INSERT column coverage via vi.hoisted mock of getPool; previously zero test coverage on trackUsage

Gap-5: pending — ClassificationSource type mismatch: src/lib/access/check.ts line 2 has wrong values ('manual'|'ai'|'rules'|'pending_review') — must become 'rules_list'|'pending_review'|'admin_override' to match DB CHECK constraint and src/types/index.ts; fix also requires updating BASE.classificationSource in src/tests/lib/access/check.test.ts line 9 from 'manual' → 'rules_list'
