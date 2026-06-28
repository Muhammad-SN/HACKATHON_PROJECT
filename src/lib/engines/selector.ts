import type { Sm2Record } from './sm2'

export interface StudyQuestion {
  id: string
  topicId: string
  difficulty: number
  discrimination: number
}

export interface StudyQuestionWithSchedule extends StudyQuestion {
  schedule: Sm2Record & { nextReviewAt: Date }
  topicMastery: number
}

export function scoreQuestion(
  q: StudyQuestionWithSchedule,
  now: Date
): number {
  const overdueScore = q.schedule.nextReviewAt <= now
    ? 1.0
    : Math.max(0, 1 - (q.schedule.nextReviewAt.getTime() - now.getTime()) / (7 * 24 * 60 * 60 * 1000))

  const weakTopicScore = 1 - q.topicMastery

  const optimalDifficultyScore = 1 - Math.abs(q.difficulty - 0.5)

  return 0.5 * overdueScore + 0.3 * weakTopicScore + 0.2 * optimalDifficultyScore
}

export function selectNextStudyQuestion(
  questions: StudyQuestionWithSchedule[],
  now: Date
): StudyQuestionWithSchedule | null {
  if (questions.length === 0) return null
  return questions.reduce((best, q) =>
    scoreQuestion(q, now) > scoreQuestion(best, now) ? q : best
  )
}
