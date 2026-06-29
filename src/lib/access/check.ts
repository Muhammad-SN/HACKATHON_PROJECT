export type StakesLevel = 'low' | 'high'
export type ClassificationSource = 'manual' | 'ai' | 'rules' | 'pending_review'
export type AccountTier = 'free' | 'premium'

export interface ExamContext {
  examId:               string
  ownerId:              string
  stakesLevel:          StakesLevel
  isPublic:             boolean
  classificationSource: ClassificationSource
}

export interface UserContext {
  userId:          string
  tier:            AccountTier
  hasExamPurchase: boolean
}

export interface AccessResult {
  granted: boolean
  reason:  string
}

export function checkExamAccess(exam: ExamContext, user: UserContext): AccessResult {
  if (exam.classificationSource === 'pending_review') {
    return { granted: false, reason: 'Exam is pending review and cannot be accessed' }
  }

  if (exam.stakesLevel === 'low') {
    if (exam.isPublic) {
      return { granted: true, reason: 'Public low-stakes exam' }
    }
    if (exam.ownerId === user.userId) {
      return { granted: true, reason: 'Creator access to private exam' }
    }
    return { granted: false, reason: 'Private exam — creator only' }
  }

  if (exam.stakesLevel === 'high') {
    if (user.hasExamPurchase) {
      return { granted: true, reason: 'Purchased high-stakes exam' }
    }
    return { granted: false, reason: 'High-stakes exam requires purchase' }
  }

  return { granted: false, reason: 'Unknown exam configuration' }
}
