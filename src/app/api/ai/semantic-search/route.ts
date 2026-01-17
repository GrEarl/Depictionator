import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { llmClient } from '@/lib/llm-client';

interface SearchResult {
  id: string;
  type: 'entity' | 'article' | 'event' | 'map';
  title: string;
  snippet: string;
  score: number;
  metadata?: any;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { workspaceId, query, limit = 20 } = body;

    if (!workspaceId || !query) {
      return NextResponse.json(
        { error: 'workspaceId and query required' },
        { status: 400 }
      );
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
          OR: [
            { title: { contains: query, mode: 'insensitive' } },
            { summaryMd: { contains: query, mode: 'insensitive' } }
          ]
        },
        take: Math.floor(limit / 8)
      }).then(results => results.map(r => ({ ...r, score: 0.5 })))
    ]);

    // Format results
    const results: SearchResult[] = [
      ...entities.map((e: any) => ({
        id: e.id,
        type: 'entity' as const,
        title: e.title,
        snippet: `[${e.type}] ${e.aliases?.join(', ') || ''} | Tags: ${e.tags?.join(', ') || ''}`,
        score: e.score || 0.5,
        metadata: { type: e.type, aliases: e.aliases, tags: e.tags }
      })),
      ...articles.map((a: any) => ({
        id: a.id,
        type: 'article' as const,
        title: a.title,
        snippet: a.bodyMd?.slice(0, 200) + '...',
        score: a.score || 0.5,
        metadata: { entityId: a.entityId }
      })),
      ...events.map((e: any) => ({
        id: e.id,
        type: 'event' as const,
        title: e.title,
        snippet: `${e.worldStart || 'unknown date'}: ${e.summaryMd?.slice(0, 150) || ''}...`,
        score: e.score || 0.5,
        metadata: { worldStart: e.worldStart, worldEnd: e.worldEnd }
      })),
      ...maps.map((m: any) => ({
        id: m.id,
        type: 'map' as const,
        title: m.title,
        snippet: m.summaryMd?.slice(0, 200) || '',
        score: m.score || 0.5,
        metadata: {}
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
