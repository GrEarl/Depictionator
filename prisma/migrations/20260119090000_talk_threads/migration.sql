CREATE TABLE IF NOT EXISTS "TalkThread" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "softDeletedAt" TIMESTAMP(3),
  CONSTRAINT "TalkThread_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "TalkComment" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "threadId" TEXT NOT NULL,
  "bodyMd" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdById" TEXT,
  "softDeletedAt" TIMESTAMP(3),
  CONSTRAINT "TalkComment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "TalkThread_workspaceId_entityId_idx" ON "TalkThread"("workspaceId", "entityId");
CREATE INDEX IF NOT EXISTS "TalkComment_workspaceId_threadId_idx" ON "TalkComment"("workspaceId", "threadId");

ALTER TABLE "TalkThread" ADD CONSTRAINT "TalkThread_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TalkThread" ADD CONSTRAINT "TalkThread_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "Entity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TalkThread" ADD CONSTRAINT "TalkThread_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "TalkComment" ADD CONSTRAINT "TalkComment_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TalkComment" ADD CONSTRAINT "TalkComment_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "TalkThread"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TalkComment" ADD CONSTRAINT "TalkComment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
