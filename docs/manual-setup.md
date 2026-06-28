# CogniPrep — Manual Infrastructure Setup Guide

**Hackathon Deadline:** June 29, 2026, 5:00 PM PDT
**Estimated total setup time:** 3–4 hours (first time), 45 min (repeat)

Read this entire file before starting. Complete the steps in order — later steps depend on resources created earlier.

---

## Prerequisites

- AWS account with billing enabled
- Node.js 20+ and pnpm installed locally
- `psql` CLI installed (for database access)
- AWS CLI v2 installed (`aws --version`) and configured (`aws configure`)
- Anthropic account

---

## Step 1 — IAM User & Access Keys

**Why:** Vercel and Lambda need AWS credentials scoped to exactly the services they touch. Never use root credentials.

### 1.1 Create an IAM policy

1. Open [AWS Console → IAM → Policies → Create policy](https://console.aws.amazon.com/iam/home#/policies)
2. Switch to the **JSON** tab and paste:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "S3PresignedUpload",
      "Effect": "Allow",
      "Action": ["s3:PutObject", "s3:GetObject", "s3:DeleteObject"],
      "Resource": "arn:aws:s3:::cogniprep-uploads/*"
    },
    {
      "Sid": "LambdaInvoke",
      "Effect": "Allow",
      "Action": ["lambda:InvokeFunction"],
      "Resource": "arn:aws:lambda:us-east-1:*:function:cogniprep-processor"
    },
    {
      "Sid": "BedrockEmbeddings",
      "Effect": "Allow",
      "Action": ["bedrock:InvokeModel"],
      "Resource": "arn:aws:bedrock:us-east-1::foundation-model/amazon.titan-embed-text-v2:0"
    }
  ]
}
```

3. Name it `CogniPrepAppPolicy` → **Create policy**

### 1.2 Create an IAM user

1. IAM → Users → **Create user**
2. Username: `cogniprep-app`
3. Permissions: **Attach policies directly** → select `CogniPrepAppPolicy`
4. Click **Create user**

### 1.3 Generate access keys

1. Click `cogniprep-app` user → **Security credentials** tab
2. Scroll to **Access keys** → **Create access key**
3. Use case: **Application running outside AWS**
4. Click **Create access key**
5. **Copy both values now** — the secret key is shown only once:
   - Save as `AWS_ACCESS_KEY_ID`
   - Save as `AWS_SECRET_ACCESS_KEY`

---

## Step 2 — Aurora PostgreSQL Cluster

**Why:** Aurora Serverless v2 is the main database. The hackathon configuration enables public access so Vercel can reach it without VPC peering. Switch to RDS Proxy before going to production.

### 2.1 Create the cluster

1. Open [AWS Console → RDS → Create database](https://console.aws.amazon.com/rds/home#launch-dbinstance:)
2. Select:
   - **Standard create**
   - Engine: **Aurora (PostgreSQL Compatible)**
   - Version: **Aurora PostgreSQL 15.x** (pick latest 15.x available)
   - Template: **Dev/Test**
3. Settings:
   - DB cluster identifier: `cogniprep`
   - Master username: `cogniprep_admin`
   - Master password: create a strong password → save as `AURORA_PASSWORD`
4. Instance configuration:
   - DB instance class: **Serverless v2**
   - Minimum ACU: **0.5** ← do NOT use 0; prevents cold start during demo
   - Maximum ACU: **4**
5. Connectivity:
   - VPC: default VPC
   - **Public access: YES** ← required so Vercel can connect
   - VPC security group: create new → name it `cogniprep-db-sg`
6. Additional configuration:
   - Initial database name: `cogniprep`
7. Click **Create database** — takes 5–8 minutes

### 2.2 Open the security group to Vercel

After the cluster is created:

1. RDS → Databases → click `cogniprep-cluster` → **Connectivity & security** tab
2. Click the security group link (`cogniprep-db-sg`)
3. **Inbound rules → Edit inbound rules → Add rule**
   - Type: **PostgreSQL**
   - Port: **5432**
   - Source: **Anywhere-IPv4** (`0.0.0.0/0`)
4. **Save rules**

> This permits Vercel's dynamic IPs to connect. Acceptable for a hackathon. In production, replace with RDS Proxy + IAM authentication.

### 2.3 Collect the connection details

1. RDS → Databases → `cogniprep-cluster` → **Connectivity & security**
2. Copy the **Writer endpoint** — looks like:
   `cogniprep-cluster.cluster-xxxxxxxxxxxx.us-east-1.rds.amazonaws.com`
3. Save this as `AURORA_HOST`

Your complete `DATABASE_URL`:
```
postgresql://cogniprep_admin:YOUR_PASSWORD@YOUR_AURORA_HOST:5432/cogniprep?sslmode=require
```

### 2.4 Enable pgvector extension

Connect with psql:

```bash
psql "postgresql://cogniprep_admin:YOUR_PASSWORD@YOUR_AURORA_HOST:5432/cogniprep?sslmode=require"
```

Run once connected:

```sql
CREATE EXTENSION IF NOT EXISTS vector;
SELECT extname, extversion FROM pg_extension WHERE extname = 'vector';
-- should print: vector | 0.7.x
\q
```

If you get `ERROR: extension "vector" is not available` — your Aurora version doesn't include pgvector. Go to RDS → Modify → upgrade to Aurora PostgreSQL 15.4 or later.

### 2.5 Run schema migration

From the project root:

```bash
pnpm db:migrate
```

Verify all tables were created:

```bash
psql "$DATABASE_URL" -c "\dt"
```

Expected tables: `users`, `accounts`, `sessions`, `verification_tokens`, `exams`, `user_exams`, `exam_topics`, `questions`, `document_chunks`, `document_jobs`, `user_topic_mastery`, `user_question_schedule`, `study_sessions`, `answer_events`, `usage_events`, `question_embeddings`.

### 2.6 Seed demo data

```bash
pnpm db:seed
```

This inserts:
- 1 exam: "IELTS General Training"
- 12 topics with weights
- 60 pre-written questions across difficulty 0.3, 0.5, and 0.7

This is the data that powers the hackathon demo flow. Run it once before the demo and do not truncate the tables.

---

## Step 3 — AWS S3 Bucket

**Why:** PDFs are uploaded directly from the browser to S3 using a presigned URL. Next.js only generates the URL — it never handles the file bytes.

### 3.1 Create the bucket

```bash
aws s3api create-bucket \
  --bucket cogniprep-uploads \
  --region us-east-1
```

Block all public access (presigned URLs handle per-request authorization):

```bash
aws s3api put-public-access-block \
  --bucket cogniprep-uploads \
  --public-access-block-configuration \
  "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"
```

### 3.2 Configure CORS

Save this as `s3-cors.json` in your project root:

```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["PUT"],
    "AllowedOrigins": [
      "http://localhost:3000",
      "https://*.vercel.app"
    ],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

Apply it:

```bash
aws s3api put-bucket-cors \
  --bucket cogniprep-uploads \
  --cors-configuration file://s3-cors.json
```

Verify:

```bash
aws s3api get-bucket-cors --bucket cogniprep-uploads
```

Save `cogniprep-uploads` as `AWS_S3_BUCKET_NAME`.

---

## Step 4 — AWS Lambda Function

**Why:** PDF processing (extract text → chunk → generate questions) is too slow for a Next.js API route. Lambda handles it asynchronously. The API route invokes Lambda directly with `InvokeCommand` — no S3 event trigger is needed.

### 4.1 Create the Lambda execution role

```bash
aws iam create-role \
  --role-name cogniprep-lambda-role \
  --assume-role-policy-document '{
    "Version": "2012-10-17",
    "Statement": [{
      "Effect": "Allow",
      "Principal": {"Service": "lambda.amazonaws.com"},
      "Action": "sts:AssumeRole"
    }]
  }'
```

Attach CloudWatch Logs (built-in Lambda logging):

```bash
aws iam attach-role-policy \
  --role-name cogniprep-lambda-role \
  --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole
```

Attach S3 read (to fetch uploaded PDFs):

```bash
aws iam attach-role-policy \
  --role-name cogniprep-lambda-role \
  --policy-arn arn:aws:iam::aws:policy/AmazonS3ReadOnlyAccess
```

Attach Bedrock invoke (for premium embeddings):

```bash
aws iam put-role-policy \
  --role-name cogniprep-lambda-role \
  --policy-name BedrockInvoke \
  --policy-document '{
    "Version": "2012-10-17",
    "Statement": [{
      "Effect": "Allow",
      "Action": ["bedrock:InvokeModel"],
      "Resource": "*"
    }]
  }'
```

Wait 15 seconds for IAM propagation before the next step.

### 4.2 Build and deploy the Lambda bundle

```bash
pnpm lambda:build
```

This produces `dist/lambda.zip` (~8 MB, bundled with esbuild).

Get the role ARN:

```bash
ROLE_ARN=$(aws iam get-role --role-name cogniprep-lambda-role --query 'Role.Arn' --output text)
echo $ROLE_ARN
```

Create the function:

```bash
aws lambda create-function \
  --function-name cogniprep-processor \
  --runtime nodejs20.x \
  --role $ROLE_ARN \
  --handler index.handler \
  --zip-file fileb://dist/lambda.zip \
  --timeout 300 \
  --memory-size 1024 \
  --region us-east-1
```

### 4.3 Set Lambda environment variables

```bash
aws lambda update-function-configuration \
  --function-name cogniprep-processor \
  --environment Variables="{
    DATABASE_URL=YOUR_DATABASE_URL,
    ANTHROPIC_API_KEY=YOUR_ANTHROPIC_KEY,
    AWS_S3_BUCKET_NAME=cogniprep-uploads,
    AWS_BEDROCK_REGION=us-east-1
  }" \
  --region us-east-1
```

> Lambda auto-injects `AWS_REGION`, `AWS_ACCESS_KEY_ID`, and `AWS_SECRET_ACCESS_KEY` via its execution role. Do not set them manually.

### 4.4 Test the function

```bash
aws lambda invoke \
  --function-name cogniprep-processor \
  --payload '{"type":"health_check"}' \
  --cli-binary-format raw-in-base64-out \
  response.json \
  --region us-east-1

cat response.json
# Expected: {"status":"ok"}
```

If it fails, inspect logs:

```bash
aws logs tail /aws/lambda/cogniprep-processor --follow --region us-east-1
```

### 4.5 Future deployments (after code changes)

```bash
pnpm lambda:deploy
# This runs: pnpm lambda:build && aws lambda update-function-code ...
```

Save `cogniprep-processor` as `AWS_LAMBDA_FUNCTION_NAME`.

---

## Step 5 — AWS Bedrock Model Access

**Why:** Premium tier uses Titan Embed Text v2 for semantic vector search. Model access requires a one-time request and is not auto-enabled.

> Do this immediately — approval is usually instant but can take up to 30 minutes.

### 5.1 Request access

1. Open [AWS Console → Amazon Bedrock → Model access](https://us-east-1.console.aws.amazon.com/bedrock/home?region=us-east-1#/modelaccess)
   - Make sure you are in the **us-east-1** region
2. Click **Manage model access**
3. Scroll to the **Amazon** section
4. Check **Titan Embed Text v2** (`amazon.titan-embed-text-v2:0`)
5. Click **Save changes**

### 5.2 Verify access was granted

```bash
aws bedrock list-foundation-models \
  --region us-east-1 \
  --query "modelSummaries[?modelId=='amazon.titan-embed-text-v2:0'].{id:modelId,status:modelLifecycle.status}" \
  --output table
```

You should see the model listed with status `ACTIVE`. If the list is empty, access is still pending — wait 5 minutes and retry.

---

## Step 6 — Anthropic API Key

1. Go to [console.anthropic.com](https://console.anthropic.com) → API Keys → **Create key**
2. Name: `cogniprep-hackathon`
3. Copy the key immediately (shown only once)
4. Save as `ANTHROPIC_API_KEY`

Verify the key:

```bash
curl https://api.anthropic.com/v1/messages \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "content-type: application/json" \
  -d '{
    "model": "claude-haiku-4-5-20251001",
    "max_tokens": 10,
    "messages": [{"role": "user", "content": "ping"}]
  }'
```

A 200 response confirms the key is valid.

---

## Step 7 — Environment Variables

### 7.1 Create .env.local

Copy `.env.example` to `.env.local` and fill in every value:

```env
# ── Database ─────────────────────────────────────────────────────────────
DATABASE_URL=postgresql://cogniprep_admin:YOUR_PASSWORD@YOUR_AURORA_HOST:5432/cogniprep?sslmode=require

# ── Auth ─────────────────────────────────────────────────────────────────
NEXTAUTH_SECRET=GENERATE_BELOW
NEXTAUTH_URL=http://localhost:3000

# ── Anthropic ────────────────────────────────────────────────────────────
ANTHROPIC_API_KEY=sk-ant-...

# ── AWS (used by Next.js app server and Lambda invocation) ────────────────
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...
AWS_S3_BUCKET_NAME=cogniprep-uploads
AWS_LAMBDA_FUNCTION_NAME=cogniprep-processor
AWS_BEDROCK_REGION=us-east-1

# ── Aurora PostgreSQL (individual params for migration scripts) ───────────
AURORA_HOST=cogniprep-cluster.cluster-xxxx.us-east-1.rds.amazonaws.com
AURORA_PORT=5432
AURORA_DB=cogniprep
AURORA_USER=cogniprep_admin
AURORA_PASSWORD=...

# ── Warm-up ──────────────────────────────────────────────────────────────
AURORA_MIN_CAPACITY=0.5
```

### 7.2 Generate NEXTAUTH_SECRET

```bash
openssl rand -base64 32
```

Paste the output into `NEXTAUTH_SECRET`. Use the same value in Vercel env vars.

### 7.3 Confirm no secrets are in source code

```bash
grep -rn "sk-ant-\|AKIA\|rds\.amazonaws\.com\|password" src/ --include="*.ts" --include="*.tsx"
```

This should return zero matches.

---

## Step 8 — Vercel Deployment

### 8.1 Import the project

1. Go to [vercel.com/new](https://vercel.com/new)
2. Import your GitHub repository
3. Framework preset: **Next.js** (auto-detected)
4. Root directory: `.`
5. Click **Deploy** — it will fail on the first attempt because env vars aren't set yet

### 8.2 Add environment variables

Vercel Dashboard → your project → **Settings → Environment Variables**

Add every variable from `.env.local`. For production, update these two:

```
NEXTAUTH_URL=https://your-project-name.vercel.app
```

Set variables for all three environments: **Production**, **Preview**, **Development**.

### 8.3 Redeploy

Deployments tab → latest deployment → **Redeploy**. The build will pass now.

### 8.4 Verify production

```bash
curl https://your-project.vercel.app/api/health
# Expected: {"ok":true,"ts":1234567890}
```

---

## Step 9 — Aurora Warm-Up Cron

**Why:** Even at `MinCapacity=0.5`, a periodic ping keeps the connection pool alive and ensures zero-latency response during the demo.

### 9.1 Create vercel.json

In the project root:

```json
{
  "crons": [
    {
      "path": "/api/health",
      "schedule": "*/10 * * * *"
    }
  ]
}
```

### 9.2 Create the health route

`src/app/api/health/route.ts`:

```typescript
import { getPool } from '@/lib/db/pool'
import { NextResponse } from 'next/server'

export async function GET() {
  const pool = getPool()
  await pool.query('SELECT 1')
  return NextResponse.json({ ok: true, ts: Date.now() })
}
```

Commit and push. Vercel will pick up the cron config automatically on next deploy.

---

## Pre-Demo Checklist

Run through this the evening before the deadline (June 28).

### Infrastructure
- [ ] Aurora status: **Available** (green) in RDS console
- [ ] Aurora MinCapacity is **0.5** (not 0) in RDS → Modify
- [ ] Security group has inbound TCP 5432 from `0.0.0.0/0`
- [ ] pgvector enabled: `SELECT extname FROM pg_extension WHERE extname = 'vector';` returns a row
- [ ] Migration ran: `\dt` shows all 16 tables
- [ ] Seed ran: `SELECT COUNT(*) FROM questions;` returns 60

### AWS Services
- [ ] S3 bucket `cogniprep-uploads` exists
- [ ] S3 CORS configured: `aws s3api get-bucket-cors --bucket cogniprep-uploads` returns config
- [ ] Lambda `cogniprep-processor` status: **Active**, runtime: **Node.js 20.x**
- [ ] Lambda env vars set: `DATABASE_URL`, `ANTHROPIC_API_KEY`, `AWS_S3_BUCKET_NAME`, `AWS_BEDROCK_REGION`
- [ ] Lambda health check returns `{"status":"ok"}` (Step 4.4)
- [ ] Bedrock: `aws bedrock list-foundation-models` shows Titan Embed Text v2 as `ACTIVE`

### Application
- [ ] `NEXTAUTH_SECRET` set identically in `.env.local` and Vercel
- [ ] `NEXTAUTH_URL` is the production Vercel URL (not localhost) in Vercel env vars
- [ ] Registration + login flow works on the production URL
- [ ] `/api/health` returns `{"ok":true}` on production URL
- [ ] Vercel Cron is active: Vercel Dashboard → **Cron Jobs** tab

### Demo Flow Dry-Run (do this twice)
- [ ] Register as new user → select "IELTS General Training"
- [ ] Complete 15-question diagnostic → dashboard loads with heat map and readiness score
- [ ] Click "Continue Studying" → question loads, Socratic panel slides up on wrong answer
- [ ] Navigate to Progress → dark mode analytics page loads with charts
- [ ] Paste text in upload tab → questions generated and count updates

### Backup
- [ ] Pre-seeded user account ready (registered, diagnostic completed) — use if registration fails live
- [ ] Screen recording of full happy path saved locally as fallback

---

## Troubleshooting

### "Cannot connect to database" on Vercel

1. Verify `DATABASE_URL` is in Vercel env vars for the **Production** environment
2. Verify Aurora security group has inbound TCP 5432 from `0.0.0.0/0`
3. Verify Aurora status is **Available** (not paused or modifying)
4. Test locally: `psql "YOUR_DATABASE_URL"` — if this fails, the problem is credentials or network, not Vercel

### "CORS error" on file upload

1. Check S3 CORS: `aws s3api get-bucket-cors --bucket cogniprep-uploads`
2. Confirm `AllowedOrigins` includes your exact Vercel production URL
3. Confirm `AllowedMethods` includes `PUT`
4. Check browser console — the CORS error will show the blocked origin

### "Lambda invocation failed"

1. Check CloudWatch: `aws logs tail /aws/lambda/cogniprep-processor --since 15m --region us-east-1`
2. Verify Lambda IAM role has S3 read and Bedrock invoke permissions
3. Verify Lambda env vars include `DATABASE_URL` and `ANTHROPIC_API_KEY`
4. Check Lambda timeout — large PDFs may exceed 300s; reduce chunk size

### "NextAuth sign-in fails silently"

1. Verify `NEXTAUTH_SECRET` is the same value in `.env.local` and Vercel
2. Verify `NEXTAUTH_URL` matches the URL you're visiting (no trailing slash)
3. Verify NextAuth adapter tables exist: `accounts`, `sessions`, `verification_tokens`
4. Check Vercel function logs for the specific error string

### "Slow first request to dashboard" (Aurora cold start)

1. Verify MinCapacity is `0.5` in RDS console → DB cluster → Modify
2. Verify Vercel Cron is pinging `/api/health` every 10 minutes
3. If still slow before the demo, run: `psql "$DATABASE_URL" -c "SELECT 1"` once to warm the connection
