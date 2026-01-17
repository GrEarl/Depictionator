import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { llmClient } from '@/lib/llm-client';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const workspaceId = searchParams.get('workspaceId');

  if (!workspaceId) {
    return NextResponse.json({ error: 'workspaceId required' }, { status: 400 });
  }

  try {
    // Load comprehensive world context
    const [entities, articles, events, maps, relationships] = await Promise.all([
      prisma.entity.findMany({
        where: { workspaceId, softDeletedAt: null },
        select: {
          id: true,
          title: true,
          type: true,
          aliases: true,
          tags: true,
        },
        take: 200
      }),
      prisma.articleRevision.findMany({
        where: {
          workspaceId,
          status: 'approved'
        },
        select: {
          id: true,
          title: true,
          bodyMd: true,
          articleId: true
        },
        take: 100
      }),
      prisma.event.findMany({
        where: { workspaceId, softDeletedAt: null },
        select: {
          id: true,
          title: true,
          summaryMd: true,
          worldStart: true,
          worldEnd: true,
          storyOrder: true
        },
        take: 100
      }),
      prisma.map.findMany({
        where: { workspaceId, softDeletedAt: null },
        select: {
          id: true,
          title: true
        },
        take: 50
      }),
      prisma.entityRelation.findMany({
        where: { workspaceId, softDeletedAt: null },
        select: {
          fromEntityId: true,
          toEntityId: true,
          relationType: true,
          description: true
        },
        take: 200
      })
    ]);

    return NextResponse.json({
      entities,
      articles,
      events,
      maps,
      relationships
    });
  } catch (error) {
    console.error('Failed to load world context:', error);
    return NextResponse.json(
      { error: 'Failed to load world context' },
      { status: 500 }
    );
  }
}
