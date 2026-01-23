import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { llmClient } from '@/lib/llm-client';
import { apiError, requireApiSession, requireWorkspaceAccess } from "@/lib/api";

interface SearchResult {
  id: string;
  type: 'entity' | 'map' | 'board' | 'event' | 'timeline';
  title: string;
  excerpt?: string;
  url: string;
  entityType?: string;
  tags?: string[];
  score: number;
}

export async function POST(req: NextRequest) {
  try {
    let session;
    try {
      session = await requireApiSession();
    } catch {
      return apiError("Unauthorized", 401);
    }

    const body = await req.json();
    const { workspaceId, query, limit = 20 } = body;

    if (!workspaceId || !query) {
      return apiError("workspaceId and query required", 400);
    }

    try {
      await requireWorkspaceAccess(session.userId, workspaceId, "viewer");
    } catch {
      return apiError("Forbidden", 403);
    }

    // Generate embedding for query
    const queryEmbedding = await llmClient.embed(query);

    // Search across different content types
    const [entities, articles, events, maps] = await Promise.all([
      // Entities
      prisma.$queryRaw<any[]>`
        SELECT
          id, title, type, aliases, tags,
          1 - (embedding <=> ${queryEmbedding}::vector) as score
        FROM "Entity"
        WHERE "workspaceId" = ${workspaceId}
          AND "softDeletedAt" IS NULL
          AND embedding IS NOT NULL
        ORDER BY embedding <=> ${queryEmbedding}::vector
        LIMIT ${Math.floor(limit / 2)}
      `.catch(() => {
        // Fallback to text search if vector extension not available
        return prisma.entity.findMany({
          where: {
            workspaceId,
            softDeletedAt: null,
            OR: [
              { title: { contains: query, mode: 'insensitive' } },
              { aliases: { hasSome: [query] } },
              { tags: { hasSome: [query] } }
            ]
          },
          take: Math.floor(limit / 2)
        }).then(results => results.map(r => ({ ...r, score: 0.5 })));
      }),

      // Articles
      prisma.$queryRaw<any[]>`
        SELECT
          id, title, "bodyMd", "entityId",
          1 - (embedding <=> ${queryEmbedding}::vector) as score
        FROM "ArticleRevision"
        WHERE "workspaceId" = ${workspaceId}
          AND status = 'approved'
          AND "softDeletedAt" IS NULL
          AND embedding IS NOT NULL
        ORDER BY embedding <=> ${queryEmbedding}::vector
        LIMIT ${Math.floor(limit / 4)}
      `.catch(() => {
        return prisma.articleRevision.findMany({
          where: {
            workspaceId,
            status: 'approved',
            softDeletedAt: null,
            OR: [
              { title: { contains: query, mode: 'insensitive' } },
              { bodyMd: { contains: query, mode: 'insensitive' } }
            ]
          },
          take: Math.floor(limit / 4)
        }).then(results => results.map(r => ({ ...r, score: 0.5 })));
      }),

      // Events
      prisma.event.findMany({
        where: {
          workspaceId,
          softDeletedAt: null,
          OR: [
            { title: { contains: query, mode: 'insensitive' } },
            { summaryMd: { contains: query, mode: 'insensitive' } }
          ]
        },
        take: Math.floor(limit / 8)
      }).then(results => results.map(r => ({ ...r, score: 0.5 }))),

      // Maps
      prisma.map.findMany({
        where: {
          workspaceId,
          softDeletedAt: null,
          title: { contains: query, mode: 'insensitive' }
        },
        take: Math.floor(limit / 8)
      }).then(results => results.map(r => ({ ...r, score: 0.5 })))
    ]);

    // Format results
    const entityIdSet = new Set<string>(entities.map((e: any) => e.id));

    const results: SearchResult[] = [
      ...entities.map((e: any) => {
        const aliasText = e.aliases?.length ? `Aliases: ${e.aliases.join(", ")}` : "";
        const tagText = e.tags?.length ? `Tags: ${e.tags.join(", ")}` : "";
        const excerpt = [aliasText, tagText].filter(Boolean).join(" · ");
        return {
          id: e.id,
          type: "entity" as const,
          title: e.title,
          excerpt: excerpt || undefined,
          url: `/wiki/${encodeURIComponent(e.title)}`,
          entityType: e.type,
          tags: e.tags || [],
          score: e.score || 0.5
        };
      }),
      ...articles
        .filter((a: any) => !a.entityId || !entityIdSet.has(a.entityId))
        .map((a: any) => ({
          id: a.entityId || a.id,
          type: "entity" as const,
          title: a.title,
          excerpt: a.bodyMd ? `${a.bodyMd.slice(0, 200)}...` : undefined,
          url: `/wiki/${encodeURIComponent(a.title)}`,
          score: a.score || 0.5
        })),
      ...events.map((e: any) => ({
        id: e.id,
        type: "event" as const,
        title: e.title,
        excerpt: e.summaryMd ? `${e.summaryMd.slice(0, 150)}...` : undefined,
        url: `/timeline?event=${e.id}`,
        score: e.score || 0.5
      })),
      ...maps.map((m: any) => ({
        id: m.id,
        type: "map" as const,
        title: m.title,
        url: `/maps/${m.id}`,
        score: m.score || 0.5
      }))
    ];

    // Sort by score
    results.sort((a, b) => b.score - a.score);

    return NextResponse.json({
      results: results.slice(0, limit),
      total: results.length,
      query,
      hasVectorSearch: entities.length > 0 && entities[0].score !== 0.5
    });
  } catch (error: any) {
    console.error('Semantic search error:', error);
    return NextResponse.json(
      { error: error.message || 'Search failed' },
      { status: 500 }
    );
  }
}
