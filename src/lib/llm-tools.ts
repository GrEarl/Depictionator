/**
 * LLM Tool Definitions for Depictionator
 *
 * Structured schemas for:
 * - Multi-language Wiki translation & reconciliation
 * - Consistency checking
 * - Knowledge suggestions
 * - Perspective analysis
 * - Article summarization
 */

export interface WikiTranslationResult {
  sourceLanguage: string;
  targetLanguage: string;
  originalTitle: string;
  translatedTitle: string;
  summary: string;
  mainContent: string;
  infobox: Record<string, string>;
  categories: string[];
  conflicts: Array<{
    field: string;
    sourceValue: string;
    targetValue: string;
    suggestion: string;
  }>;
}

export interface ConsistencyIssue {
  type: 'contradiction' | 'timeline' | 'geography' | 'character' | 'logic';
  severity: 'critical' | 'warning' | 'minor';
  title: string;
  description: string;
  affectedEntities: Array<{
    id: string;
    title: string;
    type: string;
  }>;
  evidence: Array<{
    articleId?: string;
    quote: string;
    context: string;
  }>;
  suggestion: string;
}

export interface KnowledgeSuggestion {
  type: 'lore' | 'trivia' | 'connection' | 'expansion' | 'reference';
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  targetEntityId?: string;
  targetArticleId?: string;
  suggestedContent: string;
  reasoning: string;
  relatedEntities: Array<{
    id: string;
    title: string;
    relationship: string;
  }>;
}

export interface PerspectiveAnalysis {
  perspectiveId: string;
  perspectiveName: string;
  entityId: string;
  entityTitle: string;
  beliefs: Array<{
    statement: string;
    reliability: 'true' | 'false' | 'uncertain' | 'propaganda';
    reasoning: string;
    evidenceInCanon?: string;
  }>;
  motivations: string[];
  knownFacts: string[];
  unknownFacts: string[];
  misbeliefs: Array<{
    belief: string;
    truth: string;
    reason: string;
  }>;
}

export interface ArticleSummary {
  shortSummary: string; // 1-2 sentences
  mediumSummary: string; // 1 paragraph
  keyPoints: string[];
  mainEntities: Array<{
    title: string;
    type: string;
    role: string;
  }>;
  themes: string[];
  tone: string;
}

/**
 * JSON Schemas for structured LLM output
 */
export const LLM_SCHEMAS = {
  wikiTranslation: {
    type: 'object',
    required: ['sourceLanguage', 'targetLanguage', 'originalTitle', 'translatedTitle', 'summary', 'mainContent'],
    properties: {
      sourceLanguage: { type: 'string' },
      targetLanguage: { type: 'string' },
      originalTitle: { type: 'string' },
      translatedTitle: { type: 'string' },
      summary: { type: 'string' },
      mainContent: { type: 'string' },
      infobox: { type: 'object' },
      categories: { type: 'array', items: { type: 'string' } },
      conflicts: {
        type: 'array',
        items: {
          type: 'object',
          required: ['field', 'sourceValue', 'targetValue', 'suggestion'],
          properties: {
            field: { type: 'string' },
            sourceValue: { type: 'string' },
            targetValue: { type: 'string' },
            suggestion: { type: 'string' }
          }
        }
      }
    }
  },

  consistencyCheck: {
    type: 'object',
    required: ['issues'],
    properties: {
      issues: {
        type: 'array',
        items: {
          type: 'object',
          required: ['type', 'severity', 'title', 'description', 'suggestion'],
          properties: {
            type: { type: 'string', enum: ['contradiction', 'timeline', 'geography', 'character', 'logic'] },
            severity: { type: 'string', enum: ['critical', 'warning', 'minor'] },
            title: { type: 'string' },
            description: { type: 'string' },
            affectedEntities: {
              type: 'array',
              items: {
                type: 'object',
                required: ['id', 'title', 'type'],
                properties: {
                  id: { type: 'string' },
                  title: { type: 'string' },
                  type: { type: 'string' }
                }
              }
            },
            evidence: {
              type: 'array',
              items: {
                type: 'object',
                required: ['quote', 'context'],
                properties: {
                  articleId: { type: 'string' },
                  quote: { type: 'string' },
                  context: { type: 'string' }
                }
              }
            },
            suggestion: { type: 'string' }
          }
        }
      }
    }
  },

  knowledgeSuggestions: {
    type: 'object',
    required: ['suggestions'],
    properties: {
      suggestions: {
        type: 'array',
        items: {
          type: 'object',
          required: ['type', 'priority', 'title', 'description', 'suggestedContent', 'reasoning'],
          properties: {
            type: { type: 'string', enum: ['lore', 'trivia', 'connection', 'expansion', 'reference'] },
            priority: { type: 'string', enum: ['high', 'medium', 'low'] },
            title: { type: 'string' },
            description: { type: 'string' },
            targetEntityId: { type: 'string' },
            targetArticleId: { type: 'string' },
            suggestedContent: { type: 'string' },
            reasoning: { type: 'string' },
            relatedEntities: {
              type: 'array',
              items: {
                type: 'object',
                required: ['id', 'title', 'relationship'],
                properties: {
                  id: { type: 'string' },
                  title: { type: 'string' },
                  relationship: { type: 'string' }
                }
              }
            }
          }
        }
      }
    }
  },

  perspectiveAnalysis: {
    type: 'object',
    required: ['perspectiveName', 'entityTitle', 'beliefs', 'motivations', 'knownFacts', 'unknownFacts', 'misbeliefs'],
    properties: {
      perspectiveName: { type: 'string' },
      entityTitle: { type: 'string' },
      beliefs: {
        type: 'array',
        items: {
          type: 'object',
          required: ['statement', 'reliability', 'reasoning'],
          properties: {
            statement: { type: 'string' },
            reliability: { type: 'string', enum: ['true', 'false', 'uncertain', 'propaganda'] },
            reasoning: { type: 'string' },
            evidenceInCanon: { type: 'string' }
          }
        }
      },
      motivations: { type: 'array', items: { type: 'string' } },
      knownFacts: { type: 'array', items: { type: 'string' } },
      unknownFacts: { type: 'array', items: { type: 'string' } },
      misbeliefs: {
        type: 'array',
        items: {
          type: 'object',
          required: ['belief', 'truth', 'reason'],
          properties: {
            belief: { type: 'string' },
            truth: { type: 'string' },
            reason: { type: 'string' }
          }
        }
      }
    }
  },

  articleSummary: {
    type: 'object',
    required: ['shortSummary', 'mediumSummary', 'keyPoints', 'mainEntities', 'themes', 'tone'],
    properties: {
      shortSummary: { type: 'string' },
      mediumSummary: { type: 'string' },
      keyPoints: { type: 'array', items: { type: 'string' } },
      mainEntities: {
        type: 'array',
        items: {
          type: 'object',
          required: ['title', 'type', 'role'],
          properties: {
            title: { type: 'string' },
            type: { type: 'string' },
            role: { type: 'string' }
          }
        }
      },
      themes: { type: 'array', items: { type: 'string' } },
      tone: { type: 'string' }
    }
  }
};

/**
 * Prompt templates for common LLM tasks
 */
export const LLM_PROMPTS = {
  wikiTranslation: (sourceUrl: string, sourceLang: string, targetLang: string) => `
You are a worldbuilding assistant helping to import and reconcile Wikipedia articles from multiple languages.

Task: Translate and reconcile the Wikipedia article from ${sourceLang} to ${targetLang}.

Source URL: ${sourceUrl}

Please:
1. Extract the main content and translate it to ${targetLang}
2. Identify any conflicts or differences between language versions
3. Suggest how to reconcile conflicting information
4. Extract structured data (infobox, categories)

Respond with structured JSON.
`,

  consistencyCheck: (context: string) => `
You are a worldbuilding consistency checker. Analyze the following world content for logical contradictions, timeline issues, geographical impossibilities, character inconsistencies, and other logical problems.

World Context:
${context}

Please identify:
1. Contradictions between different articles or statements
2. Timeline inconsistencies (events in wrong order, impossible dates)
3. Geographical issues (distances, locations, travel times)
4. Character inconsistencies (age, background, abilities)
5. Logical problems (cause-effect, impossibilities)

For each issue, provide:
- Type and severity
- Clear description
- Evidence (quotes from the content)
- Suggestion for resolution

Respond with structured JSON.
`,

  knowledgeSuggestions: (context: string, focusArea?: string) => `
You are a creative worldbuilding assistant. Based on the following world content, suggest interesting additions, connections, trivia, and expansions.

World Context:
${context}

${focusArea ? `Focus Area: ${focusArea}` : ''}

Please suggest:
1. Lore additions (backstory, history, cultural details)
2. Trivia (interesting facts, easter eggs)
3. Connections (relationships between entities that might be implied but not explicit)
4. Expansions (areas that could be developed further)
5. References (real-world or literary references that could enrich the world)

For each suggestion, explain:
- Why it would enhance the world
- How it connects to existing content
- Specific content you'd add

Respond with structured JSON.
`,

  perspectiveAnalysis: (entityTitle: string, perspectiveName: string, worldContext: string) => `
You are a narrative perspective analyzer for worldbuilding.

Entity: ${entityTitle}
Perspective: ${perspectiveName}

World Context (Canon):
${worldContext}

Analyze what this perspective knows, believes, and misunderstands about the entity:

1. Beliefs: What does this perspective believe about the entity? (true, false, uncertain, propaganda)
2. Motivations: Why does this perspective care about this entity?
3. Known Facts: What does this perspective correctly know?
4. Unknown Facts: What is this perspective unaware of?
5. Misbeliefs: What does this perspective incorrectly believe, and what is the truth?

This is for "unreliable narrator" storytelling. Perspectives can have propaganda, misinformation, or limited knowledge.

Respond with structured JSON.
`,

  articleSummary: (articleContent: string) => `
You are a worldbuilding summarizer. Provide a concise summary of this article at multiple levels of detail.

Article Content:
${articleContent}

Please provide:
1. Short summary (1-2 sentences, elevator pitch)
2. Medium summary (1 paragraph, overview)
3. Key points (bullet list of main facts)
4. Main entities (characters, locations, etc. and their roles)
5. Themes (major themes or topics)
6. Tone (overall tone: serious, comedic, tragic, etc.)

Respond with structured JSON.
`,

  editSuggestions: (articleContent: string, context: string) => `
You are a worldbuilding editor. Review this article and suggest improvements, additions, and corrections.

Article:
${articleContent}

World Context:
${context}

Please suggest:
1. Grammar and style improvements
2. Missing information that should be added
3. Inconsistencies with the world context
4. Areas that need more detail
5. Better phrasing or organization

For each suggestion, provide:
- Type of suggestion
- Current text (if applicable)
- Suggested change
- Reasoning

Be constructive and specific.
`,

  semanticSearch: (query: string) => `
Convert this natural language search query into semantic search terms.

Query: "${query}"

Extract:
1. Main concepts
2. Entity types being searched for
3. Relationships mentioned
4. Time periods or eras
5. Locations or settings
6. Attributes or characteristics

Respond with a structured breakdown of the query.
`
};
