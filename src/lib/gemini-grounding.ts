/**
 * Gemini Grounding with Google Search
 *
 * Uses Gemini 3 models with built-in Google Search tool
 * for real-time web grounding and fact verification.
 */

import { GoogleGenerativeAI, type GenerateContentResult } from "@google/generative-ai";
import type { EntityType } from "@prisma/client";
import type { ExternalSource } from "./external-search";

// ============================================
// Types
// ============================================

export interface GroundingChunk {
  web?: {
    uri: string;
    title: string;
  };
}

export interface GroundingSupport {
  segment: {
    startIndex: number;
    endIndex: number;
    text: string;
  };
  groundingChunkIndices: number[];
  confidenceScores: number[];
}

export interface GroundingMetadata {
  searchEntryPoint?: {
    renderedContent: string;
  };
  groundingChunks?: GroundingChunk[];
  groundingSupports?: GroundingSupport[];
  webSearchQueries?: string[];
}

export interface GroundedSearchResult {
  text: string;
  sources: ExternalSource[];
  searchQueries: string[];
  groundingSupports: GroundingSupport[];
}

// ============================================
// Configuration
// ============================================

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GROUNDING_MODEL = process.env.GEMINI_GROUNDING_MODEL ?? "gemini-3-flash-preview";

// ============================================
// Helper Functions
// ============================================

function generateSourceId(): string {
  return `gs_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function isModelingEntityType(entityType: string): boolean {
  return ["item", "weapon", "vehicle", "building", "location", "object", "equipment", "tool", "device"].includes(
    entityType.toLowerCase()
  );
}

function extractGroundingMetadata(result: GenerateContentResult): GroundingMetadata | null {
  try {
    const candidate = result.response.candidates?.[0];
    if (!candidate) return null;

    // Access grounding metadata from the candidate
    // Note: The exact structure may vary by API version
    const metadata = (candidate as any).groundingMetadata;
    return metadata || null;
  } catch {
    return null;
  }
}

// ============================================
// Grounding Search Functions
// ============================================

/**
 * Execute a grounded search using Gemini with Google Search
 */
export async function executeGroundedSearch(
  query: string,
  entityType: EntityType,
  options: {
    modelingFocus?: boolean;
    targetLang?: string;
    maxSources?: number;
  } = {}
): Promise<GroundedSearchResult> {
  if (!GEMINI_API_KEY) {
    console.warn("[Grounding] Gemini API key not configured");
    return {
      text: "",
      sources: [],
      searchQueries: [],
      groundingSupports: [],
    };
  }

  const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
  const isModeling = options.modelingFocus || isModelingEntityType(entityType);
  const lang = options.targetLang || "en";

  // Build the search prompt based on entity type
  const prompt = isModeling
    ? buildModelingSearchPrompt(query, entityType, lang)
    : buildGeneralSearchPrompt(query, entityType, lang);

  try {
    // Initialize model with Google Search grounding
    const model = genAI.getGenerativeModel({
      model: GROUNDING_MODEL,
      // @ts-expect-error - tools type may not be fully typed
      tools: [{ googleSearch: {} }],
    });

    console.log(`[Grounding] Executing grounded search for "${query}" (${entityType})`);

    const result = await model.generateContent(prompt);
    const text = result.response.text();

    // Extract grounding metadata
    const metadata = extractGroundingMetadata(result);

    // Convert grounding chunks to ExternalSource format
    const sources: ExternalSource[] = [];
    if (metadata?.groundingChunks) {
      for (const chunk of metadata.groundingChunks) {
        if (chunk.web) {
          sources.push({
            id: generateSourceId(),
            sourceType: "google_search",
            url: chunk.web.uri,
            title: chunk.web.title,
            snippet: extractSnippetForUrl(text, chunk.web.uri, metadata.groundingSupports),
            relevanceScore: 0.7,
            retrievedAt: new Date(),
            verified: true,
            metadata: {
              groundedSearch: true,
            },
          });
        }
      }
    }

    // Limit sources if needed
    const maxSources = options.maxSources || 15;
    const limitedSources = sources.slice(0, maxSources);

    console.log(`[Grounding] Found ${limitedSources.length} grounded sources`);

    return {
      text,
      sources: limitedSources,
      searchQueries: metadata?.webSearchQueries || [],
      groundingSupports: metadata?.groundingSupports || [],
    };
  } catch (error) {
    console.error("[Grounding] Search failed:", error);
    return {
      text: "",
      sources: [],
      searchQueries: [],
      groundingSupports: [],
    };
  }
}

/**
 * Extract relevant snippet for a URL from grounding supports
 */
function extractSnippetForUrl(
  fullText: string,
  url: string,
  supports?: GroundingSupport[]
): string | undefined {
  if (!supports) return undefined;

  // Find supports that reference this URL (by chunk index)
  // For simplicity, just return the first few relevant text segments
  const snippets: string[] = [];

  for (const support of supports.slice(0, 5)) {
    if (support.segment?.text) {
      snippets.push(support.segment.text);
    }
  }

  return snippets.length > 0 ? snippets.join(" ... ").slice(0, 500) : undefined;
}

// ============================================
// Prompt Builders
// ============================================

function buildModelingSearchPrompt(query: string, entityType: EntityType, lang: string): string {
  return `You are a research assistant gathering detailed technical information for 3D modeling reference.

SUBJECT: "${query}"
TYPE: ${entityType}
OUTPUT LANGUAGE: ${lang}

Search for and provide comprehensive technical information including:

1. **DIMENSIONS & MEASUREMENTS**
   - Exact sizes (length, width, height, diameter)
   - Weight and mass
   - Proportions and ratios

2. **MATERIALS & CONSTRUCTION**
   - Primary materials used
   - Surface finishes and textures
   - Construction methods

3. **STRUCTURAL DETAILS**
   - Component breakdown
   - Assembly and joints
   - Internal structure (if known)

4. **VISUAL REFERENCE**
   - Notable visual features
   - Color schemes and variations
   - Distinctive markings or patterns

5. **VARIANTS & VERSIONS**
   - Different models or types
   - Historical evolution
   - Regional variations

Provide specific, factual information with exact numbers when available.
Cite sources for key facts.
Format the response clearly with sections and bullet points.`;
}

function buildGeneralSearchPrompt(query: string, entityType: EntityType, lang: string): string {
  return `You are a research assistant gathering comprehensive information for a worldbuilding reference database.

SUBJECT: "${query}"
TYPE: ${entityType}
OUTPUT LANGUAGE: ${lang}

Search for and provide detailed information including:

1. **OVERVIEW**
   - Definition and description
   - Key characteristics
   - Significance and importance

2. **HISTORICAL CONTEXT**
   - Origin and development
   - Major events and milestones
   - Evolution over time

3. **CULTURAL SIGNIFICANCE**
   - Role in culture/society
   - Symbolic meaning
   - Contemporary relevance

4. **RELATIONSHIPS**
   - Related concepts or entities
   - Influences and connections
   - Categories and classifications

5. **NOTABLE EXAMPLES**
   - Famous instances
   - Representative cases
   - Current status

Provide accurate, well-sourced information.
Include specific facts and details.
Format clearly with sections and bullet points.`;
}

// ============================================
// Advanced Grounding Features
// ============================================

/**
 * Execute a multi-turn grounded research session
 */
export async function executeDeepResearch(
  query: string,
  entityType: EntityType,
  initialContext: string,
  options: {
    maxTurns?: number;
    modelingFocus?: boolean;
    targetLang?: string;
  } = {}
): Promise<{
  finalText: string;
  allSources: ExternalSource[];
  researchPath: string[];
}> {
  if (!GEMINI_API_KEY) {
    return { finalText: "", allSources: [], researchPath: [] };
  }

  const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
  const maxTurns = options.maxTurns || 3;
  const isModeling = options.modelingFocus || isModelingEntityType(entityType);
  const lang = options.targetLang || "en";

  const model = genAI.getGenerativeModel({
    model: GROUNDING_MODEL,
    // @ts-expect-error - tools type may not be fully typed
    tools: [{ googleSearch: {} }],
  });

  const allSources: ExternalSource[] = [];
  const researchPath: string[] = [];
  let accumulatedKnowledge = initialContext;

  console.log(`[DeepResearch] Starting ${maxTurns}-turn research for "${query}"`);

  // Turn 1: Initial broad search
  const initialPrompt = `Research "${query}" (${entityType}).
${isModeling ? "Focus on technical specifications, dimensions, and materials for 3D modeling." : ""}

Current knowledge:
${accumulatedKnowledge.slice(0, 1000)}

Find comprehensive information and identify gaps that need further research.`;

  const chat = model.startChat();
  let response = await chat.sendMessage(initialPrompt);
  let responseText = response.response.text();

  researchPath.push(`Turn 1: Initial research on "${query}"`);
  accumulatedKnowledge += "\n\n" + responseText;

  // Extract sources from first turn
  const metadata1 = extractGroundingMetadata(response);
  if (metadata1?.groundingChunks) {
    for (const chunk of metadata1.groundingChunks) {
      if (chunk.web) {
        allSources.push({
          id: generateSourceId(),
          sourceType: "google_search",
          url: chunk.web.uri,
          title: chunk.web.title,
          relevanceScore: 0.8,
          retrievedAt: new Date(),
          verified: true,
        });
      }
    }
  }

  // Additional turns for deeper research
  for (let turn = 2; turn <= maxTurns; turn++) {
    const followUpPrompt = isModeling
      ? `Based on what we've found, search for more specific technical details:
- Exact dimensions and measurements
- Material specifications
- Construction/manufacturing details
- Diagram or blueprint references
- Variant specifications

What specific technical data is still missing?`
      : `Based on what we've found, search for:
- More historical details
- Cultural context
- Related entities
- Notable examples
- Current status

What important aspects haven't been covered yet?`;

    response = await chat.sendMessage(followUpPrompt);
    responseText = response.response.text();

    researchPath.push(`Turn ${turn}: Deep dive on ${isModeling ? "technical specs" : "context"}`);
    accumulatedKnowledge += "\n\n" + responseText;

    // Extract sources
    const metadata = extractGroundingMetadata(response);
    if (metadata?.groundingChunks) {
      for (const chunk of metadata.groundingChunks) {
        if (chunk.web && !allSources.some(s => s.url === chunk.web!.uri)) {
          allSources.push({
            id: generateSourceId(),
            sourceType: "google_search",
            url: chunk.web.uri,
            title: chunk.web.title,
            relevanceScore: 0.7 - (turn * 0.1),
            retrievedAt: new Date(),
            verified: true,
          });
        }
      }
    }
  }

  console.log(`[DeepResearch] Completed with ${allSources.length} unique sources`);

  return {
    finalText: accumulatedKnowledge,
    allSources,
    researchPath,
  };
}

/**
 * Verify facts using grounded search
 */
export async function verifyFacts(
  claims: string[],
  entityTitle: string
): Promise<Array<{
  claim: string;
  verified: boolean;
  confidence: number;
  sources: string[];
  correction?: string;
}>> {
  if (!GEMINI_API_KEY || claims.length === 0) {
    return claims.map(claim => ({
      claim,
      verified: false,
      confidence: 0,
      sources: [],
    }));
  }

  const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({
    model: GROUNDING_MODEL,
    // @ts-expect-error - tools type may not be fully typed
    tools: [{ googleSearch: {} }],
  });

  const claimsList = claims.map((c, i) => `${i + 1}. ${c}`).join("\n");

  const prompt = `Verify the following claims about "${entityTitle}" using web search.

CLAIMS TO VERIFY:
${claimsList}

For each claim, determine:
1. Is it TRUE, FALSE, or UNCERTAIN?
2. What is your confidence level (0-100%)?
3. What sources support or contradict it?
4. If false, what is the correct information?

Respond in JSON format:
{
  "verifications": [
    {
      "claimIndex": 1,
      "verified": true,
      "confidence": 95,
      "sources": ["source1", "source2"],
      "correction": null
    }
  ]
}`;

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text();

    // Parse JSON response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return claims.map((claim, i) => {
        const v = parsed.verifications?.find((x: any) => x.claimIndex === i + 1);
        return {
          claim,
          verified: v?.verified ?? false,
          confidence: v?.confidence ?? 0,
          sources: v?.sources ?? [],
          correction: v?.correction,
        };
      });
    }
  } catch (error) {
    console.error("[FactVerify] Verification failed:", error);
  }

  return claims.map(claim => ({
    claim,
    verified: false,
    confidence: 0,
    sources: [],
  }));
}
