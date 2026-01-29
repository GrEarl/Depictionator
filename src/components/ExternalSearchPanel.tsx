"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

// ============================================
// Types
// ============================================

type ExternalSourceType =
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

interface ExternalSource {
  id: string;
  sourceType: ExternalSourceType;
  url: string;
  title: string;
  snippet?: string;
  relevanceScore: number;
  licenseId?: string;
  author?: string;
  verified: boolean;
  imported: boolean;
  mediaUrls?: string[];
  metadata?: Record<string, unknown>;
}

interface TechnicalSpecs {
  dimensions?: Record<string, { value: number; unit: string; note?: string }>;
  materials?: Array<{ part: string; material: string }>;
  weight?: { value: number; unit: string };
  components?: Array<{ name: string; description?: string }>;
  modelingNotes?: {
    keyFeatures?: string[];
    challenges?: string[];
  };
}

interface SearchJobResult {
  jobId: string;
  status: "pending" | "searching" | "processing" | "completed" | "failed";
  query: string;
  sources: ExternalSource[];
  technicalSpecs?: TechnicalSpecs;
  errorMessage?: string;
  searchMode?: "standard" | "extended" | "deep";
  deepResearchText?: string;
}

interface ExternalSearchPanelProps {
  workspaceId: string;
  entityTypes: string[];
  defaultQuery?: string;
  defaultEntityType?: string;
  onImportComplete?: (entityId: string) => void;
}

// ============================================
// Source Type Icons & Labels
// ============================================

const SOURCE_TYPE_INFO: Record<ExternalSourceType, { label: string; icon: string; color: string }> = {
  google_search: { label: "Google", icon: "🔍", color: "bg-blue-100 text-blue-800" },
  wikipedia: { label: "Wikipedia", icon: "📚", color: "bg-gray-100 text-gray-800" },
  wikimedia_commons: { label: "Commons", icon: "🖼️", color: "bg-green-100 text-green-800" },
  wikidata: { label: "Wikidata", icon: "🗃️", color: "bg-purple-100 text-purple-800" },
  youtube: { label: "YouTube", icon: "▶️", color: "bg-red-100 text-red-800" },
  flickr: { label: "Flickr", icon: "📷", color: "bg-pink-100 text-pink-800" },
  freesound: { label: "Freesound", icon: "🔊", color: "bg-orange-100 text-orange-800" },
  internet_archive: { label: "Archive", icon: "🏛️", color: "bg-amber-100 text-amber-800" },
  academic: { label: "Academic", icon: "🎓", color: "bg-indigo-100 text-indigo-800" },
  other: { label: "Other", icon: "📄", color: "bg-slate-100 text-slate-800" },
};

// ============================================
// Sub-Components
// ============================================

function SourceCard({
  source,
  selected,
  onToggle,
}: {
  source: ExternalSource;
  selected: boolean;
  onToggle: () => void;
}) {
  const info = SOURCE_TYPE_INFO[source.sourceType] || SOURCE_TYPE_INFO.other;

  return (
    <div
      className={cn(
        "p-3 border rounded-lg cursor-pointer transition-all",
        selected ? "border-accent bg-accent/5" : "border-border hover:border-accent/50",
        source.imported && "opacity-60"
      )}
      onClick={onToggle}
    >
      <div className="flex items-start gap-2">
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggle}
          className="mt-1"
          onClick={(e) => e.stopPropagation()}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={cn("text-xs px-2 py-0.5 rounded-full", info.color)}>
              {info.icon} {info.label}
            </span>
            <span className="text-xs text-muted-foreground">
              {Math.round(source.relevanceScore * 100)}% relevant
            </span>
            {source.verified && (
              <span className="text-xs text-green-600">✓ Verified</span>
            )}
          </div>
          <h4 className="font-medium text-sm truncate">{source.title}</h4>
          {source.snippet && (
            <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
              {source.snippet}
            </p>
          )}
          {source.licenseId && (
            <span className="text-xs text-muted-foreground">
              📜 {source.licenseId}
            </span>
          )}
          {source.mediaUrls && source.mediaUrls.length > 0 && (
            <span className="text-xs text-blue-600 ml-2">
              🖼️ {source.mediaUrls.length} media
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function TechnicalSpecsViewer({ specs }: { specs: TechnicalSpecs }) {
  return (
    <div className="bg-muted/30 rounded-lg p-4 space-y-4">
      <h4 className="font-semibold text-sm flex items-center gap-2">
        📐 Technical Specifications
      </h4>

      {specs.dimensions && Object.keys(specs.dimensions).length > 0 && (
        <div>
          <h5 className="text-xs font-medium text-muted-foreground mb-2">Dimensions</h5>
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(specs.dimensions).map(([key, dim]) => (
              <div key={key} className="bg-background rounded px-2 py-1 text-sm">
                <span className="text-muted-foreground capitalize">{key.replace(/_/g, " ")}: </span>
                <span className="font-medium">{dim.value} {dim.unit}</span>
                {dim.note && <span className="text-xs text-muted-foreground ml-1">({dim.note})</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {specs.materials && specs.materials.length > 0 && (
        <div>
          <h5 className="text-xs font-medium text-muted-foreground mb-2">Materials</h5>
          <div className="flex flex-wrap gap-2">
            {specs.materials.map((mat, i) => (
              <span key={i} className="bg-background rounded px-2 py-1 text-sm">
                <span className="text-muted-foreground">{mat.part}: </span>
                <span className="font-medium">{mat.material}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {specs.weight && (
        <div>
          <h5 className="text-xs font-medium text-muted-foreground mb-2">Weight</h5>
          <span className="bg-background rounded px-2 py-1 text-sm font-medium">
            {specs.weight.value} {specs.weight.unit}
          </span>
        </div>
      )}

      {specs.modelingNotes && (
        <div>
          <h5 className="text-xs font-medium text-muted-foreground mb-2">🎨 Modeling Notes</h5>
          {specs.modelingNotes.keyFeatures && (
            <div className="mb-2">
              <span className="text-xs text-muted-foreground">Key Features: </span>
              <span className="text-sm">{specs.modelingNotes.keyFeatures.join(", ")}</span>
            </div>
          )}
          {specs.modelingNotes.challenges && (
            <div>
              <span className="text-xs text-muted-foreground">Challenges: </span>
              <span className="text-sm">{specs.modelingNotes.challenges.join(", ")}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================
// Main Component
// ============================================

export function ExternalSearchPanel({
  workspaceId,
  entityTypes,
  defaultQuery = "",
  defaultEntityType,
  onImportComplete,
}: ExternalSearchPanelProps) {
  // Search state
  const [query, setQuery] = useState(defaultQuery);
  const [entityType, setEntityType] = useState(defaultEntityType || entityTypes[0] || "concept");
  const [targetLang, setTargetLang] = useState("en");

  // Source toggles
  const [sources, setSources] = useState({
    googleSearch: true,
    wikipedia: true,
    wikimediaCommons: true,
    wikidata: false,
    youtube: false,
    flickr: false,
    freesound: false,
  });

  // Extended sources (for extended/deep modes)
  const [extendedSources, setExtendedSources] = useState({
    flickr: false,
    freesound: false,
    archive: false,
    googleCSE: false,
    sketchfab: false,
  });

  // Search mode
  const [searchMode, setSearchMode] = useState<"standard" | "extended" | "deep">("standard");

  // Options
  const [modelingFocus, setModelingFocus] = useState(false);
  const [extractTechnicalSpecs, setExtractTechnicalSpecs] = useState(true);
  const [deepResearchTurns, setDeepResearchTurns] = useState(3);

  // Job state
  const [jobId, setJobId] = useState<string | null>(null);
  const [jobResult, setJobResult] = useState<SearchJobResult | null>(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");

  // Selection state
  const [selectedSourceIds, setSelectedSourceIds] = useState<Set<string>>(new Set());

  // Import state
  const [importing, setImporting] = useState(false);
  const [createNewEntity, setCreateNewEntity] = useState(true);
  const [entityTitle, setEntityTitle] = useState("");

  // ==========================================
  // Handlers
  // ==========================================

  const startSearch = useCallback(async () => {
    if (!query.trim()) {
      setError("Please enter a search query");
      return;
    }

    setSearching(true);
    setError("");
    setJobResult(null);
    setSelectedSourceIds(new Set());

    try {
      const formData = new FormData();
      formData.append("workspaceId", workspaceId);
      formData.append("query", query);
      formData.append("entityType", entityType);
      formData.append("targetLang", targetLang);
      formData.append("modelingFocus", String(modelingFocus));
      formData.append("extractTechnicalSpecs", String(extractTechnicalSpecs));
      formData.append("searchMode", searchMode);
      formData.append("deepResearchTurns", String(deepResearchTurns));

      // Add source toggles
      for (const [key, value] of Object.entries(sources)) {
        formData.append(`source_${key}`, String(value));
      }

      // Add extended source toggles
      for (const [key, value] of Object.entries(extendedSources)) {
        formData.append(`ext_${key}`, String(value));
      }

      const response = await fetch("/api/external-search/start", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || "Search failed");
      }

      const data = await response.json();
      setJobId(data.jobId);

      // Poll for results
      pollJobStatus(data.jobId);
    } catch (err) {
      setError((err as Error).message);
      setSearching(false);
    }
  }, [query, entityType, targetLang, sources, extendedSources, modelingFocus, extractTechnicalSpecs, searchMode, deepResearchTurns, workspaceId]);

  const pollJobStatus = useCallback(async (id: string) => {
    const maxAttempts = searchMode === "deep" ? 180 : 60; // Deep research needs more time
    let attempts = 0;

    const poll = async () => {
      try {
        const response = await fetch(`/api/external-search/status/${id}`);
        if (!response.ok) throw new Error("Failed to get job status");

        const data = await response.json();

        if (data.status === "completed") {
          setJobResult(data);
          setSearching(false);
          setEntityTitle(query); // Default entity title to query

          // Auto-select high-relevance sources
          const highRelevance = data.sources
            .filter((s: ExternalSource) => s.relevanceScore >= 0.5)
            .map((s: ExternalSource) => s.id);
          setSelectedSourceIds(new Set(highRelevance));
        } else if (data.status === "failed") {
          setError(data.errorMessage || "Search failed");
          setSearching(false);
        } else if (attempts < maxAttempts) {
          attempts++;
          setTimeout(poll, 1000);
        } else {
          setError("Search timed out");
          setSearching(false);
        }
      } catch (err) {
        setError((err as Error).message);
        setSearching(false);
      }
    };

    poll();
  }, [query, searchMode]);

  const toggleSource = useCallback((sourceId: string) => {
    setSelectedSourceIds((prev) => {
      const next = new Set(prev);
      if (next.has(sourceId)) {
        next.delete(sourceId);
      } else {
        next.add(sourceId);
      }
      return next;
    });
  }, []);

  const importSelected = useCallback(async () => {
    if (!jobId || selectedSourceIds.size === 0) return;

    setImporting(true);
    setError("");

    try {
      const response = await fetch("/api/external-search/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId,
          jobId,
          sourceIds: Array.from(selectedSourceIds),
          createEntity: createNewEntity,
          entityTitle: createNewEntity ? entityTitle : undefined,
          entityType,
          targetLang,
          importMedia: true,
          synthesizeArticle: true,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || "Import failed");
      }

      const data = await response.json();
      onImportComplete?.(data.entityId);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setImporting(false);
    }
  }, [jobId, selectedSourceIds, createNewEntity, entityTitle, entityType, targetLang, workspaceId, onImportComplete]);

  // ==========================================
  // Render
  // ==========================================

  return (
    <div className="space-y-6">
      {/* Search Form */}
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Search Query</label>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g., Katana, Notre-Dame, Boeing 747"
            className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
            onKeyDown={(e) => e.key === "Enter" && startSearch()}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Entity Type</label>
            <select
              value={entityType}
              onChange={(e) => setEntityType(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
            >
              {entityTypes.map((type) => (
                <option key={type} value={type}>
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Target Language</label>
            <select
              value={targetLang}
              onChange={(e) => setTargetLang(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
            >
              <option value="en">English</option>
              <option value="ja">日本語</option>
              <option value="zh">中文</option>
              <option value="ko">한국어</option>
              <option value="de">Deutsch</option>
              <option value="fr">Français</option>
            </select>
          </div>
        </div>

        {/* Source Toggles */}
        <div>
          <label className="block text-sm font-medium mb-2">Primary Sources</label>
          <div className="flex flex-wrap gap-2">
            {Object.entries(sources).map(([key, enabled]) => {
              const sourceKey = key as keyof typeof sources;
              const typeKey = key === "googleSearch" ? "google_search" :
                             key === "wikimediaCommons" ? "wikimedia_commons" :
                             key as ExternalSourceType;
              const info = SOURCE_TYPE_INFO[typeKey] || SOURCE_TYPE_INFO.other;

              return (
                <button
                  key={key}
                  onClick={() => setSources((prev) => ({ ...prev, [sourceKey]: !prev[sourceKey] }))}
                  className={cn(
                    "px-3 py-1.5 rounded-full text-sm transition-all",
                    enabled ? info.color : "bg-muted text-muted-foreground"
                  )}
                >
                  {info.icon} {info.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Search Mode */}
        <div>
          <label className="block text-sm font-medium mb-2">Search Mode</label>
          <div className="flex gap-2">
            <button
              onClick={() => setSearchMode("standard")}
              className={cn(
                "px-4 py-2 rounded-lg text-sm transition-all flex items-center gap-2",
                searchMode === "standard" ? "bg-accent text-white" : "bg-muted text-muted-foreground hover:bg-muted/80"
              )}
            >
              🔍 Standard
            </button>
            <button
              onClick={() => setSearchMode("extended")}
              className={cn(
                "px-4 py-2 rounded-lg text-sm transition-all flex items-center gap-2",
                searchMode === "extended" ? "bg-accent text-white" : "bg-muted text-muted-foreground hover:bg-muted/80"
              )}
            >
              🌐 Extended
            </button>
            <button
              onClick={() => setSearchMode("deep")}
              className={cn(
                "px-4 py-2 rounded-lg text-sm transition-all flex items-center gap-2",
                searchMode === "deep" ? "bg-accent text-white" : "bg-muted text-muted-foreground hover:bg-muted/80"
              )}
            >
              🔬 Deep Research
            </button>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {searchMode === "standard" && "Quick search across primary sources"}
            {searchMode === "extended" && "Extended search with additional providers (Flickr, Freesound, Archive.org, Sketchfab)"}
            {searchMode === "deep" && "Multi-turn AI-powered deep research with Gemini Grounding"}
          </p>
        </div>

        {/* Extended Sources (for extended/deep modes) */}
        {(searchMode === "extended" || searchMode === "deep") && (
          <div>
            <label className="block text-sm font-medium mb-2">Extended Sources</label>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setExtendedSources((prev) => ({ ...prev, flickr: !prev.flickr }))}
                className={cn(
                  "px-3 py-1.5 rounded-full text-sm transition-all",
                  extendedSources.flickr ? "bg-pink-100 text-pink-800" : "bg-muted text-muted-foreground"
                )}
              >
                📷 Flickr
              </button>
              <button
                onClick={() => setExtendedSources((prev) => ({ ...prev, freesound: !prev.freesound }))}
                className={cn(
                  "px-3 py-1.5 rounded-full text-sm transition-all",
                  extendedSources.freesound ? "bg-orange-100 text-orange-800" : "bg-muted text-muted-foreground"
                )}
              >
                🔊 Freesound
              </button>
              <button
                onClick={() => setExtendedSources((prev) => ({ ...prev, archive: !prev.archive }))}
                className={cn(
                  "px-3 py-1.5 rounded-full text-sm transition-all",
                  extendedSources.archive ? "bg-amber-100 text-amber-800" : "bg-muted text-muted-foreground"
                )}
              >
                🏛️ Internet Archive
              </button>
              <button
                onClick={() => setExtendedSources((prev) => ({ ...prev, sketchfab: !prev.sketchfab }))}
                className={cn(
                  "px-3 py-1.5 rounded-full text-sm transition-all",
                  extendedSources.sketchfab ? "bg-cyan-100 text-cyan-800" : "bg-muted text-muted-foreground"
                )}
              >
                🎮 Sketchfab (3D)
              </button>
              <button
                onClick={() => setExtendedSources((prev) => ({ ...prev, googleCSE: !prev.googleCSE }))}
                className={cn(
                  "px-3 py-1.5 rounded-full text-sm transition-all",
                  extendedSources.googleCSE ? "bg-blue-100 text-blue-800" : "bg-muted text-muted-foreground"
                )}
              >
                🔎 Google CSE
              </button>
            </div>
          </div>
        )}

        {/* Deep Research Options */}
        {searchMode === "deep" && (
          <div>
            <label className="block text-sm font-medium mb-2">Research Depth</label>
            <div className="flex items-center gap-4">
              <input
                type="range"
                min="1"
                max="5"
                value={deepResearchTurns}
                onChange={(e) => setDeepResearchTurns(Number(e.target.value))}
                className="flex-1"
              />
              <span className="text-sm font-medium w-16">{deepResearchTurns} turns</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              More turns = deeper research, but takes longer
            </p>
          </div>
        )}

        {/* Options */}
        <div className="flex flex-wrap gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={modelingFocus}
              onChange={(e) => setModelingFocus(e.target.checked)}
            />
            <span className="text-sm">🎨 3D Modeling Focus</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={extractTechnicalSpecs}
              onChange={(e) => setExtractTechnicalSpecs(e.target.checked)}
            />
            <span className="text-sm">📐 Extract Technical Specs</span>
          </label>
        </div>

        <Button
          onClick={startSearch}
          disabled={searching || !query.trim()}
          className="w-full"
        >
          {searching ? (
            <>
              <span className="animate-spin mr-2">⏳</span>
              {searchMode === "deep" ? "Deep researching..." : "Searching..."}
            </>
          ) : (
            <>
              {searchMode === "standard" && "🔍 Search External Sources"}
              {searchMode === "extended" && "🌐 Extended Search"}
              {searchMode === "deep" && "🔬 Start Deep Research"}
            </>
          )}
        </Button>
      </div>

      {/* Error */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">
          {error}
        </div>
      )}

      {/* Results */}
      {jobResult && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">
              Found {jobResult.sources.length} Sources
              {jobResult.searchMode && (
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                  ({jobResult.searchMode === "deep" ? "🔬 Deep Research" :
                    jobResult.searchMode === "extended" ? "🌐 Extended" : "🔍 Standard"})
                </span>
              )}
            </h3>
            <span className="text-sm text-muted-foreground">
              {selectedSourceIds.size} selected
            </span>
          </div>

          {/* Deep Research Summary */}
          {jobResult.deepResearchText && (
            <div className="bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 rounded-lg p-4">
              <h4 className="font-semibold text-sm flex items-center gap-2 mb-2">
                🔬 Deep Research Summary
              </h4>
              <div className="text-sm text-gray-700 whitespace-pre-wrap max-h-64 overflow-y-auto">
                {jobResult.deepResearchText.slice(0, 2000)}
                {jobResult.deepResearchText.length > 2000 && (
                  <span className="text-muted-foreground">... (truncated)</span>
                )}
              </div>
            </div>
          )}

          {/* Technical Specs */}
          {jobResult.technicalSpecs && (
            <TechnicalSpecsViewer specs={jobResult.technicalSpecs} />
          )}

          {/* Source List */}
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {jobResult.sources.map((source) => (
              <SourceCard
                key={source.id}
                source={source}
                selected={selectedSourceIds.has(source.id)}
                onToggle={() => toggleSource(source.id)}
              />
            ))}
          </div>

          {/* Import Section */}
          {selectedSourceIds.size > 0 && (
            <div className="border-t pt-4 space-y-4">
              <h4 className="font-medium">Import Selected Sources</h4>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={createNewEntity}
                  onChange={(e) => setCreateNewEntity(e.target.checked)}
                />
                <span className="text-sm">Create new entity</span>
              </label>

              {createNewEntity && (
                <div>
                  <label className="block text-sm font-medium mb-1">Entity Title</label>
                  <input
                    type="text"
                    value={entityTitle}
                    onChange={(e) => setEntityTitle(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
                  />
                </div>
              )}

              <Button
                onClick={importSelected}
                disabled={importing || (createNewEntity && !entityTitle.trim())}
                className="w-full"
              >
                {importing ? (
                  <>
                    <span className="animate-spin mr-2">⏳</span>
                    Importing...
                  </>
                ) : (
                  <>
                    📥 Import {selectedSourceIds.size} Sources
                  </>
                )}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
