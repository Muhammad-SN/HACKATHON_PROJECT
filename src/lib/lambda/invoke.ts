import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda'

interface LambdaPayload {
  jobId: string
  examId: string
  userId: string
  sourceType: 'text' | 'pdf'
  text?: string
  s3Key?: string
}

function getLambdaClient(): LambdaClient {
  const region = process.env['AWS_REGION'] ?? 'us-east-1'
  return new LambdaClient({
    region,
    credentials: {
      accessKeyId: process.env['AWS_ACCESS_KEY_ID'] ?? '',
      secretAccessKey: process.env['AWS_SECRET_ACCESS_KEY'] ?? '',
    },
  })
}

export async function invokeLambda(payload: LambdaPayload): Promise<void> {
  const functionName = process.env['LAMBDA_FUNCTION_NAME']
  if (!functionName) {
    process.stderr.write('LAMBDA_FUNCTION_NAME not set — skipping Lambda invocation\n')
    return
  }
  try {
    const client = getLambdaClient()
    await client.send(new InvokeCommand({
      FunctionName: functionName,
      InvocationType: 'Event', // async, fire-and-forget
      Payload: JSON.stringify(payload),
    }))
  } catch (err) {
    process.stderr.write(`Lambda invocation failed: ${String(err)}\n`)
  }
}
