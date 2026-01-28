import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiSession, requireWorkspaceAccess, apiError } from "@/lib/api";

/**
 * GET /api/external-search/status/:jobId
 * Get the status and results of an external search job
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ jobId: string }> }
) {
  let session;
  try {
    session = await requireApiSession();
  } catch {
    return apiError("Unauthorized", 401);
  }

  const { jobId } = await params;

  if (!jobId) {
    return apiError("Missing jobId", 400);
  }

  const job = await prisma.externalSearchJob.findUnique({
    where: { id: jobId },
    include: {
      externalSources: {
        orderBy: { relevanceScore: "desc" },
      },
    },
  });

  if (!job) {
    return apiError("Job not found", 404);
  }

  try {
    await requireWorkspaceAccess(session.userId, job.workspaceId, "viewer");
  } catch {
    return apiError("Forbidden", 403);
  }

  // Parse stored JSON
  let resultsJson = null;
  let technicalSpecs = null;

  try {
    if (job.resultsJson) {
      resultsJson = JSON.parse(job.resultsJson);
    }
  } catch {
    // ignore parse errors
  }

  try {
    if (job.technicalSpecs) {
      technicalSpecs = JSON.parse(job.technicalSpecs);
    }
  } catch {
    // ignore parse errors
  }

  // Format sources for response
  const sources = job.externalSources.map((source) => {
    let metadata = null;
    try {
      if (source.metadata) {
        metadata = JSON.parse(source.metadata);
      }
    } catch {
      // ignore
    }

    return {
      id: source.id,
      sourceType: source.sourceType,
      url: source.url,
      title: source.title,
      snippet: source.snippet,
      relevanceScore: source.relevanceScore,
      licenseId: source.licenseId,
      author: source.author,
      verified: source.verified,
      imported: source.imported,
      mediaUrls: source.mediaUrls,
      metadata,
    };
  });

  return NextResponse.json({
    jobId: job.id,
    status: job.status,
    query: job.query,
    entityType: job.entityType,
    entityId: job.entityId,
    createdAt: job.createdAt.toISOString(),
    completedAt: job.completedAt?.toISOString() || null,
    errorMessage: job.errorMessage,
    sources,
    sourceCount: sources.length,
    results: resultsJson,
    technicalSpecs,
  });
}
