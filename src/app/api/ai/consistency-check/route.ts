import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { llmClient } from '@/lib/llm-client';
import { LLM_PROMPTS, LLM_SCHEMAS, ConsistencyIssue } from '@/lib/llm-tools';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { workspaceId, scope } = body;

    if (!workspaceId) {
      return NextResponse.json(
        { error: 'workspaceId required' },
        { status: 400 }
      );
    }

    // Load world content based on scope
    const [entities, articles, events, relationships] = await Promise.all([
      prisma.entity.findMany({
        where: { workspaceId, softDeletedAt: null },
        select: {
          id: true,
          title: true,
          type: true,
          tags: true
        },
        take: scope === 'full' ? 200 : 50
      }),
      prisma.articleRevision.findMany({
        where: {
          workspaceId,
          status: 'approved',
          softDeletedAt: null
        },
        select: {
          id: true,
          title: true,
          bodyMd: true,
          entityId: true
        },
        take: scope === 'full' ? 100 : 30
      }),
      prisma.event.findMany({
        where: { workspaceId, softDeletedAt: null },
        select: {
          id: true,
          title: true,
          description: true,
          worldStart: true,
          worldEnd: true,
          storyOrder: true,
          participantEntities: true
        },
        take: scope === 'full' ? 100 : 30
      }),
      prisma.entityRelation.findMany({
        where: { workspaceId, softDeletedAt: null },
        select: {
          fromEntityId: true,
          toEntityId: true,
          relationType: true,
          description: true
        },
        take: scope === 'full' ? 200 : 50
      })
    ]);

    // Build comprehensive context
    const worldContext = `
# World Overview
Total Entities: ${entities.length}
Total Articles: ${articles.length}
Total Events: ${events.length}

## Entities
${entities.map(e => `- [${e.type}] ${e.title} (ID: ${e.id})`).join('\n')}

## Articles & Lore
${articles.map(a => `
### ${a.title} (Entity ID: ${a.entityId || 'N/A'})
${a.bodyMd.slice(0, 500)}...
`).join('\n')}

## Timeline
${events.sort((a, b) => {
  if (a.storyOrder !== null && b.storyOrder !== null) {
    return a.storyOrder - b.storyOrder;
  }
  if (a.worldStart && b.worldStart) {
    return a.worldStart.localeCompare(b.worldStart);
  }
  return 0;
}).map(e => `
- ${e.title} (${e.worldStart || 'unknown'} - ${e.worldEnd || 'ongoing'})
  ${e.description || ''}
  Participants: ${(e.participantEntities || []).join(', ')}
`).join('\n')}

## Relationships
${relationships.map(r => `
- Entity ${r.fromEntityId} → ${r.relationType} → Entity ${r.toEntityId}
  ${r.description || ''}
`).join('\n')}
`;

    // Call LLM for consistency check
    const prompt = LLM_PROMPTS.consistencyCheck(worldContext);

    const result = await llmClient.complete(
      [{ role: 'user', content: prompt }],
      {
        temperature: 0.3, // Lower temperature for more consistent analysis
        maxTokens: 4096,
        jsonSchema: LLM_SCHEMAS.consistencyCheck
      }
    );

    // Parse response
    let analysisData: { issues: ConsistencyIssue[] };
    try {
      const jsonMatch = result.content.match(/```json\s*([\s\S]*?)\s*```/) ||
                        result.content.match(/\{[\s\S]*\}/);
      const jsonStr = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : result.content;
      analysisData = JSON.parse(jsonStr);
    } catch (parseError) {
      console.error('Failed to parse consistency check response:', parseError);
      return NextResponse.json(
        { error: 'Failed to parse AI response', raw: result.content },
        { status: 500 }
      );
    }

    // Enrich issues with actual entity data
    const enrichedIssues = analysisData.issues.map(issue => ({
      ...issue,
      affectedEntities: issue.affectedEntities.map(ae => {
        const entity = entities.find(e => e.id === ae.id);
        return {
          id: ae.id,
          title: entity?.title || ae.title,
          type: entity?.type || ae.type
        };
      })
    }));

    return NextResponse.json({
      issues: enrichedIssues,
      summary: {
        total: enrichedIssues.length,
        critical: enrichedIssues.filter(i => i.severity === 'critical').length,
        warning: enrichedIssues.filter(i => i.severity === 'warning').length,
        minor: enrichedIssues.filter(i => i.severity === 'minor').length
      },
      analyzedContent: {
        entities: entities.length,
        articles: articles.length,
        events: events.length
      }
    });
  } catch (error: any) {
    console.error('Consistency check error:', error);
    return NextResponse.json(
      { error: error.message || 'Consistency check failed' },
      { status: 500 }
    );
  }
}
