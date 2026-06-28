-- migrations/0001_initial_schema.sql

CREATE TABLE users (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email              TEXT UNIQUE NOT NULL,
  name               TEXT,
  image              TEXT,
  password_hash      TEXT,
  tier               TEXT DEFAULT 'free'  CHECK (tier IN ('free','premium')),
  role               TEXT DEFAULT 'user'  CHECK (role IN ('user','admin')),
  stripe_customer_id TEXT UNIQUE,
  deleted_at         TIMESTAMPTZ,
  created_at         TIMESTAMPTZ DEFAULT NOW()
);

-- NextAuth v5 required tables
CREATE TABLE accounts (
  id                  TEXT PRIMARY KEY,
  user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type                TEXT NOT NULL,
  provider            TEXT NOT NULL,
  provider_account_id TEXT NOT NULL,
  refresh_token       TEXT,
  access_token        TEXT,
  expires_at          BIGINT,
  token_type          TEXT,
  scope               TEXT,
  id_token            TEXT,
  session_state       TEXT,
  UNIQUE(provider, provider_account_id)
);

CREATE TABLE sessions (
  id            TEXT PRIMARY KEY,
  session_token TEXT UNIQUE NOT NULL,
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires       TIMESTAMPTZ NOT NULL
);

CREATE TABLE verification_tokens (
  identifier TEXT NOT NULL,
  token      TEXT NOT NULL,
  expires    TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (identifier, token)
);

CREATE TABLE exams (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                     TEXT NOT NULL,
  description              TEXT,
  created_by               UUID REFERENCES users(id) ON DELETE SET NULL,
  is_public                BOOLEAN DEFAULT FALSE,
  domain                   TEXT DEFAULT 'general'
                           CHECK (domain IN ('medical','legal','finance','engineering',
                                             'technology','language','academic','professional','general')),
  stakes_level             TEXT DEFAULT 'high' CHECK (stakes_level IN ('low','high')),
  classification_source    TEXT DEFAULT 'pending_review'
                           CHECK (classification_source IN ('rules_list','ai_suggestion','admin_override','pending_review')),
  classification_matched_rule TEXT,
  price_cents              INTEGER,
  created_at               TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE exam_topics (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id         UUID REFERENCES exams(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  weight          NUMERIC(4,3) DEFAULT 0.1,
  parent_topic_id UUID REFERENCES exam_topics(id) ON DELETE SET NULL
);

CREATE TABLE questions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id        UUID REFERENCES exams(id) ON DELETE CASCADE,
  topic_id       UUID REFERENCES exam_topics(id) ON DELETE SET NULL,
  stem           TEXT NOT NULL,
  options        JSONB NOT NULL,
  correct_index  SMALLINT NOT NULL,
  explanation    TEXT,
  difficulty     NUMERIC(4,3) DEFAULT 0.5,
  discrimination NUMERIC(4,3) DEFAULT 1.0,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE user_exams (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES users(id) ON DELETE CASCADE,
  exam_id     UUID REFERENCES exams(id) ON DELETE CASCADE,
  enrolled_at TIMESTAMPTZ DEFAULT NOW(),
  is_active   BOOLEAN DEFAULT TRUE,
  UNIQUE(user_id, exam_id)
);

CREATE TABLE user_topic_mastery (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID REFERENCES users(id) ON DELETE CASCADE,
  topic_id            UUID REFERENCES exam_topics(id) ON DELETE CASCADE,
  mastery_probability NUMERIC(5,4) DEFAULT 0.3,
  attempts            INTEGER DEFAULT 0,
  last_updated        TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, topic_id)
);

CREATE TABLE user_question_schedule (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID REFERENCES users(id) ON DELETE CASCADE,
  question_id      UUID REFERENCES questions(id) ON DELETE CASCADE,
  next_review_at   TIMESTAMPTZ DEFAULT NOW(),
  interval_days    NUMERIC(6,2) DEFAULT 1,
  ease_factor      NUMERIC(4,3) DEFAULT 2.5,
  repetition_count INTEGER DEFAULT 0,
  UNIQUE(user_id, question_id)
);

CREATE TABLE study_sessions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID REFERENCES users(id) ON DELETE CASCADE,
  exam_id      UUID REFERENCES exams(id) ON DELETE CASCADE,
  session_type TEXT NOT NULL CHECK (session_type IN ('diagnostic','adaptive')),
  started_at   TIMESTAMPTZ DEFAULT NOW(),
  ended_at     TIMESTAMPTZ,
  metadata     JSONB DEFAULT '{}'
);

CREATE UNIQUE INDEX idx_one_active_diagnostic_per_user_exam
  ON study_sessions(user_id, exam_id)
  WHERE session_type = 'diagnostic' AND ended_at IS NULL;

CREATE TABLE answer_events (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id    UUID REFERENCES study_sessions(id) ON DELETE CASCADE,
  user_id       UUID REFERENCES users(id) ON DELETE CASCADE,
  question_id   UUID REFERENCES questions(id) ON DELETE CASCADE,
  chosen_index  SMALLINT NOT NULL,
  is_correct    BOOLEAN NOT NULL,
  time_spent_ms INTEGER,
  answered_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE document_jobs (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id             UUID REFERENCES exams(id) ON DELETE CASCADE,
  user_id             UUID REFERENCES users(id) ON DELETE CASCADE,
  status              TEXT DEFAULT 'pending' CHECK (status IN ('pending','processing','complete','failed')),
  source_type         TEXT NOT NULL CHECK (source_type IN ('pdf','text')),
  s3_key              TEXT,
  questions_generated INTEGER DEFAULT 0,
  failed_reason       TEXT,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  completed_at        TIMESTAMPTZ
);

CREATE TABLE user_exam_purchases (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                  UUID REFERENCES users(id) ON DELETE CASCADE,
  exam_id                  UUID REFERENCES exams(id) ON DELETE CASCADE,
  stripe_payment_intent_id TEXT UNIQUE NOT NULL,
  amount_cents             INTEGER NOT NULL,
  purchased_at             TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, exam_id)
);

CREATE TABLE usage_events (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID REFERENCES users(id) ON DELETE SET NULL,
  event_type    TEXT NOT NULL
                CHECK (event_type IN ('upload_text','upload_pdf_free','upload_pdf_premium',
                                      'generate_questions','generate_curriculum',
                                      'socratic_explanation','classify_exam','generate_embedding')),
  model         TEXT,
  input_tokens  INTEGER DEFAULT 0,
  output_tokens INTEGER DEFAULT 0,
  cost_usd      NUMERIC(10,6) DEFAULT 0,
  metadata      JSONB DEFAULT '{}',
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE audit_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id    UUID REFERENCES users(id) ON DELETE SET NULL,
  action      TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id   UUID,
  metadata    JSONB DEFAULT '{}',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE classification_review_queue (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id       UUID UNIQUE REFERENCES exams(id) ON DELETE CASCADE,
  ai_suggestion TEXT CHECK (ai_suggestion IN ('low','high')),
  ai_confidence NUMERIC(4,3),
  queued_at     TIMESTAMPTZ DEFAULT NOW(),
  reviewed_at   TIMESTAMPTZ,
  reviewed_by   UUID REFERENCES users(id) ON DELETE SET NULL
);

-- Indexes
CREATE INDEX idx_exams_created_by       ON exams(created_by);
CREATE INDEX idx_exams_is_public        ON exams(is_public) WHERE is_public = TRUE;
CREATE INDEX idx_exams_domain           ON exams(domain);
CREATE INDEX idx_exam_topics_exam_id    ON exam_topics(exam_id);
CREATE INDEX idx_questions_exam_id      ON questions(exam_id);
CREATE INDEX idx_questions_topic_id     ON questions(topic_id);
CREATE INDEX idx_user_exams_user_id     ON user_exams(user_id);
CREATE INDEX idx_user_exams_composite   ON user_exams(user_id, exam_id, is_active);
CREATE INDEX idx_mastery_user_topic     ON user_topic_mastery(user_id, topic_id);
CREATE INDEX idx_schedule_user_next     ON user_question_schedule(user_id, next_review_at);
CREATE INDEX idx_sessions_user_exam     ON study_sessions(user_id, exam_id);
CREATE INDEX idx_answer_events_session  ON answer_events(session_id);
CREATE INDEX idx_answer_events_user     ON answer_events(user_id);
CREATE INDEX idx_jobs_exam_id           ON document_jobs(exam_id);
CREATE INDEX idx_jobs_user_id           ON document_jobs(user_id);
CREATE INDEX idx_usage_user_id          ON usage_events(user_id);
CREATE INDEX idx_usage_event_type       ON usage_events(event_type);
CREATE INDEX idx_users_deleted_at       ON users(deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX idx_review_queue_unreviewed ON classification_review_queue(queued_at) WHERE reviewed_at IS NULL;
CREATE INDEX idx_questions_options_gin  ON questions USING gin(options);
CREATE INDEX idx_exams_fts ON exams USING gin(to_tsvector('english', name || ' ' || COALESCE(description, '')));
