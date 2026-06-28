import { processJob } from './processor'

interface LambdaPayload {
  jobId: string
  examId: string
  userId: string
  sourceType: 'text' | 'pdf'
  text?: string
  s3Key?: string
}

export const handler = async (event: LambdaPayload): Promise<void> => {
  if (!event.jobId || !event.examId || !event.userId) {
    throw new Error('Missing required fields: jobId, examId, userId')
  }
  await processJob(event)
}
