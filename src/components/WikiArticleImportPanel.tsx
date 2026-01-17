"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

type WikiSearchResult = {
  pageId: number;
  title: string;
  snippet: string;
  url: string;
};

type WikiPage = {
  pageId: number;
  title: string;
  url: string;
  extract: string;
  wikitext: string;
  images: string[];
};

type WikiArticleImportPanelProps = {
  workspaceId: string;
  entityTypes: string[];
};

export function WikiArticleImportPanel({
  workspaceId,
  entityTypes
}: WikiArticleImportPanelProps) {
  const defaultEntityType = entityTypes[0] ?? "concept";
  const [query, setQuery] = useState("");
  const [lang, setLang] = useState("en");
  const [results, setResults] = useState<WikiSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [page, setPage] = useState<WikiPage | null>(null);
  const [importPageId, setImportPageId] = useState("");
  const [entityType, setEntityType] = useState(defaultEntityType);
  const [publish, setPublish] = useState("false");
  const [useLlm, setUseLlm] = useState("true");
  const [aggregateLangs, setAggregateLangs] = useState("true");

  const runSearch = async () => {
    const trimmed = query.trim();
    if (!trimmed) {
      setError("Query required.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const form = new FormData();
      form.append("query", trimmed);
      form.append("lang", lang);
      const res = await fetch("/api/wiki/search", { method: "POST", body: form });
      if (!res.ok) {
        const text = await res.text();
        setError(text || "Search failed.");
        setResults([]);
        return;
      }
      const data = await res.json();
      setResults(data.results ?? []);
    } catch (err) {
      console.error("Wiki search failed:", err);
      setError("Search failed.");
    } finally {
      setLoading(false);
    }
  };

  const loadPage = async (result: WikiSearchResult) => {
    setLoading(true);
    setError("");
    setImportPageId(String(result.pageId));
    try {
      const form = new FormData();
      form.append("pageId", String(result.pageId));
      form.append("lang", lang);
      const res = await fetch("/api/wiki/page", { method: "POST", body: form });
      if (!res.ok) {
        const text = await res.text();
        setError(text || "Failed to load page.");
        setPage(null);
        return;
      }
      const data = await res.json();
      setPage(data.page ?? null);
    } catch (err) {
      console.error("Wiki page load failed:", err);
      setError("Failed to load page.");
      setPage(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="space-y-2">
        <h3 className="text-lg font-bold text-ink tracking-tight">Intelligence Source</h3>
        <p className="text-xs text-muted uppercase tracking-widest font-semibold">Wikipedia Integration</p>
      </div>

      {/* Search Section */}
      <div className="bg-panel border border-border rounded-2xl p-6 shadow-sm space-y-4">
        <div className="grid grid-cols-[1fr_80px] gap-3">
          <div className="relative group">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted group-focus-within:text-accent transition-colors" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
            <input 
              value={query} 
              onChange={(e) => setQuery(e.target.value)} 
              placeholder="Search world knowledge..."
              className="w-full pl-10 pr-4 py-2.5 bg-bg border border-border rounded-xl text-sm outline-none focus:ring-2 focus:ring-accent transition-all"
            />
          </div>
          <select 
            value={lang} 
            onChange={(e) => setLang(e.target.value)}
            className="bg-bg border border-border rounded-xl px-2 text-xs font-bold uppercase outline-none focus:ring-2 focus:ring-accent"
          >
            <option value="en">EN</option>
            <option value="ja">JA</option>
            <option value="de">DE</option>
            <option value="fr">FR</option>
          </select>
        </div>
        <Button onClick={runSearch} disabled={loading} className="w-full py-3 font-bold gap-2">
          {loading ? "Scanning..." : "Query Wiki Ecosystem"}
        </Button>
        {error && <div className="text-xs font-medium text-red-500 bg-red-50 p-3 rounded-lg border border-red-100">{error}</div>}
      </div>

      {/* Results & Preview */}
      {(results.length > 0 || page) && (
        <div className="space-y-6">
          <div className="flex items-center justify-between border-b border-border pb-2">
            <label className="text-[10px] font-bold uppercase tracking-widest text-muted">Discovery Results</label>
          </div>
          
          <div className="grid gap-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
            {results.map((result) => (
              <div 
                key={result.pageId} 
                onClick={() => loadPage(result)}
                className={cn(
                  "p-4 rounded-xl border transition-all cursor-pointer group",
                  importPageId === String(result.pageId) 
                    ? "bg-accent/5 border-accent shadow-md" 
                    : "bg-panel border-border hover:border-accent/50"
                )}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <strong className="text-sm font-bold text-ink group-hover:text-accent transition-colors">{result.title}</strong>
                    <div className="text-xs text-muted line-clamp-2 leading-relaxed italic opacity-80">{result.snippet.replace(/<[^>]*>?/gm, '')}</div>
                  </div>
                  <div className="p-2 rounded-lg bg-bg text-muted opacity-0 group-hover:opacity-100 transition-opacity">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-4 h-4">
                      <path d="M5 12h14M12 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {page && (
            <div className="bg-panel border border-accent/20 rounded-2xl p-6 shadow-xl animate-in zoom-in-95 duration-300">
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-bold text-ink">{page.title}</h4>
                <a href={page.url} target="_blank" rel="noreferrer" className="text-[10px] font-bold text-accent uppercase hover:underline">Source Link</a>
              </div>
              <div className="text-xs text-muted leading-relaxed mb-6 line-clamp-4">{page.extract}</div>
              
              <form action="/api/wiki/import/article" method="post" className="space-y-4 pt-4 border-t border-border">
                <input type="hidden" name="workspaceId" value={workspaceId} />
                <input type="hidden" name="pageId" value={importPageId} />
                <input type="hidden" name="lang" value={lang} />
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-muted">Entity Blueprint</label>
                    <select name="entityType" value={entityType} onChange={(e) => setEntityType(e.target.value)} className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent capitalize">
                      {entityTypes.map((type) => (
                        <option key={type} value={type}>{type}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-muted">Auto-Publish</label>
                    <select name="publish" value={publish} onChange={(e) => setPublish(e.target.value)} className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent">
                      <option value="true">Immediate</option>
                      <option value="false">Draft Only</option>
                    </select>
                  </div>
                </div>

                <details className="group">
                  <summary className="text-[10px] font-bold uppercase tracking-widest text-muted cursor-pointer flex items-center gap-2 hover:text-accent transition-colors">
                    Advanced Orchestration
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="w-2.5 h-2.5 transition-transform group-open:rotate-180">
                      <path d="M19 9l-7 7-7-7" />
                    </svg>
                  </summary>
                  <div className="grid gap-4 pt-4 animate-in slide-in-from-top-2">
                    <div className="grid grid-cols-2 gap-4">
                      <label className="flex items-center justify-between p-2 rounded-lg bg-bg border border-border cursor-pointer">
                        <span className="text-[10px] font-bold uppercase text-muted">Use LLM</span>
                        <input type="checkbox" name="useLlm" checked={useLlm === "true"} onChange={(e) => setUseLlm(e.target.checked ? "true" : "false")} className="w-4 h-4 rounded text-accent" />
                      </label>
                      <label className="flex items-center justify-between p-2 rounded-lg bg-bg border border-border cursor-pointer">
                        <span className="text-[10px] font-bold uppercase text-muted">Multi-Lang</span>
                        <input type="checkbox" name="aggregateLangs" checked={aggregateLangs === "true"} onChange={(e) => setAggregateLangs(e.target.checked ? "true" : "false")} className="w-4 h-4 rounded text-accent" />
                      </label>
                    </div>
                  </div>
                </details>

                <Button type="submit" className="w-full py-4 font-extrabold tracking-tight bg-accent text-white rounded-xl shadow-xl shadow-accent/30">
                  Integrate Knowledge
                </Button>
              </form>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
