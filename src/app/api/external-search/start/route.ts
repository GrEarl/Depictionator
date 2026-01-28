import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiSession, requireWorkspaceAccess, apiError } from "@/lib/api";
import { logAudit } from "@/lib/audit";
import {
  executeExternalSearch,
  synthesizeFromExternalSources,
  type ExternalSearchOptions,
  DEFAULT_SEARCH_OPTIONS,
} from "@/lib/external-search";
import type { EntityType, SearchJobStatus } from "@prisma/client";
import type { LlmProvider } from "@/lib/llm";

const DEFAULT_LLM_PROVIDER = (process.env.WIKI_LLM_PROVIDER ?? process.env.LLM_DEFAULT_PROVIDER ?? "gemini_ai") as LlmProvider;

function parseBooleanValue(input: FormDataEntryValue | null, fallback: boolean) {
  const normalized = String(input ?? "").trim().toLowerCase();
  if (!normalized) return fallback;
  if (["true", "1", "yes", "on"].includes(normalized)) return true;
  if (["false", "0", "no", "off"].includes(normalized)) return false;
  return fallback;
}

/**
 * POST /api/external-search/start
 * Start an external search job
 */
export async function POST(request: Request) {
  let session;
  try {
    session = await requireApiSession();
  } catch {
    return apiError("Unauthorized", 401);
  }

  const form = await request.formData();
  const workspaceId = String(form.get("workspaceId") ?? "").trim();
  const query = String(form.get("query") ?? "").trim();
  const entityType = String(form.get("entityType") ?? "concept").trim().toLowerCase() as EntityType;
  const entityId = String(form.get("entityId") ?? "").trim() || null;
  const targetLang = String(form.get("targetLang") ?? "en").trim();
  const llmProviderRaw = String(form.get("llmProvider") ?? "").trim();
  const llmProvider = (llmProviderRaw || DEFAULT_LLM_PROVIDER) as LlmProvider;
  const existingContext = String(form.get("existingContext") ?? "").trim();

  // Parse source options
  const sourcesConfig: ExternalSearchOptions["sources"] = {
    googleSearch: parseBooleanValue(form.get("source_googleSearch"), true),
    wikipedia: parseBooleanValue(form.get("source_wikipedia"), true),
    wikimediaCommons: parseBooleanValue(form.get("source_wikimediaCommons"), true),
    wikidata: parseBooleanValue(form.get("source_wikidata"), false),
    youtube: parseBooleanValue(form.get("source_youtube"), false),
    flickr: parseBooleanValue(form.get("source_flickr"), false),
    freesound: parseBooleanValue(form.get("source_freesound"), false),
  };

  // Parse additional options
  const options: Partial<ExternalSearchOptions> = {
    sources: sourcesConfig,
    maxResultsPerSource: Number(form.get("maxResultsPerSource")) || DEFAULT_SEARCH_OPTIONS.maxResultsPerSource,
    extractTechnicalSpecs: parseBooleanValue(form.get("extractTechnicalSpecs"), true),
    modelingFocus: parseBooleanValue(form.get("modelingFocus"), false),
    requireLicense: parseBooleanValue(form.get("requireLicense"), true),
    minRelevanceScore: Number(form.get("minRelevanceScore")) || DEFAULT_SEARCH_OPTIONS.minRelevanceScore,
    targetLang,
  };

  if (!workspaceId || !query) {
    return apiError("Missing workspaceId or query", 400);
  }

  try {
    await requireWorkspaceAccess(session.userId, workspaceId, "editor");
  } catch {
    return apiError("Forbidden", 403);
  }

  // Create search job
  const job = await prisma.externalSearchJob.create({
    data: {
      workspaceId,
      entityId,
      query,
      entityType: entityType as EntityType,
      status: "searching",
      sourcesConfig: JSON.stringify(options),
      createdById: session.userId,
    },
  });

  // Execute search asynchronously (in production, use a job queue)
  // For now, we'll do it synchronously but return immediately
  (async () => {
    try {
      const result = await executeExternalSearch(
        query,
        entityType as EntityType,
        existingContext,
        options,
        llmProvider
      );

      // Store sources in database
      for (const source of result.sources) {
        await prisma.externalSource.create({
          data: {
            workspaceId,
            jobId: job.id,
            sourceType: source.sourceType as any,
            url: source.url,
            title: source.title,
            snippet: source.snippet,
            contentJson: source.content ? JSON.stringify({ content: source.content }) : null,
            mediaUrls: source.mediaUrls || [],
            relevanceScore: source.relevanceScore,
            licenseId: source.licenseId,
            licenseUrl: source.licenseUrl,
            author: source.author,
            publishedAt: source.publishedAt,
            retrievedAt: source.retrievedAt,
            verified: source.verified,
            metadata: source.metadata ? JSON.stringify(source.metadata) : null,
          },
        });
      }

      // Update job with results
      await prisma.externalSearchJob.update({
        where: { id: job.id },
        data: {
          status: "completed",
          resultsJson: JSON.stringify({
            sourceCount: result.sources.length,
            mediaAssetCount: result.mediaAssets.length,
            mediaAssets: result.mediaAssets,
          }),
          technicalSpecs: result.technicalSpecs ? JSON.stringify(result.technicalSpecs) : null,
          completedAt: new Date(),
        },
      });

      await logAudit({
        workspaceId,
        actorUserId: session.userId,
        action: "search",
        targetType: "external_search_job",
        targetId: job.id,
        meta: { query, sourceCount: result.sources.length },
      });
    } catch (error) {
      await prisma.externalSearchJob.update({
        where: { id: job.id },
        data: {
          status: "failed",
          errorMessage: (error as Error).message,
          completedAt: new Date(),
        },
      });
    }
  })();

  return NextResponse.json({
    jobId: job.id,
    status: "searching",
    message: "Search started. Poll /api/external-search/status/:jobId for results.",
  });
}

/**
 * GET /api/external-search/start
 * Not allowed
 */
export async function GET() {
  return apiError("Method not allowed. Use POST to start a search.", 405);
}
