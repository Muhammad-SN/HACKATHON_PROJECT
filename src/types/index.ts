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

// Note: NextAuth Session augmentation lives in src/lib/auth.ts alongside the
// NextAuth config. Placing it here causes tsc to fail under moduleResolution
// "bundler" because next-auth v5 exposes no top-level "types" field.
// The SessionUser interface above is used to type session.user in auth.ts.
