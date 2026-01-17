import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { llmClient } from '@/lib/llm-client';
import { LLM_PROMPTS, LLM_SCHEMAS, KnowledgeSuggestion } from '@/lib/llm-tools';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { workspaceId, focusEntityId, focusArticleId, focusArea } = body;

    if (!workspaceId) {
      return NextResponse.json(
        { error: 'workspaceId required' },
        { status: 400 }
      );
    }

    // Build context
    let contextEntities, contextArticles, contextEvents;

    if (focusEntityId) {
      // Focus on specific entity and related content
      const entity = await prisma.entity.findUnique({
        where: { id: focusEntityId },
        include: {
          article: true
        }
      });

      if (!entity) {
        return NextResponse.json({ error: 'Entity not found' }, { status: 404 });
      }

      [contextEntities, contextArticles, contextEvents] = await Promise.all([
        prisma.entity.findMany({
          where: {
            workspaceId,
            softDeletedAt: null,
            OR: [
              { tags: { hasSome: entity.tags } },
              { type: entity.type }
            ]
          },
          take: 30
        }),
        entity.article ? Promise.resolve([entity.article]) : Promise.resolve([]),
        prisma.event.findMany({
          where: {
            workspaceId,
            involvedEntityIds: { has: focusEntityId }
          },
          take: 20
        })
      ]);
    } else if (focusArticleId) {
      // Focus on specific article
      const article = await prisma.articleRevision.findUnique({
        where: { id: focusArticleId },
        include: { entity: true }
      });

      if (!article) {
        return NextResponse.json({ error: 'Article not found' }, { status: 404 });
      }

      contextArticles = [article];
      contextEntities = article.entity ? [article.entity] : [];
      contextEvents = [];
    } else {
      // General suggestions for entire workspace
      [contextEntities, contextArticles, contextEvents] = await Promise.all([
        prisma.entity.findMany({
          where: { workspaceId, softDeletedAt: null },
          take: 50
        }),
        prisma.articleRevision.findMany({
          where: { workspaceId, status: 'approved', softDeletedAt: null },
          take: 30
        }),
        prisma.event.findMany({
          where: { workspaceId, softDeletedAt: null },
          take: 30
        })
      ]);
    }

    // Build world context
    const worldContext = `
# Entities
${contextEntities.map(e => `- [${e.type}] ${e.title} (${e.tags.join(', ')})`).join('\n')}

# Articles
${contextArticles.map(a => `
## ${a.title}
${a.bodyMd.slice(0, 400)}...
`).join('\n')}

# Events
${contextEvents.map(e => `- ${e.title} (${e.worldStart || 'unknown'}): ${e.summaryMd || ''}`).join('\n')}
`;

    // Call LLM
    const prompt = LLM_PROMPTS.knowledgeSuggestions(worldContext, focusArea);

    const result = await llmClient.complete(
      [{ role: 'user', content: prompt }],
      {
        temperature: 0.8, // Higher temperature for creativity
        maxTokens: 3072,
        jsonSchema: LLM_SCHEMAS.knowledgeSuggestions
      }
    );

    // Parse response
    let suggestions: { suggestions: KnowledgeSuggestion[] };
    try {
      const jsonMatch = result.content.match(/```json\s*([\s\S]*?)\s*```/) ||
                        result.content.match(/\{[\s\S]*\}/);
      const jsonStr = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : result.content;
      suggestions = JSON.parse(jsonStr);
    } catch (parseError) {
      console.error('Failed to parse suggestions:', parseError);
      return NextResponse.json(
        { error: 'Failed to parse AI response', raw: result.content },
        { status: 500 }
      );
    }

    return NextResponse.json({
      suggestions: suggestions.suggestions,
      summary: {
        total: suggestions.suggestions.length,
        highPriority: suggestions.suggestions.filter(s => s.priority === 'high').length,
        byType: {
          lore: suggestions.suggestions.filter(s => s.type === 'lore').length,
          trivia: suggestions.suggestions.filter(s => s.type === 'trivia').length,
          connection: suggestions.suggestions.filter(s => s.type === 'connection').length,
          expansion: suggestions.suggestions.filter(s => s.type === 'expansion').length,
          reference: suggestions.suggestions.filter(s => s.type === 'reference').length
        }
      }
    });
  } catch (error: any) {
    console.error('Knowledge suggestions error:', error);
    return NextResponse.json(
      { error: error.message || 'Suggestions failed' },
      { status: 500 }
    );
  }
}
