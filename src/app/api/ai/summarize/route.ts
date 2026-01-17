import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { llmClient } from '@/lib/llm-client';
import { LLM_PROMPTS, LLM_SCHEMAS, ArticleSummary } from '@/lib/llm-tools';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { articleId, entityId, customContent } = body;

    let articleContent = '';
    let articleTitle = '';

    if (customContent) {
      articleContent = customContent;
      articleTitle = 'Custom Content';
    } else if (articleId) {
      const article = await prisma.articleRevision.findUnique({
        where: { id: articleId }
      });

      if (!article) {
        return NextResponse.json({ error: 'Article not found' }, { status: 404 });
      }

      articleContent = article.bodyMd;
      articleTitle = article.title;
    } else if (entityId) {
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

      if (!entity || !entity.article?.baseRevision) {
        return NextResponse.json(
          { error: 'Entity or article not found' },
          { status: 404 }
        );
      }

      articleContent = entity.article.baseRevision.bodyMd;
      articleTitle = entity.article.baseRevision.title;
    } else {
      return NextResponse.json(
        { error: 'articleId, entityId, or customContent required' },
        { status: 400 }
      );
    }

    // Generate summary
    const prompt = LLM_PROMPTS.articleSummary(articleContent);

    const result = await llmClient.complete(
      [{ role: 'user', content: prompt }],
      {
        temperature: 0.5,
        maxTokens: 1024,
        jsonSchema: LLM_SCHEMAS.articleSummary
      }
    );

    // Parse response
    let summary: ArticleSummary;
    try {
      const jsonMatch = result.content.match(/```json\s*([\s\S]*?)\s*```/) ||
                        result.content.match(/\{[\s\S]*\}/);
      const jsonStr = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : result.content;
      summary = JSON.parse(jsonStr);
    } catch (parseError) {
      console.error('Failed to parse summary:', parseError);
      return NextResponse.json(
        { error: 'Failed to parse AI response', raw: result.content },
        { status: 500 }
      );
    }

    return NextResponse.json({
      title: articleTitle,
      summary,
      originalLength: articleContent.length,
      shortSummaryLength: summary.shortSummary.length,
      mediumSummaryLength: summary.mediumSummary.length
    });
  } catch (error: any) {
    console.error('Summarization error:', error);
    return NextResponse.json(
      { error: error.message || 'Summarization failed' },
      { status: 500 }
    );
  }
}
