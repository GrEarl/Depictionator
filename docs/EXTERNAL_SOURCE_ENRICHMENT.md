# External Source Enrichment (ESE) - 外部ソース拡張機能

## 概要

Wikipediaインポート機能を拡張し、LLMのWeb検索能力（Gemini Grounding with Google Search）と専門ソースAPI統合により、より豊富なコンテキスト・マルチメディアを収集する機能。

---

## 1. アーキテクチャ

```
┌──────────────────────────────────────────────────────────────────┐
│                    External Source Enrichment                     │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐          │
│  │  Wikipedia  │    │   Gemini    │    │  Specialized │          │
│  │   Import    │───▶│  Grounding  │───▶│    Sources   │          │
│  │  (existing) │    │  + Search   │    │              │          │
│  └─────────────┘    └─────────────┘    └─────────────┘          │
│         │                  │                  │                   │
│         ▼                  ▼                  ▼                   │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │              Source Aggregator & Validator               │    │
│  │  - Deduplication                                         │    │
│  │  - License Verification                                  │    │
│  │  - Relevance Scoring                                     │    │
│  │  - Media Download & Processing                           │    │
│  └─────────────────────────────────────────────────────────┘    │
│                              │                                    │
│                              ▼                                    │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │              LLM Synthesis & Structure                    │    │
│  │  - Multi-source Article Generation                       │    │
│  │  - Technical Specs Extraction                            │    │
│  │  - 3D Modeling Reference Organization                    │    │
│  └─────────────────────────────────────────────────────────┘    │
│                              │                                    │
│                              ▼                                    │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                    Entity + Assets                        │    │
│  │  - Article with rich context                             │    │
│  │  - Technical specs JSON                                  │    │
│  │  - Multimedia gallery                                    │    │
│  │  - Source records with full attribution                  │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘
```

---

## 2. 対応外部ソース

### 2.1 汎用検索（Gemini Grounding）

```typescript
// Gemini API with Google Search grounding
const request = {
  contents: [{ parts: [{ text: prompt }] }],
  tools: [{
    googleSearch: {}  // Enable grounding with Google Search
  }]
};
```

**用途**:
- Wikipedia以外の解説記事
- 専門家のブログ・論文
- ニュース記事
- フォーラム・Q&A

### 2.2 専門メディアソース

| ソース | 対象コンテンツ | API/方式 | ライセンス |
|--------|---------------|----------|-----------|
| **Wikimedia Commons** | 画像・音声・動画 | MediaWiki API | CC-BY-SA / PD |
| **Sketchfab** | 3Dモデル参考 | REST API | 個別確認要 |
| **Internet Archive** | 歴史的資料・書籍 | Archive.org API | 多様 |
| **YouTube** | 解説動画・音声 | Data API v3 | 埋め込みのみ |
| **Flickr** | CC写真 | Flickr API | CC各種 |
| **Unsplash** | 高品質写真 | Unsplash API | Unsplash License |
| **Freesound** | 効果音・環境音 | Freesound API | CC各種 |
| **JSTOR/arXiv** | 学術論文 | 各API | 引用のみ |
| **3D Warehouse** | 建築モデル参考 | Web scraping | 個別確認要 |

### 2.3 専門データベース

| ソース | 対象 | 形式 |
|--------|------|------|
| **Wikidata** | 構造化データ（寸法、年代） | SPARQL |
| **Getty Vocabularies** | 芸術・建築用語 | LOD |
| **GeoNames** | 地理情報 | REST API |
| **MusicBrainz** | 音楽メタデータ | REST API |

---

## 3. データモデル拡張

### 3.1 Prisma Schema 追加

```prisma
// 外部ソース検索ジョブ
model ExternalSearchJob {
  id              String   @id @default(cuid())
  workspaceId     String
  entityId        String?
  query           String
  entityType      EntityType
  status          SearchJobStatus  @default(pending)
  sourcesConfig   String   // JSON: enabled sources, limits
  resultsJson     String?  // JSON: aggregated results
  errorMessage    String?
  createdAt       DateTime @default(now())
  completedAt     DateTime?
  createdById     String?

  workspace       Workspace @relation(fields: [workspaceId], references: [id])
  entity          Entity?   @relation(fields: [entityId], references: [id])

  @@index([workspaceId, status])
}

enum SearchJobStatus {
  pending
  searching
  processing
  completed
  failed
}

// 外部ソース結果
model ExternalSource {
  id              String   @id @default(cuid())
  workspaceId     String
  jobId           String?
  sourceType      ExternalSourceType
  url             String
  title           String
  snippet         String?
  contentJson     String?  // Full extracted content
  mediaUrls       String[] // Discovered media URLs
  relevanceScore  Float    @default(0)
  licenseId       String?
  licenseUrl      String?
  author          String?
  publishedAt     DateTime?
  retrievedAt     DateTime @default(now())
  verified        Boolean  @default(false)
  imported        Boolean  @default(false)

  workspace       Workspace @relation(fields: [workspaceId], references: [id])
  job             ExternalSearchJob? @relation(fields: [jobId], references: [id])

  @@index([workspaceId, sourceType])
  @@index([jobId])
}

enum ExternalSourceType {
  google_search
  wikipedia
  wikimedia_commons
  wikidata
  youtube
  flickr
  unsplash
  freesound
  sketchfab
  internet_archive
  academic
  other
}

// Entity技術仕様（構造化）
// Entity モデルに追加フィールド
model Entity {
  // ... existing fields ...

  technicalSpecsJson  String?  // 構造化技術仕様
  externalSearchJobs  ExternalSearchJob[]
}
```

### 3.2 技術仕様 JSON スキーマ

```typescript
interface TechnicalSpecs {
  dimensions?: {
    [key: string]: {
      value: number;
      unit: string;
      note?: string;
      source?: string;
    };
  };
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
```

---

## 4. API 設計

### 4.1 エンドポイント

```
POST /api/external-search/start
  - クエリと設定を受け取り検索ジョブを開始
  - レスポンス: { jobId, status }

GET /api/external-search/status/:jobId
  - ジョブの進捗を取得
  - レスポンス: { status, progress, partialResults }

GET /api/external-search/results/:jobId
  - 完了したジョブの結果を取得
  - レスポンス: { sources[], media[], technicalSpecs }

POST /api/external-search/import
  - 選択したソースをエンティティにインポート
  - レスポンス: { entityId, importedSources, importedAssets }

POST /api/wiki/import/article (既存を拡張)
  - enableExternalSearch: true で外部検索を有効化
  - externalSourceTypes: ['google_search', 'wikimedia_commons', ...]
```

### 4.2 検索リクエスト

```typescript
interface ExternalSearchRequest {
  workspaceId: string;
  query: string;
  entityType: EntityType;
  targetLang: string;

  // ソース設定
  sources: {
    wikipedia: boolean;
    googleSearch: boolean;
    wikimediaCommons: boolean;
    wikidata: boolean;
    youtube: boolean;
    flickr: boolean;
    freesound: boolean;
    sketchfab: boolean;
  };

  // 検索オプション
  options: {
    maxResultsPerSource: number;  // default: 10
    mediaTypes: ('image' | 'video' | 'audio' | '3d')[];
    requireLicense: boolean;  // CC/PD only
    minRelevanceScore: number;  // 0-1
    extractTechnicalSpecs: boolean;
    modelingFocus: boolean;  // Use modeling-optimized prompts
  };
}
```

---

## 5. LLM プロンプト設計

### 5.1 外部検索クエリ生成

```typescript
export function buildSearchQueryPrompt(
  entityTitle: string,
  entityType: EntityType,
  existingContext: string
): string {
  return `
You are a research assistant for a worldbuilding reference database.

SUBJECT: "${entityTitle}"
TYPE: ${entityType}

EXISTING CONTEXT:
${existingContext.slice(0, 2000)}

Generate search queries to find additional information from external sources.
Focus on finding:

1. TECHNICAL INFORMATION
   - Dimensions, measurements, specifications
   - Materials, construction methods
   - Variants and versions

2. VISUAL REFERENCES
   - Diagrams, blueprints, schematics
   - High-quality photographs from multiple angles
   - Cross-sections, cutaway views

3. HISTORICAL CONTEXT
   - Origin, development history
   - Notable examples
   - Cultural significance

4. 3D MODELING RESOURCES (if applicable)
   - Reference sheets, orthographic views
   - Texture references
   - Structural details

OUTPUT FORMAT (JSON):
{
  "queries": {
    "technical": ["query1", "query2"],
    "visual": ["query1", "query2"],
    "historical": ["query1", "query2"],
    "modeling": ["query1", "query2"]
  },
  "wikidataSparql": "SPARQL query if applicable",
  "suggestedSources": ["source1", "source2"]
}
`;
}
```

### 5.2 ソース評価・統合

```typescript
export function buildSourceEvaluationPrompt(
  entityTitle: string,
  entityType: EntityType,
  sources: ExternalSource[]
): string {
  const sourceList = sources.map((s, i) =>
    `${i + 1}. [${s.sourceType}] ${s.title}\n   URL: ${s.url}\n   Snippet: ${s.snippet?.slice(0, 200)}`
  ).join('\n\n');

  return `
You are evaluating external sources for a worldbuilding reference database.

SUBJECT: "${entityTitle}"
TYPE: ${entityType}

SOURCES FOUND:
${sourceList}

For each source, evaluate:
1. RELEVANCE (0-100): How directly related to the subject?
2. RELIABILITY: Is this a trustworthy source?
3. UNIQUE VALUE: Does it provide information not in other sources?
4. MEDIA VALUE: Does it contain useful images/videos/audio?
5. TECHNICAL VALUE: Does it contain specs, dimensions, or modeling info?

OUTPUT FORMAT (JSON):
{
  "evaluations": [
    {
      "sourceIndex": 1,
      "relevanceScore": 85,
      "reliability": "high",
      "uniqueValue": "Provides detailed cross-section diagrams",
      "mediaValue": "high",
      "technicalValue": "medium",
      "shouldImport": true,
      "importPriority": 1,
      "extractionNotes": "Focus on the dimension table in section 3"
    }
  ],
  "synthesisStrategy": "How to combine these sources for the article"
}
`;
}
```

### 5.3 技術仕様抽出

```typescript
export function buildTechnicalSpecsExtractionPrompt(
  entityTitle: string,
  entityType: EntityType,
  combinedContent: string
): string {
  return `
You are extracting technical specifications for a 3D modeling reference database.

SUBJECT: "${entityTitle}"
TYPE: ${entityType}

COMBINED SOURCE CONTENT:
${combinedContent.slice(0, 8000)}

Extract ALL technical specifications you can find. Be thorough and precise.

OUTPUT FORMAT (JSON):
{
  "dimensions": {
    "length": { "value": 60.6, "unit": "cm", "note": "blade length (nagasa)", "source": "Wikipedia" },
    "width": { "value": 3.0, "unit": "cm", "note": "blade width at base" }
  },
  "materials": [
    { "part": "blade", "material": "tamahagane steel", "properties": {"carbon": "0.5-1.5%"} }
  ],
  "weight": { "value": 1.1, "unit": "kg", "note": "typical range 0.9-1.4kg" },
  "components": [
    {
      "name": "tsuka (handle)",
      "description": "Wrapped handle for two-handed grip",
      "subComponents": ["tsuka-ito (wrapping)", "menuki (ornaments)", "samegawa (ray skin)"]
    }
  ],
  "variants": [
    { "name": "tachi", "differences": ["longer blade", "more curvature", "worn edge-down"] }
  ],
  "modelingNotes": {
    "polyCountEstimate": "5000-15000 for game-ready, 50000+ for cinematic",
    "keyFeatures": ["curved blade with shinogi (ridge line)", "circular or squared tsuba"],
    "challenges": ["accurate hamon (temper line) texture", "complex tsuka-ito wrapping pattern"],
    "references": ["File:Katana_diagram.svg for part names", "See cross-section for blade geometry"]
  }
}

IMPORTANT:
- Include units for all measurements
- Note the source of each specification
- If a value is approximate or variable, note that
- For modeling notes, think like a 3D artist
`;
}
```

---

## 6. 実装フロー

### 6.1 検索・収集フェーズ

```typescript
async function executeExternalSearch(job: ExternalSearchJob): Promise<ExternalSource[]> {
  const sources: ExternalSource[] = [];
  const config = JSON.parse(job.sourcesConfig);

  // 1. Gemini Grounding でWeb検索
  if (config.sources.googleSearch) {
    const searchResults = await searchWithGeminiGrounding(job.query, job.entityType);
    sources.push(...searchResults);
  }

  // 2. Wikipedia（既存機能活用）
  if (config.sources.wikipedia) {
    const wikiResults = await searchMultiLanguageWikipedia(job.query);
    sources.push(...wikiResults);
  }

  // 3. Wikimedia Commons
  if (config.sources.wikimediaCommons) {
    const commonsResults = await searchWikimediaCommons(job.query, config.options.mediaTypes);
    sources.push(...commonsResults);
  }

  // 4. Wikidata SPARQL
  if (config.sources.wikidata) {
    const wikidataResults = await queryWikidata(job.query, job.entityType);
    sources.push(...wikidataResults);
  }

  // 5. YouTube（埋め込み用）
  if (config.sources.youtube) {
    const youtubeResults = await searchYouTube(job.query, config.options);
    sources.push(...youtubeResults);
  }

  // 6. その他の専門ソース
  // ...

  return sources;
}
```

### 6.2 評価・フィルタリングフェーズ

```typescript
async function evaluateAndFilterSources(
  sources: ExternalSource[],
  entityTitle: string,
  entityType: EntityType
): Promise<ExternalSource[]> {
  // LLMで評価
  const evaluationPrompt = buildSourceEvaluationPrompt(entityTitle, entityType, sources);
  const evaluationResult = await generateText({ provider: 'gemini_ai', prompt: evaluationPrompt });
  const evaluations = JSON.parse(evaluationResult);

  // スコア付与とフィルタリング
  const scoredSources = sources.map((source, index) => {
    const eval = evaluations.evaluations.find(e => e.sourceIndex === index + 1);
    return {
      ...source,
      relevanceScore: eval?.relevanceScore / 100 || 0,
      shouldImport: eval?.shouldImport || false,
      importPriority: eval?.importPriority || 99
    };
  });

  // 関連性スコアでソート、閾値以下を除外
  return scoredSources
    .filter(s => s.relevanceScore >= 0.3 && s.shouldImport)
    .sort((a, b) => a.importPriority - b.importPriority);
}
```

### 6.3 コンテンツ抽出・統合フェーズ

```typescript
async function extractAndSynthesizeContent(
  sources: ExternalSource[],
  entityTitle: string,
  entityType: EntityType,
  targetLang: string
): Promise<{
  articleBody: string;
  technicalSpecs: TechnicalSpecs;
  mediaAssets: MediaAsset[];
}> {
  // 各ソースからコンテンツを取得
  const contents = await Promise.all(
    sources.map(async (source) => {
      if (source.sourceType === 'wikipedia') {
        return await fetchWikipediaFullContent(source.url);
      } else if (source.sourceType === 'google_search') {
        return await fetchWebPageContent(source.url);
      }
      // ...
      return source.contentJson;
    })
  );

  // 技術仕様を構造化抽出
  const combinedContent = contents.join('\n\n---\n\n');
  const specsPrompt = buildTechnicalSpecsExtractionPrompt(entityTitle, entityType, combinedContent);
  const technicalSpecs = JSON.parse(await generateText({ provider: 'gemini_ai', prompt: specsPrompt }));

  // 記事本文を合成
  const articlePrompt = buildMultiSourceSynthesisPrompt(entityTitle, entityType, sources, targetLang);
  const articleBody = await generateText({ provider: 'gemini_ai', prompt: articlePrompt });

  // メディアを収集・分析
  const mediaAssets = await collectAndAnalyzeMedia(sources, entityType);

  return { articleBody, technicalSpecs, mediaAssets };
}
```

---

## 7. UI 設計

### 7.1 インポートパネル拡張

```tsx
// WikiArticleImportPanel.tsx 拡張

<Accordion title="External Source Enrichment" defaultOpen={false}>
  <div className="space-y-4">
    {/* ソース選択 */}
    <div className="grid grid-cols-2 gap-2">
      <Checkbox label="Google Search" checked={sources.googleSearch} onChange={...} />
      <Checkbox label="Wikimedia Commons" checked={sources.wikimediaCommons} onChange={...} />
      <Checkbox label="Wikidata" checked={sources.wikidata} onChange={...} />
      <Checkbox label="YouTube" checked={sources.youtube} onChange={...} />
      <Checkbox label="Flickr (CC)" checked={sources.flickr} onChange={...} />
      <Checkbox label="Freesound" checked={sources.freesound} onChange={...} />
    </div>

    {/* オプション */}
    <div className="space-y-2">
      <Checkbox
        label="Extract Technical Specifications"
        checked={options.extractTechnicalSpecs}
        description="Dimensions, materials, and modeling notes"
      />
      <Checkbox
        label="3D Modeling Focus"
        checked={options.modelingFocus}
        description="Prioritize diagrams, blueprints, and reference images"
      />
      <Checkbox
        label="CC/Public Domain Only"
        checked={options.requireLicense}
        description="Only import media with clear licensing"
      />
    </div>

    {/* 結果プレビュー */}
    {searchResults && (
      <div className="border rounded p-4">
        <h4>Found Sources ({searchResults.length})</h4>
        <SourceList
          sources={searchResults}
          onToggleImport={handleToggleImport}
          onPreview={handlePreviewSource}
        />
      </div>
    )}
  </div>
</Accordion>
```

### 7.2 技術仕様ビューア

```tsx
// TechnicalSpecsViewer.tsx

<Card title="Technical Specifications">
  <Tabs>
    <Tab label="Dimensions">
      <Table>
        {Object.entries(specs.dimensions).map(([key, dim]) => (
          <Row key={key}>
            <Cell>{formatDimensionName(key)}</Cell>
            <Cell>{dim.value} {dim.unit}</Cell>
            <Cell className="text-muted">{dim.note}</Cell>
            <Cell><SourceBadge source={dim.source} /></Cell>
          </Row>
        ))}
      </Table>
    </Tab>

    <Tab label="Materials">
      <MaterialsList materials={specs.materials} />
    </Tab>

    <Tab label="Components">
      <ComponentTree components={specs.components} />
    </Tab>

    <Tab label="Modeling Notes">
      <ModelingNotes notes={specs.modelingNotes} />
    </Tab>
  </Tabs>

  {/* Blender Export */}
  <Button onClick={exportForBlender}>
    Export Reference Pack for Blender
  </Button>
</Card>
```

---

## 8. Gemini Grounding 実装

### 8.1 Google Search Grounding

```typescript
// src/lib/gemini-grounding.ts

import { GoogleGenerativeAI } from '@google/generative-ai';

interface GroundingResult {
  text: string;
  groundingMetadata?: {
    searchEntryPoint?: {
      renderedContent: string;
    };
    groundingChunks?: Array<{
      web?: {
        uri: string;
        title: string;
      };
    }>;
    groundingSupports?: Array<{
      segment: {
        startIndex: number;
        endIndex: number;
        text: string;
      };
      groundingChunkIndices: number[];
      confidenceScores: number[];
    }>;
    webSearchQueries?: string[];
  };
}

export async function searchWithGeminiGrounding(
  query: string,
  entityType: EntityType
): Promise<ExternalSource[]> {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

  const model = genAI.getGenerativeModel({
    model: 'gemini-2.0-flash',
    tools: [{ googleSearch: {} }]
  });

  const prompt = buildGroundingSearchPrompt(query, entityType);

  const result = await model.generateContent(prompt);
  const response = result.response;

  // Extract grounding metadata
  const groundingMetadata = response.candidates?.[0]?.groundingMetadata;

  if (!groundingMetadata?.groundingChunks) {
    return [];
  }

  // Convert to ExternalSource format
  return groundingMetadata.groundingChunks
    .filter(chunk => chunk.web)
    .map(chunk => ({
      id: generateId(),
      sourceType: 'google_search' as ExternalSourceType,
      url: chunk.web!.uri,
      title: chunk.web!.title,
      snippet: extractRelevantSnippet(response.text(), chunk),
      relevanceScore: 0.5, // Will be re-evaluated
      retrievedAt: new Date()
    }));
}

function buildGroundingSearchPrompt(query: string, entityType: EntityType): string {
  const isModelingType = ['item', 'weapon', 'vehicle', 'building'].includes(entityType);

  if (isModelingType) {
    return `
Search for detailed technical information about "${query}" that would be useful for 3D modeling and visual reference.

Focus on finding:
1. Technical specifications (dimensions, materials, weight)
2. Diagrams, blueprints, cross-sections
3. Multiple angle photographs
4. Historical context and variants
5. Construction or manufacturing details

Provide a comprehensive summary with specific facts and measurements.
`;
  }

  return `
Search for comprehensive information about "${query}" for a worldbuilding reference database.

Include:
1. Overview and description
2. Historical background
3. Notable examples or instances
4. Cultural significance
5. Related concepts or entities

Provide factual, well-sourced information.
`;
}
```

### 8.2 Function Calling for Specialized Sources

```typescript
// src/lib/gemini-function-calling.ts

const externalSourceTools = [
  {
    name: 'search_wikimedia_commons',
    description: 'Search Wikimedia Commons for images, audio, and video',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query' },
        mediaType: { type: 'string', enum: ['image', 'audio', 'video', 'all'] },
        limit: { type: 'number', description: 'Max results' }
      },
      required: ['query']
    }
  },
  {
    name: 'query_wikidata',
    description: 'Query Wikidata for structured data',
    parameters: {
      type: 'object',
      properties: {
        entityName: { type: 'string' },
        properties: { type: 'array', items: { type: 'string' } }
      },
      required: ['entityName']
    }
  },
  {
    name: 'search_youtube',
    description: 'Search YouTube for educational/reference videos',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string' },
        duration: { type: 'string', enum: ['short', 'medium', 'long'] }
      },
      required: ['query']
    }
  },
  {
    name: 'search_academic',
    description: 'Search academic sources (papers, journals)',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string' },
        source: { type: 'string', enum: ['arxiv', 'semantic_scholar', 'crossref'] }
      },
      required: ['query']
    }
  }
];

export async function executeAgenticSearch(
  entityTitle: string,
  entityType: EntityType,
  existingContext: string
): Promise<ExternalSource[]> {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

  const model = genAI.getGenerativeModel({
    model: 'gemini-2.0-flash',
    tools: [
      { googleSearch: {} },
      { functionDeclarations: externalSourceTools }
    ]
  });

  const prompt = `
You are a research agent gathering comprehensive information about "${entityTitle}" (type: ${entityType}).

Your goal is to find:
1. Detailed technical specifications
2. High-quality visual references (images, diagrams, videos)
3. Audio content if relevant (pronunciations, sounds, music)
4. Historical and contextual information
5. Academic or expert sources

EXISTING CONTEXT:
${existingContext.slice(0, 2000)}

Use the available tools to search multiple sources and gather comprehensive information.
For each piece of information, note its source.

Start by searching Google, then use specialized tools for media and structured data.
`;

  const allSources: ExternalSource[] = [];

  // Multi-turn conversation with function calling
  const chat = model.startChat();
  let response = await chat.sendMessage(prompt);

  while (response.functionCalls?.length) {
    const functionResults = await Promise.all(
      response.functionCalls.map(async (call) => {
        const result = await executeFunctionCall(call.name, call.args);
        allSources.push(...result.sources);
        return {
          functionResponse: {
            name: call.name,
            response: result.response
          }
        };
      })
    );

    response = await chat.sendMessage(functionResults);
  }

  return allSources;
}

async function executeFunctionCall(
  name: string,
  args: Record<string, unknown>
): Promise<{ sources: ExternalSource[]; response: unknown }> {
  switch (name) {
    case 'search_wikimedia_commons':
      return await searchWikimediaCommonsFunction(args as any);
    case 'query_wikidata':
      return await queryWikidataFunction(args as any);
    case 'search_youtube':
      return await searchYouTubeFunction(args as any);
    case 'search_academic':
      return await searchAcademicFunction(args as any);
    default:
      return { sources: [], response: { error: 'Unknown function' } };
  }
}
```

---

## 9. 実装ロードマップ

### Phase 1: 基盤（2週間）
- [ ] Prisma スキーマ拡張（ExternalSearchJob, ExternalSource, technicalSpecsJson）
- [ ] Gemini Grounding with Google Search 統合
- [ ] 基本的な検索API実装
- [ ] UI: インポートパネルに外部検索オプション追加

### Phase 2: 専門ソース統合（2週間）
- [ ] Wikimedia Commons 強化（カテゴリ探索）
- [ ] Wikidata SPARQL 統合
- [ ] YouTube Data API 統合（埋め込み用）
- [ ] 技術仕様抽出プロンプト実装

### Phase 3: メディア処理（1週間）
- [ ] マルチソースメディア収集
- [ ] ライセンス自動検証
- [ ] メディアダウンロード・最適化
- [ ] 3Dモデリング向けメディア分類

### Phase 4: UI/UX（1週間）
- [ ] 検索結果プレビュー
- [ ] ソース選択・優先順位UI
- [ ] 技術仕様ビューア
- [ ] Blender参照パックエクスポート

### Phase 5: 品質向上（継続的）
- [ ] 追加ソース統合（Flickr, Freesound, Sketchfab）
- [ ] キャッシュ・レート制限
- [ ] エラーハンドリング強化
- [ ] パフォーマンス最適化

---

## 10. 環境変数

```bash
# Gemini (existing)
GEMINI_API_KEY=xxx
GEMINI_MODEL=gemini-2.0-flash

# YouTube Data API
YOUTUBE_API_KEY=xxx

# Flickr API (optional)
FLICKR_API_KEY=xxx

# Freesound API (optional)
FREESOUND_API_KEY=xxx

# Sketchfab API (optional)
SKETCHFAB_API_KEY=xxx

# Feature flags
ENABLE_EXTERNAL_SEARCH=true
ENABLE_GEMINI_GROUNDING=true
EXTERNAL_SEARCH_MAX_SOURCES=20
EXTERNAL_SEARCH_TIMEOUT_MS=60000
```

---

## 11. セキュリティ考慮事項

1. **APIキー管理**: すべてのAPIキーはサーバーサイドでのみ使用
2. **レート制限**: 各外部APIのレート制限を遵守
3. **コンテンツフィルタリング**: 不適切なコンテンツの自動フィルタリング
4. **ライセンス検証**: インポート前にライセンス互換性を確認
5. **ユーザー権限**: 外部検索はeditor以上の権限が必要

---

## まとめ

この External Source Enrichment 機能により、Depictionator は Wikipedia のみに依存せず、Web 全体から高品質な情報とメディアを収集し、3D モデリングにも十分な精密さを持つ記事を生成できるようになります。

特に Gemini Grounding with Google Search の活用により、リアルタイムの Web 検索結果を LLM の応答に組み込み、常に最新かつ多様な情報源からのコンテキストを提供できます。
