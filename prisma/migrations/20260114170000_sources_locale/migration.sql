-- Add UI locale and source records
CREATE TYPE "UiLocale" AS ENUM ('ja', 'en');
ALTER TABLE "User" ADD COLUMN "locale" "UiLocale" NOT NULL DEFAULT 'ja';

CREATE TYPE "SourceTargetType" AS ENUM ('entity', 'article_revision', 'overlay_revision', 'map', 'asset', 'event', 'timeline');

CREATE TABLE "SourceRecord" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "targetType" "SourceTargetType" NOT NULL,
  "targetId" TEXT NOT NULL,
  "sourceUrl" TEXT NOT NULL,
  "title" TEXT,
  "author" TEXT,
  "licenseId" TEXT,
  "licenseUrl" TEXT,
  "attributionText" TEXT,
  "retrievedAt" TIMESTAMP(3) NOT NULL,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdById" TEXT,
  CONSTRAINT "SourceRecord_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "SourceRecord" ADD CONSTRAINT "SourceRecord_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SourceRecord" ADD CONSTRAINT "SourceRecord_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "SourceRecord_workspaceId_targetType_targetId_idx" ON "SourceRecord"("workspaceId", "targetType", "targetId");
