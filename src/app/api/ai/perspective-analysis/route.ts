import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { llmClient } from '@/lib/llm-client';
import { LLM_PROMPTS, LLM_SCHEMAS } from '@/lib/llm-tools';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { workspaceId, perspectiveId, entityId } = body;

    if (!workspaceId || !perspectiveId || !entityId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Load perspective info
    const perspective = await prisma.viewpoint.findUnique({
      where: { id: perspectiveId },
      include: {
        entity: true
      }
    });

    if (!perspective) {
      return NextResponse.json(
        { error: 'Perspective not found' },
        { status: 404 }
      );
    }

    // Load target entity
    const entity = await prisma.entity.findUnique({
      where: { id: entityId },
      include: {
        article: {
          include: {
            baseRevision: true
          }
        }
      }
    });

    if (!entity) {
      return NextResponse.json(
        { error: 'Entity not found' },
        { status: 404 }
      );
    }

    // Build world context
    const [relatedEntities, relatedEvents, relationships] = await Promise.all([
      prisma.entity.findMany({
        where: {
          workspaceId,
          softDeletedAt: null,
          OR: [
            { tags: { hasSome: entity.tags } },
            { type: entity.type }
          ]
        },
        take: 20
      }),
      prisma.event.findMany({
        where: {
          workspaceId,
          softDeletedAt: null,
          involvedEntityIds: { has: entityId }
        },
        take: 10
      }),
      prisma.entityRelation.findMany({
        where: {
          workspaceId,
          OR: [
            { fromEntityId: entityId },
            { toEntityId: entityId }
          ]
        }
      })
    ]);

    const worldContext = `
# Entity: ${entity.title}
Type: ${entity.type}
${entity.article?.baseRevision?.bodyMd ? `\n## Canon Information\n${entity.article.baseRevision.bodyMd}\n` : ''}

## Related Entities
${relatedEntities.map(e => `- ${e.title} (${e.type})`).join('\n')}

## Relationships
${relationships.map(r =>
  `- ${r.fromEntityId === entityId ? 'This entity' : 'Other'} → ${r.relationType} → ${r.toEntityId === entityId ? 'This entity' : 'Other'}: ${r.description || ''}`
).join('\n')}

## Related Events
${relatedEvents.map(e => `- ${e.title} (${e.worldStart || 'unknown'}): ${e.summaryMd || ''}`).join('\n')}
`;

    // Generate analysis using LLM
    const prompt = LLM_PROMPTS.perspectiveAnalysis(
      entity.title,
      perspective.name,
      worldContext
    );

    const result = await llmClient.complete(
      [{ role: 'user', content: prompt }],
      {
        temperature: 0.7,
        maxTokens: 2048,
        jsonSchema: LLM_SCHEMAS.perspectiveAnalysis
      }
    );

    // Parse JSON response
    let analysisData;
    try {
      // Extract JSON from markdown code blocks if present
      const jsonMatch = result.content.match(/```json\s*([\s\S]*?)\s*```/) ||
                        result.content.match(/\{[\s\S]*\}/);
      const jsonStr = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : result.content;
      analysisData = JSON.parse(jsonStr);
    } catch (parseError) {
      console.error('Failed to parse LLM response:', parseError);
      return NextResponse.json(
        { error: 'Failed to parse AI response', raw: result.content },
        { status: 500 }
      );
    }

    // Format response
    const response = {
      entityId,
      entityTitle: entity.title,
      entityType: entity.type,
      perspectives: [
        {
          perspectiveId,
          perspectiveName: perspective.name,
          knowledgeLevel: 'partial' as const,
          beliefs: analysisData.beliefs.map((b: any) => ({
            statement: b.statement,
            isTrue: b.reliability === 'true',
            reliability: b.reliability === 'propaganda' ? 'propaganda' :
                        b.reliability === 'false' ? 'propaganda' :
                        b.reliability === 'uncertain' ? 'rumor' :
                        'confirmed',
            notes: b.reasoning
          })),
          relationships: [],
          motivations: analysisData.motivations || [],
          hiddenFrom: analysisData.unknownFacts || []
        }
      ]
    };

    return NextResponse.json(response);
  } catch (error: any) {
    console.error('Perspective analysis error:', error);
    return NextResponse.json(
      { error: error.message || 'Analysis failed' },
      { status: 500 }
    );
  }
}
