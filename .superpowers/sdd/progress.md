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
