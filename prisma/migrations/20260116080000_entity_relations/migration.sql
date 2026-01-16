-- Entity enhancements: parent, main image, summary
ALTER TABLE "Entity" ADD COLUMN IF NOT EXISTS "parentEntityId" TEXT;
ALTER TABLE "Entity" ADD COLUMN IF NOT EXISTS "mainImageId" TEXT;
ALTER TABLE "Entity" ADD COLUMN IF NOT EXISTS "summaryMd" TEXT;

-- Foreign keys for entity self-reference and main image
ALTER TABLE "Entity" ADD CONSTRAINT "Entity_parentEntityId_fkey" FOREIGN KEY ("parentEntityId") REFERENCES "Entity"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Entity" ADD CONSTRAINT "Entity_mainImageId_fkey" FOREIGN KEY ("mainImageId") REFERENCES "Asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Relation type enum
CREATE TYPE "RelationType" AS ENUM (
  'member_of',
  'allied_with',
  'enemy_of',
  'parent_of',
  'child_of',
  'sibling_of',
  'located_in',
  'owns',
  'created_by',
  'participated_in',
  'related_to',
  'custom'
);

-- Entity relations table
CREATE TABLE "EntityRelation" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "fromEntityId" TEXT NOT NULL,
  "toEntityId" TEXT NOT NULL,
  "relationType" "RelationType" NOT NULL,
  "customLabel" TEXT,
  "description" TEXT,
  "worldFrom" TEXT,
  "worldTo" TEXT,
  "storyFromChapterId" TEXT,
  "storyToChapterId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "softDeletedAt" TIMESTAMP(3),

  CONSTRAINT "EntityRelation_pkey" PRIMARY KEY ("id")
);

-- Foreign keys
ALTER TABLE "EntityRelation" ADD CONSTRAINT "EntityRelation_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EntityRelation" ADD CONSTRAINT "EntityRelation_fromEntityId_fkey" FOREIGN KEY ("fromEntityId") REFERENCES "Entity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EntityRelation" ADD CONSTRAINT "EntityRelation_toEntityId_fkey" FOREIGN KEY ("toEntityId") REFERENCES "Entity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Indexes
CREATE INDEX "EntityRelation_workspaceId_fromEntityId_idx" ON "EntityRelation"("workspaceId", "fromEntityId");
CREATE INDEX "EntityRelation_workspaceId_toEntityId_idx" ON "EntityRelation"("workspaceId", "toEntityId");
