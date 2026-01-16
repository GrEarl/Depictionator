-- Add map layers, scenes, evidence boards, references, and citations
CREATE TYPE "EvidenceItemType" AS ENUM ('entity', 'asset', 'reference', 'note', 'url', 'quote', 'frame');
CREATE TYPE "EvidenceLinkStyle" AS ENUM ('line', 'arrow', 'dashed', 'dotted');
CREATE TYPE "ReferenceType" AS ENUM ('url', 'book', 'pdf', 'image', 'file', 'internal', 'other');
CREATE TYPE "CitationTargetType" AS ENUM ('article_revision', 'overlay_revision', 'entity', 'map', 'event', 'timeline', 'board_item', 'evidence_board');

ALTER TABLE "Pin" ADD COLUMN "layerId" TEXT;
ALTER TABLE "Path" ADD COLUMN "layerId" TEXT;

CREATE TABLE "MapLayer" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "mapId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "color" TEXT,
  "sortIndex" INTEGER,
  "isDefault" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "softDeletedAt" TIMESTAMP(3),
  CONSTRAINT "MapLayer_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MapScene" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "mapId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "chapterId" TEXT,
  "eraId" TEXT,
  "viewpointId" TEXT,
  "state" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "softDeletedAt" TIMESTAMP(3),
  CONSTRAINT "MapScene_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EvidenceBoard" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "softDeletedAt" TIMESTAMP(3),
  CONSTRAINT "EvidenceBoard_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EvidenceItem" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "boardId" TEXT NOT NULL,
  "type" "EvidenceItemType" NOT NULL,
  "title" TEXT,
  "content" TEXT,
  "url" TEXT,
  "entityId" TEXT,
  "assetId" TEXT,
  "referenceId" TEXT,
  "x" DOUBLE PRECISION NOT NULL,
  "y" DOUBLE PRECISION NOT NULL,
  "width" DOUBLE PRECISION,
  "height" DOUBLE PRECISION,
  "rotation" DOUBLE PRECISION,
  "zIndex" INTEGER,
  "data" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "softDeletedAt" TIMESTAMP(3),
  CONSTRAINT "EvidenceItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EvidenceLink" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "boardId" TEXT NOT NULL,
  "fromItemId" TEXT NOT NULL,
  "toItemId" TEXT NOT NULL,
  "label" TEXT,
  "style" "EvidenceLinkStyle" NOT NULL DEFAULT 'line',
  "data" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "softDeletedAt" TIMESTAMP(3),
  CONSTRAINT "EvidenceLink_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Reference" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "type" "ReferenceType" NOT NULL,
  "title" TEXT NOT NULL,
  "author" TEXT,
  "year" TEXT,
  "publisher" TEXT,
  "sourceUrl" TEXT,
  "summary" TEXT,
  "notes" TEXT,
  "tags" TEXT[] NOT NULL,
  "assetId" TEXT,
  "licenseId" TEXT,
  "licenseUrl" TEXT,
  "attributionText" TEXT,
  "retrievedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "softDeletedAt" TIMESTAMP(3),
  CONSTRAINT "Reference_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Citation" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "referenceId" TEXT NOT NULL,
  "targetType" "CitationTargetType" NOT NULL,
  "targetId" TEXT NOT NULL,
  "quote" TEXT,
  "locator" TEXT,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "softDeletedAt" TIMESTAMP(3),
  "evidenceBoardId" TEXT,
  "evidenceItemId" TEXT,
  "eventId" TEXT,
  "timelineId" TEXT,
  "mapId" TEXT,
  CONSTRAINT "Citation_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "MapLayer" ADD CONSTRAINT "MapLayer_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MapLayer" ADD CONSTRAINT "MapLayer_mapId_fkey" FOREIGN KEY ("mapId") REFERENCES "Map"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "MapScene" ADD CONSTRAINT "MapScene_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MapScene" ADD CONSTRAINT "MapScene_mapId_fkey" FOREIGN KEY ("mapId") REFERENCES "Map"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MapScene" ADD CONSTRAINT "MapScene_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "Chapter"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MapScene" ADD CONSTRAINT "MapScene_eraId_fkey" FOREIGN KEY ("eraId") REFERENCES "Era"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MapScene" ADD CONSTRAINT "MapScene_viewpointId_fkey" FOREIGN KEY ("viewpointId") REFERENCES "Viewpoint"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "EvidenceBoard" ADD CONSTRAINT "EvidenceBoard_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "EvidenceItem" ADD CONSTRAINT "EvidenceItem_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EvidenceItem" ADD CONSTRAINT "EvidenceItem_boardId_fkey" FOREIGN KEY ("boardId") REFERENCES "EvidenceBoard"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EvidenceItem" ADD CONSTRAINT "EvidenceItem_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "Entity"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "EvidenceItem" ADD CONSTRAINT "EvidenceItem_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "EvidenceItem" ADD CONSTRAINT "EvidenceItem_referenceId_fkey" FOREIGN KEY ("referenceId") REFERENCES "Reference"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "EvidenceLink" ADD CONSTRAINT "EvidenceLink_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EvidenceLink" ADD CONSTRAINT "EvidenceLink_boardId_fkey" FOREIGN KEY ("boardId") REFERENCES "EvidenceBoard"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EvidenceLink" ADD CONSTRAINT "EvidenceLink_fromItemId_fkey" FOREIGN KEY ("fromItemId") REFERENCES "EvidenceItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EvidenceLink" ADD CONSTRAINT "EvidenceLink_toItemId_fkey" FOREIGN KEY ("toItemId") REFERENCES "EvidenceItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Reference" ADD CONSTRAINT "Reference_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Reference" ADD CONSTRAINT "Reference_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Citation" ADD CONSTRAINT "Citation_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Citation" ADD CONSTRAINT "Citation_referenceId_fkey" FOREIGN KEY ("referenceId") REFERENCES "Reference"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Citation" ADD CONSTRAINT "Citation_evidenceBoardId_fkey" FOREIGN KEY ("evidenceBoardId") REFERENCES "EvidenceBoard"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Citation" ADD CONSTRAINT "Citation_evidenceItemId_fkey" FOREIGN KEY ("evidenceItemId") REFERENCES "EvidenceItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Citation" ADD CONSTRAINT "Citation_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Citation" ADD CONSTRAINT "Citation_timelineId_fkey" FOREIGN KEY ("timelineId") REFERENCES "Timeline"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Citation" ADD CONSTRAINT "Citation_mapId_fkey" FOREIGN KEY ("mapId") REFERENCES "Map"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Pin" ADD CONSTRAINT "Pin_layerId_fkey" FOREIGN KEY ("layerId") REFERENCES "MapLayer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Path" ADD CONSTRAINT "Path_layerId_fkey" FOREIGN KEY ("layerId") REFERENCES "MapLayer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "MapLayer_workspaceId_mapId_idx" ON "MapLayer"("workspaceId", "mapId");
CREATE INDEX "MapScene_workspaceId_mapId_idx" ON "MapScene"("workspaceId", "mapId");
CREATE INDEX "EvidenceBoard_workspaceId_idx" ON "EvidenceBoard"("workspaceId");
CREATE INDEX "EvidenceItem_workspaceId_boardId_idx" ON "EvidenceItem"("workspaceId", "boardId");
CREATE INDEX "EvidenceLink_workspaceId_boardId_idx" ON "EvidenceLink"("workspaceId", "boardId");
CREATE INDEX "Reference_workspaceId_idx" ON "Reference"("workspaceId");
CREATE INDEX "Citation_workspaceId_targetType_targetId_idx" ON "Citation"("workspaceId", "targetType", "targetId");
