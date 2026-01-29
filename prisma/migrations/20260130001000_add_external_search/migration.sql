-- CreateEnum
CREATE TYPE "SearchJobStatus" AS ENUM ('pending', 'searching', 'processing', 'completed', 'failed');

-- CreateEnum
CREATE TYPE "ExternalSourceType" AS ENUM ('google_search', 'wikipedia', 'wikimedia_commons', 'wikidata', 'youtube', 'flickr', 'freesound', 'internet_archive', 'academic', 'other');

-- CreateEnum
CREATE TYPE "SearchMode" AS ENUM ('standard', 'extended', 'deep');

-- AlterTable
ALTER TABLE "Entity" ADD COLUMN "technicalSpecsJson" TEXT;

-- CreateTable
CREATE TABLE "ExternalSearchJob" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "entityId" TEXT,
    "query" TEXT NOT NULL,
    "entityType" "EntityType" NOT NULL,
    "searchMode" "SearchMode" NOT NULL DEFAULT 'standard',
    "status" "SearchJobStatus" NOT NULL DEFAULT 'pending',
    "sourcesConfig" TEXT NOT NULL,
    "resultsJson" TEXT,
    "technicalSpecs" TEXT,
    "deepResearchText" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "createdById" TEXT,

    CONSTRAINT "ExternalSearchJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExternalSource" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "jobId" TEXT,
    "sourceType" "ExternalSourceType" NOT NULL,
    "url" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "snippet" TEXT,
    "contentJson" TEXT,
    "mediaUrls" TEXT[] NOT NULL,
    "relevanceScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "licenseId" TEXT,
    "licenseUrl" TEXT,
    "author" TEXT,
    "publishedAt" TIMESTAMP(3),
    "retrievedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "imported" BOOLEAN NOT NULL DEFAULT false,
    "importedAssetId" TEXT,
    "metadata" TEXT,

    CONSTRAINT "ExternalSource_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ExternalSearchJob_workspaceId_status_idx" ON "ExternalSearchJob"("workspaceId", "status");

-- CreateIndex
CREATE INDEX "ExternalSearchJob_entityId_idx" ON "ExternalSearchJob"("entityId");

-- CreateIndex
CREATE INDEX "ExternalSource_workspaceId_sourceType_idx" ON "ExternalSource"("workspaceId", "sourceType");

-- CreateIndex
CREATE INDEX "ExternalSource_jobId_idx" ON "ExternalSource"("jobId");

-- AddForeignKey
ALTER TABLE "ExternalSearchJob" ADD CONSTRAINT "ExternalSearchJob_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalSearchJob" ADD CONSTRAINT "ExternalSearchJob_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "Entity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalSource" ADD CONSTRAINT "ExternalSource_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalSource" ADD CONSTRAINT "ExternalSource_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "ExternalSearchJob"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalSource" ADD CONSTRAINT "ExternalSource_importedAssetId_fkey" FOREIGN KEY ("importedAssetId") REFERENCES "Asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
