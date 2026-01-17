import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { llmClient } from '@/lib/llm-client';
import { LLMMessage } from '@/lib/llm-client';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { workspaceId, messages, includeContext } = body;

    if (!workspaceId || !messages || !Array.isArray(messages)) {
      return NextResponse.json(
        { error: 'Invalid request body' },
        { status: 400 }
      );
    }

    // Build context if requested
    let contextPrompt = '';
    if (includeContext) {
      const [entities, articles, events] = await Promise.all([
        prisma.entity.findMany({
          where: { workspaceId, softDeletedAt: null },
          select: { id: true, title: true, type: true, aliases: true },
          take: 50
        }),
        prisma.articleRevision.findMany({
          where: { workspaceId, status: 'approved', softDeletedAt: null },
          select: { id: true, title: true, bodyMd: true },
          take: 30
        }),
        prisma.event.findMany({
          where: { workspaceId, softDeletedAt: null },
          select: { id: true, title: true, summaryMd: true, worldStart: true },
          take: 30
        })
      ]);

      contextPrompt = `
# World Context

## Entities (${entities.length} total)
${entities.map(e => `- [${e.type}] ${e.title}${e.aliases ? ` (別名: ${e.aliases.join(', ')})` : ''}`).join('\n')}

## Articles (${articles.length} total)
${articles.map(a => `- ${a.title}\n  ${a.bodyMd.slice(0, 200)}...`).join('\n\n')}

## Events (${events.length} total)
${events.map(e => `- ${e.title} (${e.worldStart || 'unknown date'})${e.summaryMd ? `\n  ${e.summaryMd.slice(0, 150)}...` : ''}`).join('\n\n')}

---

You are a worldbuilding assistant for this fictional world. Answer questions based on the context above. Be creative but consistent with established lore.
`;
    }

    // Prepare messages for LLM
    const llmMessages: LLMMessage[] = [
      {
        role: 'system',
        content: contextPrompt || 'You are a helpful worldbuilding assistant.'
      },
      ...messages.map((msg: any) => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content
      }))
    ];

    // Call LLM
    const result = await llmClient.complete(llmMessages, {
      temperature: 0.7,
      maxTokens: 2048
    });

    return NextResponse.json({
      response: result.content,
      usage: result.usage
    });
  } catch (error: any) {
    console.error('AI chat error:', error);
    return NextResponse.json(
      { error: error.message || 'AI chat failed' },
      { status: 500 }
    );
  }
}
