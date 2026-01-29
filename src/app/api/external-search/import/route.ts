import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiSession, requireWorkspaceAccess, apiError } from "@/lib/api";
import { logAudit } from "@/lib/audit";
import { fetchWikiImageInfo, safeFilename } from "@/lib/wiki";
import { synthesizeFromExternalSources, type TechnicalSpecs } from "@/lib/external-search";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import type { LlmProvider } from "@/lib/llm";
import { EntityType, SourceTargetType } from "@prisma/client";

const DEFAULT_LLM_PROVIDER = (process.env.WIKI_LLM_PROVIDER ?? process.env.LLM_DEFAULT_PROVIDER ?? "gemini_ai") as LlmProvider;

/**
 * POST /api/external-search/import
 * Import selected sources and media into an entity
 */
export async function POST(request: Request) {
  let session;
  try {
    session = await requireApiSession();
  } catch {
    return apiError("Unauthorized", 401);
  }

  const body = await request.json();
  const {
    workspaceId,
    jobId,
    entityId,
    sourceIds,
    createEntity,
    entityTitle,
    entityType,
    targetLang,
    importMedia,
    synthesizeArticle,
    llmProvider: llmProviderRaw,
  } = body as {
    workspaceId: string;
    jobId: string;
    entityId?: string;
    sourceIds: string[];
    createEntity?: boolean;
    entityTitle?: string;
    entityType?: string;
    targetLang?: string;
    importMedia?: boolean;
    synthesizeArticle?: boolean;
    llmProvider?: string;
  };

  if (!workspaceId || !jobId) {
    return apiError("Missing workspaceId or jobId", 400);
  }

  try {
    await requireWorkspaceAccess(session.userId, workspaceId, "editor");
  } catch {
    return apiError("Forbidden", 403);
  }

  // Get the job and sources
  const job = await prisma.externalSearchJob.findUnique({
    where: { id: jobId },
    include: {
      externalSources: sourceIds?.length
        ? { where: { id: { in: sourceIds } } }
        : { where: { relevanceScore: { gte: 0.3 } } },
    },
  });

  if (!job) {
    return apiError("Job not found", 404);
  }

  if (job.workspaceId !== workspaceId) {
    return apiError("Job does not belong to this workspace", 403);
  }

  const sources = job.externalSources;
  if (sources.length === 0) {
    return apiError("No sources to import", 400);
  }

  const llmProvider = (llmProviderRaw || DEFAULT_LLM_PROVIDER) as LlmProvider;
  const lang = targetLang || "en";

  // Create or get entity
  let entity;
  if (createEntity && entityTitle) {
    const type = (Object.values(EntityType) as string[]).includes(entityType || "")
      ? (entityType as EntityType)
      : EntityType.concept;

    entity = await prisma.entity.create({
      data: {
        workspaceId,
        type,
        title: entityTitle,
        aliases: [],
        tags: ["imported", "external-search"],
        status: "draft",
        createdById: session.userId,
        updatedById: session.userId,
      },
    });
  } else if (entityId) {
    entity = await prisma.entity.findUnique({
      where: { id: entityId },
    });
    if (!entity || entity.workspaceId !== workspaceId) {
      return apiError("Entity not found", 404);
    }
  } else {
    return apiError("Must provide entityId or createEntity with entityTitle", 400);
  }

  const importedAssets: Array<{ id: string; title: string; sourceType: string }> = [];
  const importedSourceIds: string[] = [];

  // Import media from sources
  if (importMedia !== false) {
    for (const source of sources) {
      // Import media URLs from each source
      const mediaUrls = source.mediaUrls || [];

      for (const mediaUrl of mediaUrls.slice(0, 5)) {
        try {
          const urlParts = new URL(mediaUrl);
          const host = urlParts.hostname.toLowerCase();
          const isWikiHost = host.endsWith(".wikimedia.org") || host.endsWith(".wikipedia.org");
          if (!isWikiHost) {
            continue;
          }

          // For Wikimedia Commons URLs, extract the file info
          {
            const pathParts = urlParts.pathname.split("/");
            const filename = decodeURIComponent(pathParts[pathParts.length - 1]);

            const imageInfo = await fetchWikiImageInfo("commons", filename);
            if (!imageInfo) continue;

            // Download and store
            const download = await fetch(imageInfo.url);
            if (!download.ok) continue;

            const buffer = Buffer.from(await download.arrayBuffer());
            const storageDir = path.join(process.cwd(), "storage", workspaceId);
            await mkdir(storageDir, { recursive: true });
            const storageKey = `${Date.now()}-${safeFilename(imageInfo.title)}`;
            await writeFile(path.join(storageDir, storageKey), buffer);

            const asset = await prisma.asset.create({
              data: {
                workspaceId,
                kind: imageInfo.mime.startsWith("image/") ? "image" : "file",
                storageKey,
                mimeType: imageInfo.mime,
                size: imageInfo.size ?? buffer.length,
                width: imageInfo.width,
                height: imageInfo.height,
                createdById: session.userId,
                sourceUrl: imageInfo.url,
                author: imageInfo.author,
                licenseId: imageInfo.licenseId,
                licenseUrl: imageInfo.licenseUrl,
                attributionText: imageInfo.attributionText,
                retrievedAt: new Date(),
              },
            });

            // Update external source with imported asset
            await prisma.externalSource.update({
              where: { id: source.id },
              data: {
                imported: true,
                importedAssetId: asset.id,
              },
            });

            importedAssets.push({
              id: asset.id,
              title: imageInfo.title,
              sourceType: source.sourceType,
            });
          }
        } catch (error) {
          console.error("Failed to import media:", mediaUrl, error);
        }
      }

      importedSourceIds.push(source.id);
    }
  }

  // Synthesize article if requested
  let articleBody: string | null = null;
  if (synthesizeArticle) {
    // Convert DB sources to the format expected by synthesize function
    const sourcesForSynthesis = sources.map((s) => ({
      id: s.id,
      sourceType: s.sourceType as any,
      url: s.url,
      title: s.title,
      snippet: s.snippet || undefined,
      content: s.contentJson ? JSON.parse(s.contentJson).content : undefined,
      relevanceScore: s.relevanceScore,
      licenseId: s.licenseId || undefined,
      author: s.author || undefined,
      retrievedAt: s.retrievedAt,
      verified: s.verified,
    }));

    // Get technical specs from job
    let technicalSpecs: TechnicalSpecs | undefined;
    if (job.technicalSpecs) {
      try {
        technicalSpecs = JSON.parse(job.technicalSpecs);
      } catch {
        // ignore
      }
    }

    articleBody = await synthesizeFromExternalSources(
      entity.title,
      entity.type,
      sourcesForSynthesis,
      lang,
      technicalSpecs,
      llmProvider
    );

    // Create article and revision
    let article = await prisma.article.findUnique({
      where: { entityId: entity.id },
    });

    if (!article) {
      article = await prisma.article.create({
        data: {
          entityId: entity.id,
          workspaceId,
        },
      });
    }

    const revision = await prisma.articleRevision.create({
      data: {
        workspaceId,
        targetType: "base",
        articleId: article.entityId,
        bodyMd: articleBody,
        changeSummary: `Synthesized from ${sources.length} external sources`,
        createdById: session.userId,
        status: "draft",
      },
    });

    // Create source records for each imported source
    for (const source of sources) {
      await prisma.sourceRecord.create({
        data: {
          workspaceId,
          targetType: SourceTargetType.article_revision,
          targetId: revision.id,
          sourceUrl: source.url,
          title: source.title,
          author: source.author,
          licenseId: source.licenseId,
          licenseUrl: source.licenseUrl,
          retrievedAt: source.retrievedAt,
          note: `sourceType=${source.sourceType}`,
          createdById: session.userId,
        },
      });
    }

    // Update entity with technical specs if available
    if (job.technicalSpecs) {
      await prisma.entity.update({
        where: { id: entity.id },
        data: {
          technicalSpecsJson: job.technicalSpecs,
        },
      });
    }
  }

  // Mark sources as imported
  await prisma.externalSource.updateMany({
    where: { id: { in: importedSourceIds } },
    data: { imported: true },
  });

  await logAudit({
    workspaceId,
    actorUserId: session.userId,
    action: "import",
    targetType: "entity",
    targetId: entity.id,
    meta: {
      source: "external_search",
      jobId,
      sourceCount: sources.length,
      assetCount: importedAssets.length,
    },
  });

  return NextResponse.json({
    success: true,
    entityId: entity.id,
    entityTitle: entity.title,
    importedSources: importedSourceIds.length,
    importedAssets: importedAssets.length,
    assets: importedAssets,
    articleCreated: !!articleBody,
  });
}
