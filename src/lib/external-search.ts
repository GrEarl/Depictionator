/**
 * External Source Enrichment (ESE)
 *
 * LLMのWeb検索能力（Gemini Grounding with Google Search）と
 * 専門ソースAPI統合により、より豊富なコンテキスト・マルチメディアを収集する機能
 */

import { generateText, type LlmProvider } from "./llm";
import { fetchWikiImageInfo, searchWiki, type WikiImageInfo } from "./wiki";
import type { EntityType } from "@prisma/client";

// ============================================
// Types
// ============================================

export type ExternalSourceType =
  | "google_search"
  | "wikipedia"
  | "wikimedia_commons"
  | "wikidata"
  | "youtube"
  | "flickr"
  | "freesound"
  | "internet_archive"
  | "academic"
  | "other";

export interface ExternalSource {
  id: string;
  sourceType: ExternalSourceType;
  url: string;
  title: string;
  snippet?: string;
  content?: string;
  mediaUrls?: string[];
  relevanceScore: number;
  licenseId?: string;
  licenseUrl?: string;
  author?: string;
  publishedAt?: Date;
  retrievedAt: Date;
  verified: boolean;
  metadata?: Record<string, unknown>;
}

export interface TechnicalSpecs {
  dimensions?: Record<string, {
    value: number;
    unit: string;
    note?: string;
    source?: string;
  }>;
  materials?: Array<{
    part: string;
    material: string;
    properties?: Record<string, string>;
    source?: string;
  }>;
  weight?: {
    value: number;
    unit: string;
    note?: string;
  };
  performance?: Record<string, {
    value: number | string;
    unit?: string;
  }>;
  components?: Array<{
    name: string;
    description?: string;
    subComponents?: string[];
  }>;
  variants?: Array<{
    name: string;
    differences: string[];
  }>;
  manufacturingInfo?: {
    period?: string;
    location?: string;
    method?: string;
  };
  modelingNotes?: {
    polyCountEstimate?: string;
    keyFeatures?: string[];
    challenges?: string[];
    references?: string[];
  };
}

export interface ExternalSearchOptions {
  sources: {
    googleSearch: boolean;
    wikipedia: boolean;
    wikimediaCommons: boolean;
    wikidata: boolean;
    youtube: boolean;
    flickr: boolean;
    freesound: boolean;
  };
  maxResultsPerSource: number;
  mediaTypes: ("image" | "video" | "audio" | "3d")[];
  requireLicense: boolean;
  minRelevanceScore: number;
  extractTechnicalSpecs: boolean;
  modelingFocus: boolean;
  targetLang: string;
}

export interface ExternalSearchResult {
  sources: ExternalSource[];
  technicalSpecs?: TechnicalSpecs;
  mediaAssets: Array<{
    url: string;
    title: string;
    type: "image" | "video" | "audio";
    sourceType: ExternalSourceType;
    license?: string;
    author?: string;
  }>;
  synthesizedContent?: string;
}

// ============================================
// Default Options
// ============================================

export const DEFAULT_SEARCH_OPTIONS: ExternalSearchOptions = {
  sources: {
    googleSearch: true,
    wikipedia: true,
    wikimediaCommons: true,
    wikidata: false,
    youtube: false,
    flickr: false,
    freesound: false,
  },
  maxResultsPerSource: 10,
  mediaTypes: ["image"],
  requireLicense: true,
  minRelevanceScore: 0.3,
  extractTechnicalSpecs: true,
  modelingFocus: false,
  targetLang: "en",
};

// ============================================
// Utility Functions
// ============================================

function generateId(): string {
  return `es_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function isModelingEntityType(entityType: string): boolean {
  return ["item", "weapon", "vehicle", "building", "location", "object", "equipment", "tool", "device"].includes(
    entityType.toLowerCase()
  );
}

// ============================================
// Prompt Builders
// ============================================

/**
 * Build prompt for generating search queries
 */
export function buildSearchQueryPrompt(
  entityTitle: string,
  entityType: EntityType,
  existingContext: string,
  options: ExternalSearchOptions
): string {
  const isModeling = options.modelingFocus || isModelingEntityType(entityType);

  const focusAreas = isModeling
    ? `
FOCUS AREAS (3D MODELING & VFX):
1. TECHNICAL SPECIFICATIONS
   - Exact dimensions (length, width, height, diameter)
   - Weight and mass distribution
   - Materials and surface properties
   - Cross-sectional geometry

2. VISUAL REFERENCES
   - Technical diagrams, blueprints, schematics
   - Orthographic projections (front, side, top views)
   - Cross-sections, cutaway views, exploded diagrams
   - High-resolution photographs from multiple angles

3. STRUCTURAL DETAILS
   - Component breakdown and assembly
   - Joint and connection types
   - Surface textures and finishes
   - Color and material variations

4. HISTORICAL/VARIANT INFORMATION
   - Different versions and models
   - Manufacturing periods and methods
   - Notable examples and specimens
`
    : `
FOCUS AREAS (WORLDBUILDING):
1. OVERVIEW & DESCRIPTION
   - Definition and key characteristics
   - Visual appearance and notable features

2. HISTORICAL CONTEXT
   - Origin and development
   - Cultural significance
   - Notable events or uses

3. RELATIONSHIPS
   - Related concepts, entities, or categories
   - Influences and derivatives

4. MEDIA REFERENCES
   - Representative images
   - Relevant videos or audio
`;

  return `You are a research query generator for a comprehensive reference database.

SUBJECT: "${entityTitle}"
TYPE: ${entityType}
TARGET LANGUAGE: ${options.targetLang}

EXISTING CONTEXT:
${existingContext.slice(0, 1500)}

${focusAreas}

Generate optimized search queries for multiple sources.

OUTPUT FORMAT (JSON only, no markdown):
{
  "queries": {
    "general": ["comprehensive query 1", "comprehensive query 2"],
    "technical": ["technical specs query", "dimensions query"],
    "visual": ["diagram query", "reference image query"],
    "historical": ["history query", "origin query"]
  },
  "wikimediaCommonsQueries": ["commons search 1", "commons search 2"],
  "youtubeQueries": ["video search 1"],
  "suggestedCategories": ["Category:Name1", "Category:Name2"]
}`;
}

/**
 * Build prompt for evaluating and scoring sources
 */
export function buildSourceEvaluationPrompt(
  entityTitle: string,
  entityType: EntityType,
  sources: ExternalSource[],
  options: ExternalSearchOptions
): string {
  const sourceList = sources
    .slice(0, 30)
    .map(
      (s, i) =>
        `${i + 1}. [${s.sourceType}] "${s.title}"
   URL: ${s.url}
   Snippet: ${(s.snippet || "").slice(0, 300)}`
    )
    .join("\n\n");

  const isModeling = options.modelingFocus || isModelingEntityType(entityType);

  return `You are evaluating external sources for a ${isModeling ? "3D modeling reference" : "worldbuilding"} database.

SUBJECT: "${entityTitle}"
TYPE: ${entityType}
MODELING FOCUS: ${isModeling}

SOURCES FOUND:
${sourceList}

Evaluate each source for:
1. RELEVANCE (0-100): How directly related to "${entityTitle}"?
2. RELIABILITY: Is this a trustworthy source? (high/medium/low)
3. UNIQUE VALUE: What unique information does it provide?
4. MEDIA VALUE: Quality of images/videos/audio (high/medium/low/none)
${isModeling ? "5. TECHNICAL VALUE: Does it contain specs, dimensions, diagrams? (high/medium/low/none)" : ""}

OUTPUT FORMAT (JSON only, no markdown):
{
  "evaluations": [
    {
      "sourceIndex": 1,
      "relevanceScore": 85,
      "reliability": "high",
      "uniqueValue": "Provides detailed cross-section diagrams",
      "mediaValue": "high",
      ${isModeling ? '"technicalValue": "high",' : ""}
      "shouldImport": true,
      "importPriority": 1,
      "keyInformation": ["blade length: 60cm", "material: steel"]
    }
  ],
  "synthesisNotes": "How to combine these sources effectively"
}`;
}

/**
 * Build prompt for extracting technical specifications
 */
export function buildTechnicalSpecsPrompt(
  entityTitle: string,
  entityType: EntityType,
  combinedContent: string
): string {
  return `You are a technical specification extractor for a 3D modeling reference database.

SUBJECT: "${entityTitle}"
TYPE: ${entityType}

COMBINED SOURCE CONTENT:
${combinedContent.slice(0, 10000)}

Extract ALL technical specifications with precision. Include units and sources.

OUTPUT FORMAT (JSON only, no markdown):
{
  "dimensions": {
    "length": { "value": 60.6, "unit": "cm", "note": "blade length", "source": "Wikipedia" },
    "width": { "value": 3.0, "unit": "cm", "note": "at widest point" }
  },
  "materials": [
    {
      "part": "blade",
      "material": "high-carbon steel",
      "properties": { "hardness": "HRC 60-62" },
      "source": "Technical manual"
    }
  ],
  "weight": { "value": 1.1, "unit": "kg", "note": "typical range 0.9-1.4kg" },
  "components": [
    {
      "name": "handle",
      "description": "Two-handed grip wrapped in cord",
      "subComponents": ["wrapping", "ornaments", "end cap"]
    }
  ],
  "variants": [
    { "name": "long variant", "differences": ["longer blade", "different curve"] }
  ],
  "manufacturingInfo": {
    "period": "15th-19th century",
    "location": "Japan",
    "method": "Traditional forging"
  },
  "modelingNotes": {
    "polyCountEstimate": "5000-15000 for game-ready",
    "keyFeatures": ["curved blade", "distinctive guard shape"],
    "challenges": ["complex wrapping pattern", "subtle blade curvature"],
    "references": ["See diagram.svg for profile"]
  }
}

RULES:
- Include units for ALL measurements
- Note the source of each specification when known
- If a value is approximate, note that (e.g., "~60cm", "approximately")
- For modeling notes, think like a 3D artist preparing to model this
- Include component breakdowns for complex subjects
- Extract variant information when available`;
}

/**
 * Build prompt for synthesizing multi-source content
 */
export function buildMultiSourceSynthesisPrompt(
  entityTitle: string,
  entityType: EntityType,
  sources: ExternalSource[],
  targetLang: string,
  technicalSpecs?: TechnicalSpecs
): string {
  const sourceList = sources
    .filter((s) => s.content || s.snippet)
    .map(
      (s, i) =>
        `SOURCE ${i + 1} [${s.sourceType}]: ${s.title}
URL: ${s.url}
CONTENT:
${(s.content || s.snippet || "").slice(0, 3000)}`
    )
    .join("\n\n---\n\n");

  const specsSection = technicalSpecs
    ? `
EXTRACTED TECHNICAL SPECIFICATIONS:
${JSON.stringify(technicalSpecs, null, 2).slice(0, 2000)}
`
    : "";

  return `You are synthesizing information from multiple sources into a comprehensive article.

SUBJECT: "${entityTitle}"
TYPE: ${entityType}
OUTPUT LANGUAGE: ${targetLang}

${specsSection}

SOURCES:
${sourceList}

Create a well-structured Markdown article that:
1. Synthesizes information from all sources (don't just concatenate)
2. Resolves any conflicting information (note disagreements if unresolvable)
3. Includes a summary section with key points
4. Organizes into logical sections with ## headings
5. Integrates technical specifications naturally into the text
6. Ends with a Sources section listing all references

STRUCTURE:
## Summary
- Key point 1
- Key point 2
- Key point 3

## Overview
[Main description]

## Technical Details (if applicable)
[Specifications, dimensions, materials]

## History / Background
[Historical context]

## Variants / Types (if applicable)
[Different versions]

## Sources
- [Source 1 title](url)
- [Source 2 title](url)

Write in ${targetLang}. Be comprehensive but concise.`;
}

// ============================================
// Search Functions
// ============================================

/**
 * Search Wikimedia Commons for media
 */
export async function searchWikimediaCommons(
  query: string,
  mediaTypes: string[],
  limit: number = 20
): Promise<ExternalSource[]> {
  const sources: ExternalSource[] = [];

  // Build search query with media type filters
  const typeFilters = mediaTypes.map((t) => {
    switch (t) {
      case "image":
        return "filetype:bitmap OR filetype:drawing";
      case "video":
        return "filetype:video";
      case "audio":
        return "filetype:audio";
      default:
        return "";
    }
  }).filter(Boolean).join(" OR ");

  const searchQuery = typeFilters ? `${query} (${typeFilters})` : query;

  try {
    const params = new URLSearchParams({
      action: "query",
      list: "search",
      srsearch: searchQuery,
      srnamespace: "6", // File namespace
      srlimit: String(limit),
      format: "json",
      origin: "*",
    });

    const response = await fetch(
      `https://commons.wikimedia.org/w/api.php?${params.toString()}`
    );

    if (!response.ok) return sources;

    const data = await response.json();
    const results = data?.query?.search ?? [];

    for (const result of results) {
      const title = String(result.title || "").replace(/^File:/i, "").trim();
      if (!title) continue;

      // Get full image info
      const imageInfo = await fetchWikiImageInfo("commons", title);
      if (!imageInfo) continue;

      sources.push({
        id: generateId(),
        sourceType: "wikimedia_commons",
        url: imageInfo.url,
        title,
        snippet: result.snippet?.replace(/<[^>]*>/g, ""),
        relevanceScore: 0.5,
        licenseId: imageInfo.licenseId ?? undefined,
        licenseUrl: imageInfo.licenseUrl ?? undefined,
        author: imageInfo.author ?? undefined,
        retrievedAt: new Date(),
        verified: true,
        metadata: {
          width: imageInfo.width,
          height: imageInfo.height,
          mime: imageInfo.mime,
          size: imageInfo.size,
        },
      });
    }
  } catch (error) {
    console.error("Wikimedia Commons search failed:", error);
  }

  return sources;
}

/**
 * Search YouTube for reference videos (returns embed URLs)
 */
export async function searchYouTube(
  query: string,
  limit: number = 5
): Promise<ExternalSource[]> {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    console.warn("YouTube API key not configured");
    return [];
  }

  const sources: ExternalSource[] = [];

  try {
    const params = new URLSearchParams({
      part: "snippet",
      q: query,
      type: "video",
      maxResults: String(limit),
      videoEmbeddable: "true",
      key: apiKey,
    });

    const response = await fetch(
      `https://www.googleapis.com/youtube/v3/search?${params.toString()}`
    );

    if (!response.ok) return sources;

    const data = await response.json();
    const items = data?.items ?? [];

    for (const item of items) {
      const videoId = item.id?.videoId;
      const snippet = item.snippet;
      if (!videoId || !snippet) continue;

      sources.push({
        id: generateId(),
        sourceType: "youtube",
        url: `https://www.youtube.com/watch?v=${videoId}`,
        title: snippet.title,
        snippet: snippet.description?.slice(0, 500),
        relevanceScore: 0.5,
        author: snippet.channelTitle,
        publishedAt: snippet.publishedAt ? new Date(snippet.publishedAt) : undefined,
        retrievedAt: new Date(),
        verified: true,
        metadata: {
          videoId,
          channelId: snippet.channelId,
          thumbnails: snippet.thumbnails,
          embedUrl: `https://www.youtube.com/embed/${videoId}`,
        },
      });
    }
  } catch (error) {
    console.error("YouTube search failed:", error);
  }

  return sources;
}

/**
 * Query Wikidata for structured data
 */
export async function queryWikidata(
  entityName: string,
  properties: string[] = ["P2043", "P2067", "P186", "P571", "P18"] // length, mass, material, inception, image
): Promise<ExternalSource[]> {
  const sources: ExternalSource[] = [];

  try {
    // First, find the entity
    const searchParams = new URLSearchParams({
      action: "wbsearchentities",
      search: entityName,
      language: "en",
      format: "json",
      origin: "*",
    });

    const searchResponse = await fetch(
      `https://www.wikidata.org/w/api.php?${searchParams.toString()}`
    );

    if (!searchResponse.ok) return sources;

    const searchData = await searchResponse.json();
    const entity = searchData?.search?.[0];
    if (!entity?.id) return sources;

    // Get entity data
    const entityParams = new URLSearchParams({
      action: "wbgetentities",
      ids: entity.id,
      props: "claims|labels|descriptions",
      languages: "en|ja",
      format: "json",
      origin: "*",
    });

    const entityResponse = await fetch(
      `https://www.wikidata.org/w/api.php?${entityParams.toString()}`
    );

    if (!entityResponse.ok) return sources;

    const entityData = await entityResponse.json();
    const entityInfo = entityData?.entities?.[entity.id];
    if (!entityInfo) return sources;

    // Extract relevant claims
    const claims: Record<string, unknown> = {};
    for (const propId of properties) {
      const propClaims = entityInfo.claims?.[propId];
      if (propClaims && propClaims.length > 0) {
        claims[propId] = propClaims.map((c: { mainsnak?: { datavalue?: unknown } }) => c.mainsnak?.datavalue);
      }
    }

    sources.push({
      id: generateId(),
      sourceType: "wikidata",
      url: `https://www.wikidata.org/wiki/${entity.id}`,
      title: entity.label || entityName,
      snippet: entity.description,
      relevanceScore: 0.8,
      retrievedAt: new Date(),
      verified: true,
      metadata: {
        wikidataId: entity.id,
        labels: entityInfo.labels,
        descriptions: entityInfo.descriptions,
        claims,
      },
    });
  } catch (error) {
    console.error("Wikidata query failed:", error);
  }

  return sources;
}

/**
 * Use Gemini with Google Search grounding to find web sources
 */
export async function searchWithGeminiGrounding(
  query: string,
  entityType: EntityType,
  options: ExternalSearchOptions,
  llmProvider: LlmProvider = "gemini_ai"
): Promise<ExternalSource[]> {
  const sources: ExternalSource[] = [];

  const isModeling = options.modelingFocus || isModelingEntityType(entityType);

  const prompt = isModeling
    ? `Search for detailed technical information about "${query}" for 3D modeling reference.

Find:
1. Technical specifications (dimensions, materials, weight)
2. Diagrams, blueprints, cross-section images
3. Historical information and variants
4. Manufacturing or construction details

For each source found, extract:
- URL
- Title
- Key facts and measurements
- Whether it contains useful diagrams/images

Respond with a structured list of sources and their key information.`
    : `Search for comprehensive information about "${query}" for a worldbuilding reference database.

Find:
1. Overview and description
2. Historical context
3. Notable examples
4. Related concepts

For each source found, extract:
- URL
- Title
- Key information

Respond with a structured list of sources and their key information.`;

  try {
    // Note: This uses the standard generateText which doesn't have grounding enabled yet
    // In a full implementation, we'd use the Gemini API directly with grounding tools
    const response = await generateText({
      provider: llmProvider,
      prompt: `[SIMULATED GROUNDED SEARCH - In production, use Gemini API with googleSearch tool]

${prompt}

Since grounding is not fully implemented, return a JSON response with suggested search approaches:
{
  "searchQueries": ["query 1", "query 2"],
  "suggestedSources": [
    {"type": "wikipedia", "query": "..."},
    {"type": "commons", "query": "..."}
  ],
  "note": "Use these queries with the respective APIs"
}`,
    });

    // Parse the response (this is a placeholder - real implementation would parse grounding results)
    try {
      const parsed = JSON.parse(response.replace(/```json\n?|\n?```/g, "").trim());
      // Return as metadata for further processing
      sources.push({
        id: generateId(),
        sourceType: "google_search",
        url: "",
        title: "Search Suggestions",
        snippet: "Suggested queries for external sources",
        relevanceScore: 1,
        retrievedAt: new Date(),
        verified: false,
        metadata: parsed,
      });
    } catch {
      // If parsing fails, still useful for debugging
      console.log("Grounding search response:", response.slice(0, 500));
    }
  } catch (error) {
    console.error("Gemini grounding search failed:", error);
  }

  return sources;
}

// ============================================
// Main Search Orchestrator
// ============================================

/**
 * Execute comprehensive external search across multiple sources
 */
export async function executeExternalSearch(
  entityTitle: string,
  entityType: EntityType,
  existingContext: string,
  options: Partial<ExternalSearchOptions> = {},
  llmProvider: LlmProvider = "gemini_ai"
): Promise<ExternalSearchResult> {
  const opts: ExternalSearchOptions = { ...DEFAULT_SEARCH_OPTIONS, ...options };
  const allSources: ExternalSource[] = [];
  const mediaAssets: ExternalSearchResult["mediaAssets"] = [];

  console.log(`[ESE] Starting external search for "${entityTitle}" (${entityType})`);

  // 1. Generate optimized search queries
  let searchQueries: Record<string, string[]> = {
    general: [entityTitle],
    technical: [`${entityTitle} specifications dimensions`],
    visual: [`${entityTitle} diagram blueprint`],
  };

  try {
    const queryPrompt = buildSearchQueryPrompt(entityTitle, entityType, existingContext, opts);
    const queryResponse = await generateText({ provider: llmProvider, prompt: queryPrompt });
    const parsed = JSON.parse(queryResponse.replace(/```json\n?|\n?```/g, "").trim());
    if (parsed.queries) {
      searchQueries = parsed.queries;
    }
  } catch (error) {
    console.warn("[ESE] Query generation failed, using defaults:", error);
  }

  // 2. Search Wikipedia (if enabled)
  if (opts.sources.wikipedia) {
    console.log("[ESE] Searching Wikipedia...");
    try {
      const wikiResults = await searchWiki(entityTitle, opts.targetLang);
      for (const result of wikiResults.slice(0, opts.maxResultsPerSource)) {
        allSources.push({
          id: generateId(),
          sourceType: "wikipedia",
          url: result.url,
          title: result.title,
          snippet: result.snippet?.replace(/<[^>]*>/g, ""),
          relevanceScore: 0.7,
          retrievedAt: new Date(),
          verified: true,
          metadata: { pageId: result.pageId },
        });
      }
    } catch (error) {
      console.error("[ESE] Wikipedia search failed:", error);
    }
  }

  // 3. Search Wikimedia Commons (if enabled)
  if (opts.sources.wikimediaCommons) {
    console.log("[ESE] Searching Wikimedia Commons...");
    const visualQueries = searchQueries.visual || [`${entityTitle}`];
    for (const query of visualQueries.slice(0, 2)) {
      const commonsResults = await searchWikimediaCommons(
        query,
        opts.mediaTypes,
        Math.ceil(opts.maxResultsPerSource / 2)
      );
      allSources.push(...commonsResults);

      // Add to media assets
      for (const source of commonsResults) {
        if (source.url && source.metadata?.mime) {
          const mime = String(source.metadata.mime);
          let type: "image" | "video" | "audio" = "image";
          if (mime.startsWith("video/")) type = "video";
          else if (mime.startsWith("audio/")) type = "audio";

          mediaAssets.push({
            url: source.url,
            title: source.title,
            type,
            sourceType: "wikimedia_commons",
            license: source.licenseId,
            author: source.author,
          });
        }
      }
    }
  }

  // 4. Query Wikidata (if enabled)
  if (opts.sources.wikidata) {
    console.log("[ESE] Querying Wikidata...");
    const wikidataResults = await queryWikidata(entityTitle);
    allSources.push(...wikidataResults);
  }

  // 5. Search YouTube (if enabled)
  if (opts.sources.youtube) {
    console.log("[ESE] Searching YouTube...");
    const youtubeResults = await searchYouTube(
      `${entityTitle} explained tutorial`,
      Math.min(5, opts.maxResultsPerSource)
    );
    allSources.push(...youtubeResults);

    for (const source of youtubeResults) {
      mediaAssets.push({
        url: source.url,
        title: source.title,
        type: "video",
        sourceType: "youtube",
        author: source.author,
      });
    }
  }

  // 6. Google Search with Gemini Grounding (if enabled)
  if (opts.sources.googleSearch) {
    console.log("[ESE] Searching with Gemini Grounding...");
    const groundingResults = await searchWithGeminiGrounding(
      entityTitle,
      entityType,
      opts,
      llmProvider
    );
    allSources.push(...groundingResults);
  }

  console.log(`[ESE] Found ${allSources.length} sources, ${mediaAssets.length} media assets`);

  // 7. Evaluate and score sources
  if (allSources.length > 0) {
    console.log("[ESE] Evaluating sources...");
    try {
      const evalPrompt = buildSourceEvaluationPrompt(entityTitle, entityType, allSources, opts);
      const evalResponse = await generateText({ provider: llmProvider, prompt: evalPrompt });
      const evaluations = JSON.parse(evalResponse.replace(/```json\n?|\n?```/g, "").trim());

      if (evaluations.evaluations) {
        for (const ev of evaluations.evaluations) {
          const sourceIndex = ev.sourceIndex - 1;
          if (sourceIndex >= 0 && sourceIndex < allSources.length) {
            allSources[sourceIndex].relevanceScore = ev.relevanceScore / 100;
            if (ev.keyInformation) {
              allSources[sourceIndex].metadata = {
                ...allSources[sourceIndex].metadata,
                keyInformation: ev.keyInformation,
              };
            }
          }
        }
      }
    } catch (error) {
      console.warn("[ESE] Source evaluation failed:", error);
    }
  }

  // 8. Filter by relevance score
  const filteredSources = allSources.filter((s) => s.relevanceScore >= opts.minRelevanceScore);
  console.log(`[ESE] ${filteredSources.length} sources passed relevance filter`);

  // 9. Extract technical specs (if enabled)
  let technicalSpecs: TechnicalSpecs | undefined;
  if (opts.extractTechnicalSpecs && filteredSources.length > 0) {
    console.log("[ESE] Extracting technical specifications...");
    try {
      const combinedContent = filteredSources
        .map((s) => `[${s.sourceType}] ${s.title}\n${s.snippet || s.content || ""}`)
        .join("\n\n---\n\n");

      const specsPrompt = buildTechnicalSpecsPrompt(entityTitle, entityType, combinedContent);
      const specsResponse = await generateText({ provider: llmProvider, prompt: specsPrompt });
      technicalSpecs = JSON.parse(specsResponse.replace(/```json\n?|\n?```/g, "").trim());
    } catch (error) {
      console.warn("[ESE] Technical specs extraction failed:", error);
    }
  }

  return {
    sources: filteredSources,
    technicalSpecs,
    mediaAssets,
  };
}

/**
 * Synthesize content from multiple external sources
 */
export async function synthesizeFromExternalSources(
  entityTitle: string,
  entityType: EntityType,
  sources: ExternalSource[],
  targetLang: string,
  technicalSpecs?: TechnicalSpecs,
  llmProvider: LlmProvider = "gemini_ai"
): Promise<string> {
  const prompt = buildMultiSourceSynthesisPrompt(
    entityTitle,
    entityType,
    sources,
    targetLang,
    technicalSpecs
  );

  const synthesized = await generateText({ provider: llmProvider, prompt });
  return synthesized;
}
