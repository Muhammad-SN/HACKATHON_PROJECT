import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

function getS3Client(): S3Client {
  const region = process.env['AWS_REGION'] ?? 'us-east-1'
  const accessKeyId = process.env['AWS_ACCESS_KEY_ID']
  const secretAccessKey = process.env['AWS_SECRET_ACCESS_KEY']
  if (!accessKeyId || !secretAccessKey) {
    throw new Error('AWS credentials not configured')
  }
  return new S3Client({ region, credentials: { accessKeyId, secretAccessKey } })
}

function getBucket(): string {
  const bucket = process.env['S3_BUCKET_NAME']
  if (!bucket) throw new Error('S3_BUCKET_NAME not configured')
  return bucket
}

export async function generateUploadPresignedUrl(
  key: string,
  contentType: string
): Promise<string> {
  const client = getS3Client()
  const command = new PutObjectCommand({
    Bucket: getBucket(),
    Key: key,
    ContentType: contentType,
  })
  return getSignedUrl(client, command, { expiresIn: 300 })
}

export function buildS3Key(userId: string, filename: string): string {
  const timestamp = Date.now()
  const safe = filename.replace(/[^a-zA-Z0-9._-]/g, '_')
  return `uploads/${userId}/${timestamp}_${safe}`
}
