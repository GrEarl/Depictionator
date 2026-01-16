import { NextRequest, NextResponse } from 'next/server';
import { llmClient } from '@/lib/llm-client';
import { LLM_PROMPTS, LLM_SCHEMAS, WikiTranslationResult } from '@/lib/llm-tools';

/**
 * Multi-language Wikipedia Translation & Reconciliation
 *
 * Fetches Wikipedia articles from multiple languages,
 * translates them, and identifies conflicts to reconcile.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { title, languages, targetLanguage = 'ja' } = body;

    if (!title || !languages || !Array.isArray(languages)) {
      return NextResponse.json(
        { error: 'title and languages array required' },
        { status: 400 }
      );
    }

    // Fetch Wikipedia content from each language
    const fetchPromises = languages.map(async (lang: string) => {
      try {
        // Use Wikipedia REST API
        const url = `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`;
        const response = await fetch(url, {
          headers: {
            'User-Agent': 'Depictionator/1.0 (Worldbuilding Tool)'
          }
        });

        if (!response.ok) {
          return { lang, error: 'Not found' };
        }

        const data = await response.json();

        // Also fetch full content
        const contentUrl = `https://${lang}.wikipedia.org/api/rest_v1/page/html/${encodeURIComponent(title)}`;
        const contentResponse = await fetch(contentUrl, {
          headers: {
            'User-Agent': 'Depictionator/1.0 (Worldbuilding Tool)'
          }
        });

        let fullContent = '';
        if (contentResponse.ok) {
          fullContent = await contentResponse.text();
          // Extract text content from HTML (simple extraction)
          fullContent = fullContent
            .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
            .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
            .replace(/<[^>]+>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .slice(0, 5000); // Limit to first 5000 chars
        }

        return {
          lang,
          title: data.title,
          summary: data.extract,
          fullContent,
          thumbnail: data.thumbnail?.source,
          url: data.content_urls?.desktop?.page
        };
      } catch (error) {
        console.error(`Failed to fetch ${lang} Wikipedia:`, error);
        return { lang, error: 'Fetch failed' };
      }
    });

    const fetchedArticles = await Promise.all(fetchPromises);
    const validArticles = fetchedArticles.filter(a => !a.error);

    if (validArticles.length === 0) {
      return NextResponse.json(
        { error: 'No Wikipedia articles found in any language' },
        { status: 404 }
      );
    }

    // Use LLM to translate and reconcile
    const sourceArticle = validArticles[0];
    const otherArticles = validArticles.slice(1);

    const reconciliationContext = `
# Source Article (${sourceArticle.lang})
Title: ${sourceArticle.title}
Summary: ${sourceArticle.summary}
Full Content (excerpt): ${sourceArticle.fullContent}

# Other Language Versions
${otherArticles.map(a => `
## ${a.lang}
Title: ${a.title}
Summary: ${a.summary}
Full Content (excerpt): ${a.fullContent}
`).join('\n')}

Please translate the source article to ${targetLanguage} and identify any conflicts or differences between language versions.
`;

    const prompt = LLM_PROMPTS.wikiTranslation(
      sourceArticle.url,
      sourceArticle.lang,
      targetLanguage
    ) + '\n\n' + reconciliationContext;

    const result = await llmClient.complete(
      [{ role: 'user', content: prompt }],
      {
        temperature: 0.3,
        maxTokens: 4096,
        jsonSchema: LLM_SCHEMAS.wikiTranslation
      }
    );

    // Parse response
    let translation: WikiTranslationResult;
    try {
      const jsonMatch = result.content.match(/```json\s*([\s\S]*?)\s*```/) ||
                        result.content.match(/\{[\s\S]*\}/);
      const jsonStr = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : result.content;
      translation = JSON.parse(jsonStr);
    } catch (parseError) {
      console.error('Failed to parse translation:', parseError);
      return NextResponse.json(
        { error: 'Failed to parse AI response', raw: result.content },
        { status: 500 }
      );
    }

    return NextResponse.json({
      translation,
      sources: validArticles.map(a => ({
        language: a.lang,
        title: a.title,
        url: a.url,
        thumbnail: a.thumbnail
      })),
      conflictsCount: translation.conflicts?.length || 0
    });
  } catch (error: any) {
    console.error('Wiki translation error:', error);
    return NextResponse.json(
      { error: error.message || 'Translation failed' },
      { status: 500 }
    );
  }
}
