export interface TopicMasteryInput {
  mastery: number
  weight: number
}

export function predictedScore(topics: TopicMasteryInput[]): number {
  if (topics.length === 0) return 0
  const totalWeight = topics.reduce((sum, t) => sum + t.weight, 0)
  if (totalWeight === 0) return 0
  const weighted = topics.reduce((sum, t) => sum + t.weight * t.mastery, 0)
  return Math.max(0, Math.min(100, (weighted / totalWeight) * 100))
}

export function confidenceInterval(topics: TopicMasteryInput[], totalAttempts: number): number {
  if (topics.length === 0 || totalAttempts === 0) return 0
  const totalWeight = topics.reduce((sum, t) => sum + t.weight, 0)
  if (totalWeight === 0) return 0
  const avg = topics.reduce((sum, t) => sum + t.weight * t.mastery, 0) / totalWeight
  const variance = topics.reduce((sum, t) => sum + t.weight * Math.pow(t.mastery - avg, 2), 0) / totalWeight
  return Math.max(0, Math.min(50, 1.96 * Math.sqrt(variance / totalAttempts) * 100))
}
