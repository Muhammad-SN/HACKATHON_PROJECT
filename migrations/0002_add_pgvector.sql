-- migrations/0002_add_pgvector.sql
-- Aurora PostgreSQL 15.3+ includes pgvector natively

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE question_embeddings (
  question_id UUID PRIMARY KEY REFERENCES questions(id) ON DELETE CASCADE,
  embedding   vector(1536) NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- HNSW index: m=16 (graph connections), ef_construction=64 (build quality)
CREATE INDEX idx_question_embeddings_hnsw
  ON question_embeddings USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);
