import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { llmClient } from '@/lib/llm-client';
import { LLM_PROMPTS } from '@/lib/llm-tools';

interface EditSuggestion {
  type: 'grammar' | 'missing' | 'inconsistency' | 'detail' | 'organization';
  severity: 'high' | 'medium' | 'low';
  title: string;
  currentText?: string;
  suggestedChange: string;
  reasoning: string;
  lineNumber?: number;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { workspaceId, articleId, entityId, content } = body;

    if (!workspaceId || !content) {
      return NextResponse.json(
        { error: 'workspaceId and content required' },
        { status: 400 }
      );
    }

    // Load world context
    const [entities, articles, events] = await Promise.all([
      prisma.entity.findMany({
        where: { workspaceId, softDeletedAt: null },
        select: { id: true, title: true, type: true },
        take: 50
      }),
      prisma.articleRevision.findMany({
        where: { workspaceId, status: 'approved', softDeletedAt: null },
        select: { id: true, title: true, bodyMd: true },
        take: 20
      }),
      prisma.event.findMany({
        where: { workspaceId, softDeletedAt: null },
        select: { id: true, title: true, description: true },
        take: 20
      })
    ]);

    const worldContext = `
# Known Entities
${entities.map(e => `- [${e.type}] ${e.title}`).join('\n')}

# Existing Articles
${articles.map(a => `- ${a.title}`).join('\n')}

# Timeline Events
${events.map(e => `- ${e.title}`).join('\n')}
`;

    // Generate edit suggestions
    const prompt = LLM_PROMPTS.editSuggestions(content, worldContext);

    const result = await llmClient.complete(
      [{ role: 'user', content: prompt }],
      {
        temperature: 0.5,
        maxTokens: 3072
      }
    );

    // Parse suggestions from response
    // The LLM should return suggestions in a parseable format
    let suggestions: EditSuggestion[] = [];

    try {
      // Try to extract JSON if present
      const jsonMatch = result.content.match(/```json\s*([\s\S]*?)\s*```/) ||
                        result.content.match(/\{[\s\S]*\}/);

      if (jsonMatch) {
        const jsonStr = jsonMatch[1] || jsonMatch[0];
        const parsed = JSON.parse(jsonStr);
        suggestions = parsed.suggestions || [];
      } else {
        // Fallback: parse from structured text
        suggestions = parseTextSuggestions(result.content);
      }
    } catch (parseError) {
      console.error('Failed to parse suggestions:', parseError);
      // Return raw response as single suggestion
      suggestions = [{
        type: 'detail',
        severity: 'medium',
        title: 'AI Suggestions',
        suggestedChange: result.content,
        reasoning: 'See AI response above'
      }];
    }

    return NextResponse.json({
      suggestions,
      summary: {
        total: suggestions.length,
        byType: {
          grammar: suggestions.filter(s => s.type === 'grammar').length,
          missing: suggestions.filter(s => s.type === 'missing').length,
          inconsistency: suggestions.filter(s => s.type === 'inconsistency').length,
          detail: suggestions.filter(s => s.type === 'detail').length,
          organization: suggestions.filter(s => s.type === 'organization').length
        },
        bySeverity: {
          high: suggestions.filter(s => s.severity === 'high').length,
          medium: suggestions.filter(s => s.severity === 'medium').length,
          low: suggestions.filter(s => s.severity === 'low').length
        }
      }
    });
  } catch (error: any) {
    console.error('Edit suggestions error:', error);
    return NextResponse.json(
      { error: error.message || 'Suggestions failed' },
      { status: 500 }
    );
  }
}

/**
 * Fallback parser for text-based suggestions
 */
function parseTextSuggestions(text: string): EditSuggestion[] {
  const suggestions: EditSuggestion[] = [];

  // Split by numbered list or headers
  const sections = text.split(/\n(?=\d+\.|##|\*\*)/);

  for (const section of sections) {
    if (section.trim().length < 10) continue;

    // Extract title (first line)
    const lines = section.split('\n').filter(l => l.trim());
    if (lines.length === 0) continue;

    const title = lines[0].replace(/^\d+\.\s*|\*\*|##/g, '').trim();

    // Determine type and severity from keywords
    let type: EditSuggestion['type'] = 'detail';
    let severity: EditSuggestion['severity'] = 'medium';

    const lowerText = section.toLowerCase();
    if (lowerText.includes('grammar') || lowerText.includes('文法') || lowerText.includes('typo')) {
      type = 'grammar';
      severity = 'low';
    } else if (lowerText.includes('missing') || lowerText.includes('不足') || lowerText.includes('add')) {
      type = 'missing';
      severity = 'medium';
    } else if (lowerText.includes('inconsist') || lowerText.includes('矛盾') || lowerText.includes('conflict')) {
      type = 'inconsistency';
      severity = 'high';
    } else if (lowerText.includes('organiz') || lowerText.includes('構成') || lowerText.includes('structure')) {
      type = 'organization';
      severity = 'low';
    }

    suggestions.push({
      type,
      severity,
      title,
      suggestedChange: lines.slice(1).join('\n').trim() || title,
      reasoning: 'AI-generated suggestion'
    });
  }

  return suggestions;
}
