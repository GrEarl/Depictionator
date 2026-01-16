-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Add embedding column to Entity
ALTER TABLE "Entity" ADD COLUMN IF NOT EXISTS "embedding" vector(768);

-- Add embedding column to ArticleRevision
ALTER TABLE "ArticleRevision" ADD COLUMN IF NOT EXISTS "embedding" vector(768);
ALTER TABLE "ArticleRevision" ADD COLUMN IF NOT EXISTS "title" TEXT NOT NULL DEFAULT '';
ALTER TABLE "ArticleRevision" ADD COLUMN IF NOT EXISTS "softDeletedAt" TIMESTAMP(3);

-- Create indexes for vector similarity search
CREATE INDEX IF NOT EXISTS "Entity_embedding_idx" ON "Entity" USING ivfflat ("embedding" vector_cosine_ops) WITH (lists = 100);
CREATE INDEX IF NOT EXISTS "ArticleRevision_embedding_idx" ON "ArticleRevision" USING ivfflat ("embedding" vector_cosine_ops) WITH (lists = 100);
