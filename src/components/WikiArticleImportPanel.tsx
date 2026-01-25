"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

type WikiSearchResult = {
  pageId: string;
  title: string;
  snippet: string;
  url: string;
};

type WikiPage = {
  pageId: string;
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

type PromptTemplate = {
  id: string;
  name: string;
  prompt: string;
};

type ImportStep =
  | "idle"
  | "fetching_sources"
  | "synthesizing"
  | "downloading_media"
  | "creating_entity"
  | "complete"
  | "error";

const STEP_LABELS: Record<ImportStep, string> = {
  idle: "",
  fetching_sources: "多言語ソースを取得中...",
  synthesizing: "AIで記事を生成中...",
  downloading_media: "メディアをダウンロード中...",
  creating_entity: "エンティティを作成中...",
  complete: "インポート完了！",
  error: "エラーが発生しました"
};

export function WikiArticleImportPanel({
  workspaceId,
  entityTypes
}: WikiArticleImportPanelProps) {
  const router = useRouter();
  const defaultEntityType = entityTypes[0] ?? "concept";
  const [query, setQuery] = useState("");
  const [lang, setLang] = useState("en");
  const [targetLang, setTargetLang] = useState("");
  const [results, setResults] = useState<WikiSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [page, setPage] = useState<WikiPage | null>(null);
  const [importPageId, setImportPageId] = useState("");
  const [entityType, setEntityType] = useState(defaultEntityType);
  const [publish, setPublish] = useState("false");
  const [useLlm, setUseLlm] = useState("true");
  const [aggregateLangs, setAggregateLangs] = useState("true");
  const [importMedia, setImportMedia] = useState("true");
  const [mediaLimit, setMediaLimit] = useState("50");
  const [promptTemplates, setPromptTemplates] = useState<PromptTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [templateName, setTemplateName] = useState("");
  const [promptText, setPromptText] = useState("");
  const [promptMessage, setPromptMessage] = useState("");

  // Import progress state
  const [importStep, setImportStep] = useState<ImportStep>("idle");
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState("");

  const loadTemplates = async () => {
    try {
      const res = await fetch(`/api/llm-templates?workspaceId=${workspaceId}&scope=wiki_import_article`);
      if (!res.ok) return;
      const data = await res.json();
      setPromptTemplates(Array.isArray(data.items) ? data.items : []);
    } catch {
      setPromptTemplates([]);
    }
  };

  const handleTemplateSelect = (templateId: string) => {
    setSelectedTemplateId(templateId);
    if (!templateId) {
      setPromptText("");
      setTemplateName("");
      return;
    }
    const template = promptTemplates.find((t) => t.id === templateId);
    if (!template) return;
    setPromptText(template.prompt);
    setTemplateName(template.name);
  };

  const saveTemplate = async () => {
    const name = templateName.trim();
    const prompt = promptText.trim();
    if (!name || !prompt) {
      setPromptMessage("Template name and prompt are required.");
      return;
    }
    setPromptMessage("");
    try {
      const res = await fetch("/api/llm-templates/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId,
          scope: "wiki_import_article",
          name,
          prompt
        })
      });
      if (!res.ok) {
        const text = await res.text();
        setPromptMessage(text || "Failed to save template.");
        return;
      }
      await loadTemplates();
      setPromptMessage("Template saved.");
    } catch {
      setPromptMessage("Failed to save template.");
    }
  };

  const runSearch = async () => {
    const trimmed = query.trim();
    if (!trimmed) {
      setError("検索語を入力してください。");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({
        query: trimmed,
        lang
      });
      const res = await fetch(`/api/wiki/search?${params.toString()}`);
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        const message = data?.error ?? "検索に失敗しました。";
        setError(message);
        setResults([]);
        return;
      }
      const data = await res.json();
      setResults(Array.isArray(data.results) ? data.results : []);
    } catch (err) {
      console.error("Wiki search failed:", err);
      setError("検索に失敗しました。");
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

  const handleImport = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!page || !importPageId) {
      setImportError("ページを選択してください");
      return;
    }

    setImporting(true);
    setImportError("");
    setImportStep("fetching_sources");

    try {
      const form = new FormData(e.currentTarget);

      // Simulate progress steps based on options
      const useAI = form.get("useLlm") === "on" || useLlm === "true";
      const downloadMedia = form.get("importMedia") === "true" || importMedia === "true";

      // Step 1: Fetching sources
      await new Promise(resolve => setTimeout(resolve, 500));

      if (useAI) {
        setImportStep("synthesizing");
        // This step takes longer due to LLM processing
      }

      // Actually submit the form
      const res = await fetch("/api/wiki/import/article", {
        method: "POST",
        body: form
      });

      const redirectedUrl = res.redirected && res.url ? new URL(res.url) : null;

      if (redirectedUrl) {
        if (downloadMedia) {
          setImportStep("downloading_media");
          await new Promise(resolve => setTimeout(resolve, 300));
        }
        setImportStep("creating_entity");
        await new Promise(resolve => setTimeout(resolve, 300));
        setImportStep("complete");

        // Wait a moment to show complete status, then redirect
        await new Promise(resolve => setTimeout(resolve, 800));

        const resolvedPath = `${redirectedUrl.pathname}${redirectedUrl.search}`;
        router.push(resolvedPath);
        return;
      }

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Import failed");
      }

      // Try to get redirect URL from response body
      const data = await res.json().catch(() => null);

      setImportStep("complete");
      await new Promise(resolve => setTimeout(resolve, 500));

      if (data?.redirect) {
        router.push(data.redirect);
      } else {
        const wikiPath = `/wiki/${encodeURIComponent(page.title.replace(/ /g, "_"))}`;
        router.push(wikiPath);
      }
    } catch (err) {
      console.error("Import failed:", err);
      setImportStep("error");
      setImportError(err instanceof Error ? err.message : "インポートに失敗しました");
    } finally {
      setImporting(false);
    }
  };

  useEffect(() => {
    if (!workspaceId) return;
    loadTemplates();
  }, [workspaceId]);

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
              onKeyDown={(e) => e.key === "Enter" && runSearch()}
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
        {!loading && !error && !page && results.length === 0 && query.trim() && (
          <div className="text-xs text-muted bg-bg border border-border rounded-lg p-3">
            結果が見つかりませんでした。言語を切り替えるか、別のキーワードで検索してください。
          </div>
        )}
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

              {/* Import Progress Overlay */}
              {importing && (
                <div className="mb-6 p-4 bg-accent/5 border border-accent/20 rounded-xl animate-in fade-in duration-300">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <svg className="w-6 h-6 animate-spin text-accent" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-bold text-ink">{STEP_LABELS[importStep]}</div>
                      <div className="mt-2 flex gap-1">
                        {(["fetching_sources", "synthesizing", "downloading_media", "creating_entity", "complete"] as ImportStep[]).map((step, index) => {
                          const steps: ImportStep[] = ["fetching_sources", "synthesizing", "downloading_media", "creating_entity", "complete"];
                          const currentIndex = steps.indexOf(importStep);
                          const stepIndex = index;
                          const isActive = stepIndex <= currentIndex;
                          const isCurrent = step === importStep;
                          return (
                            <div
                              key={step}
                              className={cn(
                                "h-1.5 flex-1 rounded-full transition-all duration-300",
                                isActive ? "bg-accent" : "bg-border",
                                isCurrent && "animate-pulse"
                              )}
                            />
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {importError && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">
                  {importError}
                </div>
              )}

              <form onSubmit={handleImport} className="space-y-4 pt-4 border-t border-border">
                <input type="hidden" name="workspaceId" value={workspaceId} />
                <input type="hidden" name="pageId" value={importPageId} />
                <input type="hidden" name="lang" value={lang} />

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-muted">Entity Blueprint</label>
                    <select name="entityType" value={entityType} onChange={(e) => setEntityType(e.target.value)} className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent capitalize" disabled={importing}>
                      {entityTypes.map((type) => (
                        <option key={type} value={type}>{type}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-muted">Auto-Publish</label>
                    <select name="publish" value={publish} onChange={(e) => setPublish(e.target.value)} className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent" disabled={importing}>
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
                        <input type="checkbox" name="useLlm" checked={useLlm === "true"} onChange={(e) => setUseLlm(e.target.checked ? "true" : "false")} className="w-4 h-4 rounded text-accent" disabled={importing} />
                      </label>
                      <label className="flex items-center justify-between p-2 rounded-lg bg-bg border border-border cursor-pointer">
                        <span className="text-[10px] font-bold uppercase text-muted">Multi-Lang</span>
                        <input type="checkbox" name="aggregateLangs" checked={aggregateLangs === "true"} onChange={(e) => setAggregateLangs(e.target.checked ? "true" : "false")} className="w-4 h-4 rounded text-accent" disabled={importing} />
                      </label>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <label className="flex flex-col gap-1 p-2 rounded-lg bg-bg border border-border">
                        <span className="text-[10px] font-bold uppercase text-muted">Target Language</span>
                        <input
                          name="targetLang"
                          value={targetLang}
                          onChange={(e) => setTargetLang(e.target.value)}
                          placeholder="e.g. ja, en, fr"
                          className="w-full bg-bg border border-border rounded-lg px-2 py-1 text-xs outline-none focus:ring-2 focus:ring-accent"
                          disabled={importing}
                        />
                        <span className="text-[10px] text-muted">Blank = same as source</span>
                      </label>
                      <div className="flex flex-col gap-1 p-2 rounded-lg bg-bg border border-border">
                        <span className="text-[10px] font-bold uppercase text-muted">Import Media</span>
                        <label className="flex items-center justify-between cursor-pointer">
                          <span className="text-xs text-muted">Enabled</span>
                          <input
                            type="checkbox"
                            checked={importMedia === "true"}
                            onChange={(e) => setImportMedia(e.target.checked ? "true" : "false")}
                            className="w-4 h-4 rounded text-accent"
                            disabled={importing}
                          />
                        </label>
                        <input type="hidden" name="importMedia" value={importMedia} />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 gap-4">
                      <label className="flex flex-col gap-1 p-2 rounded-lg bg-bg border border-border">
                        <span className="text-[10px] font-bold uppercase text-muted">Media Limit</span>
                        <input
                          name="mediaLimit"
                          type="number"
                          min={0}
                          max={300}
                          value={mediaLimit}
                          onChange={(e) => setMediaLimit(e.target.value)}
                          className="w-full bg-bg border border-border rounded-lg px-2 py-1 text-xs outline-none focus:ring-2 focus:ring-accent"
                          disabled={importing}
                        />
                      </label>
                    </div>
                    <div className="space-y-3">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-muted">LLM Prompt Template</label>
                      <select
                        value={selectedTemplateId}
                        onChange={(e) => handleTemplateSelect(e.target.value)}
                        className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent"
                        disabled={importing}
                      >
                        <option value="">Default (system prompt)</option>
                        {promptTemplates.map((template) => (
                          <option key={template.id} value={template.id}>{template.name}</option>
                        ))}
                      </select>
                      <div className="grid gap-3">
                        <textarea
                          name="llmPrompt"
                          value={promptText}
                          onChange={(e) => setPromptText(e.target.value)}
                          rows={6}
                          placeholder="Optional custom prompt. Use {{targetLang}}, {{source_list}}, {{sources}}, {{source_count}} placeholders."
                          className="w-full px-3 py-2 bg-bg border border-border rounded-lg text-xs outline-none focus:ring-2 focus:ring-accent"
                          disabled={importing}
                        />
                        <input type="hidden" name="llmPromptTemplateId" value={selectedTemplateId} />
                        <input type="hidden" name="llmPromptTemplateName" value={templateName} />
                        <div className="grid grid-cols-[1fr_auto] gap-2">
                          <input
                            value={templateName}
                            onChange={(e) => setTemplateName(e.target.value)}
                            placeholder="Template name to save"
                            className="w-full px-3 py-2 bg-bg border border-border rounded-lg text-xs outline-none focus:ring-2 focus:ring-accent"
                            disabled={importing}
                          />
                          <button
                            type="button"
                            className="btn-secondary"
                            onClick={saveTemplate}
                            disabled={importing}
                          >
                            Save Template
                          </button>
                        </div>
                        {promptMessage && <div className="text-xs text-muted">{promptMessage}</div>}
                      </div>
                    </div>
                  </div>
                </details>

                <Button
                  type="submit"
                  className="w-full py-4 font-extrabold tracking-tight bg-accent text-white rounded-xl shadow-xl shadow-accent/30 disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={importing}
                >
                  {importing ? (
                    <span className="flex items-center gap-2">
                      <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      インポート中...
                    </span>
                  ) : (
                    "Integrate Knowledge"
                  )}
                </Button>
              </form>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
