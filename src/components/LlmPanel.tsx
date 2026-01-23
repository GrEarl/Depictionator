"use client";

import { useEffect, useState } from "react";
import { diffLines } from "diff";
import { MarkdownView } from "@/components/MarkdownView";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

type Provider = "gemini_ai" | "gemini_vertex" | "codex_cli";

type LlmPanelProps = {
  workspaceId?: string | null;
  enabledProviders?: string[];
  defaultProvider?: string;
  defaultGeminiModel?: string;
  defaultVertexModel?: string;
};

const PROVIDER_LABELS: Record<Provider, string> = {
  gemini_ai: "Gemini (AI Studio)",
  gemini_vertex: "Gemini (Vertex AI)",
  codex_cli: "GPT-5.2 (Codex CLI)"
};

const FALLBACK_PROVIDERS: Provider[] = ["gemini_ai", "gemini_vertex", "codex_cli"];

function normalizeProvider(value: string): Provider | null {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return null;
  if (normalized === "gemini") return "gemini_ai";
  if (normalized === "vertex") return "gemini_vertex";
  if (normalized === "codex") return "codex_cli";
  if (normalized === "codex_cli") return "codex_cli";
  if (normalized === "gemini_ai") return "gemini_ai";
  if (normalized === "gemini_vertex") return "gemini_vertex";
  return null;
}

function buildProviderList(list?: string[]): Provider[] {
  if (!list || list.length === 0) return [...FALLBACK_PROVIDERS];
  const mapped = list
    .map((value) => normalizeProvider(value))
    .filter((value): value is Provider => Boolean(value));
  if (mapped.length === 0) return [...FALLBACK_PROVIDERS];
  return Array.from(new Set(mapped));
}

export function LlmPanel({
  workspaceId,
  enabledProviders,
  defaultProvider,
  defaultGeminiModel,
  defaultVertexModel
}: LlmPanelProps) {
  const availableProviders = buildProviderList(enabledProviders);
  const resolvedDefault = normalizeProvider(defaultProvider ?? "") ?? availableProviders[0] ?? "gemini_ai";

  const [open, setOpen] = useState(false);
  const [provider, setProvider] = useState<Provider>(resolvedDefault);
  const [prompt, setPrompt] = useState("");
  const [response, setResponse] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [context, setContext] = useState<any>(null);
  const [diffParts, setDiffParts] = useState<ReturnType<typeof diffLines> | null>(null);
  const [diffLoading, setDiffLoading] = useState(false);
  const [applyMessage, setApplyMessage] = useState<string | null>(null);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [changeSummary, setChangeSummary] = useState("LLM draft");

  const [geminiModel, setGeminiModel] = useState(defaultGeminiModel ?? "gemini-3-flash-preview");
  const [geminiSearch, setGeminiSearch] = useState(false);

  useEffect(() => {
    const el = document.getElementById("llm-context");
    if (!el?.textContent) return;
    try {
      const parsed = JSON.parse(el.textContent);
      setContext(parsed);
    } catch {
      setContext(null);
    }
  }, []);

  useEffect(() => {
    setDiffParts(null);
    setDraftId(null);
    setApplyMessage(null);
  }, [response]);

  const canApply = Boolean(
    response.trim() &&
    workspaceId &&
    context &&
    context.type === "entity" &&
    context.entityId
  );

  const handlePreviewDiff = async () => {
    if (!canApply) return;
    setDiffLoading(true);
    setApplyMessage(null);
    try {
      const res = await fetch("/api/articles/body", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId,
          entityId: context.entityId
        })
      });
      const data = await res.json();
      if (!res.ok) {
        setApplyMessage(data?.error || "Failed to load current article body.");
        return;
      }
      const before = String(data?.bodyMd ?? "");
      const after = response;
      setDiffParts(diffLines(before, after));
    } catch {
      setApplyMessage("Failed to load current article body.");
    } finally {
      setDiffLoading(false);
    }
  };

  const handleCreateDraft = async () => {
    if (!canApply) return;
    setApplyMessage(null);
    try {
      const formData = new FormData();
      formData.append("workspaceId", String(workspaceId));
      formData.append("articleId", String(context.entityId));
      formData.append("bodyMd", response);
      formData.append("changeSummary", changeSummary.trim() || "LLM draft");

      const res = await fetch("/api/revisions/draft", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) {
        setApplyMessage(data?.error || "Failed to create draft.");
        return;
      }
      if (data?.revisionId) {
        setDraftId(data.revisionId);
        setApplyMessage("Draft created. Review or submit for approval.");
      }
    } catch {
      setApplyMessage("Failed to create draft.");
    }
  };

  const handleSubmitReview = async () => {
    if (!draftId || !workspaceId) return;
    setApplyMessage(null);
    try {
      const formData = new FormData();
      formData.append("workspaceId", String(workspaceId));
      formData.append("revisionId", draftId);
      const res = await fetch("/api/revisions/submit", { method: "POST", body: formData });
      if (!res.ok) {
        const text = await res.text();
        setApplyMessage(text || "Failed to submit review.");
        return;
      }
      window.location.href = "/reviews";
    } catch {
      setApplyMessage("Failed to submit review.");
    }
  };
  
  // ... (keep state variables)
  const handleSubmit = async () => {
    if (loading || !prompt.trim()) return;
    setLoading(true);
    setResponse("");
    try {
      const formData = new FormData();
      formData.append("provider", provider);
      formData.append("prompt", prompt.trim());
      if (workspaceId) formData.append("workspaceId", workspaceId);
      if (provider !== "codex_cli") {
        if (geminiModel.trim()) formData.append("model", geminiModel.trim());
        formData.append("search", String(geminiSearch));
      }

      const res = await fetch("/api/llm/execute", { method: "POST", body: formData });
      if (!res.ok) {
        const text = await res.text();
        setResponse(text || `Request failed (${res.status})`);
        return;
      }
      if (!res.body) {
        const text = await res.text();
        setResponse(text);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let fullText = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        if (value) {
          fullText += decoder.decode(value, { stream: true });
          setResponse(fullText);
        }
      }
    } catch (error) {
      setResponse(`Error: ${String(error)}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Floating Toggle Button */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open AI Orchestrator"
        data-testid="llm-toggle"
        className={cn(
          "fixed bottom-6 right-6 z-40 p-4 rounded-full shadow-2xl transition-all hover:scale-110 active:scale-95 group overflow-hidden",
          "bg-accent text-white"
        )}
      >
        <div className="absolute inset-0 bg-gradient-to-tr from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-6 h-6">
          <path d="M12 3l1.912 5.813a2 2 0 0 0 1.275 1.275L21 12l-5.813 1.912a2 2 0 0 0-1.275 1.275L12 21l-1.912-5.813a2 2 0 0 0-1.275-1.275L3 12l5.813-1.912a2 2 0 0 0 1.275-1.275L12 3z" />
          <path d="M5 3v4" />
          <path d="M9 5H5" />
        </svg>
      </button>

      {/* Backdrop */}
      {open && (
        <div 
          className="fixed inset-0 bg-black/20 dark:bg-black/40 backdrop-blur-[2px] z-[50] animate-fade-in"
          onClick={() => setOpen(false)}
          data-testid="llm-backdrop"
        />
      )}

      {/* Drawer */}
      <div className={cn(
        "fixed top-0 right-0 h-full w-full max-w-lg z-[60] bg-panel border-l border-border shadow-2xl transition-transform duration-500 ease-in-out flex flex-col",
        open ? "translate-x-0" : "translate-x-full"
      )} data-testid="llm-panel">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border bg-bg/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-accent/10 rounded-lg text-accent">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
                <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 18a8 8 0 1 1 8-8 8 8 0 0 1-8 8z" />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-bold text-ink leading-tight">AI Orchestrator</h3>
              <p className="text-[10px] uppercase font-bold tracking-widest text-muted">Intelligent Worldbuilding</p>
            </div>
          </div>
          <button 
            onClick={() => setOpen(false)}
            className="p-2 hover:bg-bg rounded-full transition-colors text-muted hover:text-ink"
            aria-label="Close AI Orchestrator"
            data-testid="llm-close"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-6 h-6">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-8 space-y-8">
          {/* Config Toggle */}
          <div className="flex justify-end">
            <button 
              onClick={() => setShowConfig(!showConfig)}
              className="text-[10px] font-bold uppercase tracking-widest text-muted hover:text-accent flex items-center gap-2"
              aria-expanded={showConfig}
              data-testid="llm-config-toggle"
            >
              {showConfig ? "Hide Config" : "Show Config"}
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={cn("w-3 h-3 transition-transform", showConfig && "rotate-180")}>
                <path d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>

          {showConfig && (
            <div className="space-y-4 p-4 rounded-xl bg-bg border border-border animate-in slide-in-from-top-2 duration-300" data-testid="llm-config-panel">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-widest text-muted">Provider</label>
                <select 
                  value={provider} 
                  onChange={(e) => setProvider(e.target.value as Provider)}
                  className="w-full bg-panel border border-border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent"
                  data-testid="llm-provider-select"
                >
                  {availableProviders.map((v) => (
                    <option key={v} value={v}>{PROVIDER_LABELS[v]}</option>
                  ))}
                </select>
              </div>
              
              {/* Additional Model Configs based on provider ... */}
            </div>
          )}

          {/* Prompt Area */}
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-widest text-muted">Context-Aware Prompt</label>
              <textarea 
                value={prompt} 
                onChange={(e) => setPrompt(e.target.value)} 
                placeholder="Ask about the current entity, map, or request worldbuilding ideas..."
                rows={6}
                className="w-full bg-bg border border-border rounded-xl p-4 text-sm leading-relaxed outline-none focus:ring-2 focus:ring-accent transition-all resize-none shadow-inner"
                data-testid="llm-prompt"
              />
            </div>
            <Button 
              onClick={handleSubmit} 
              disabled={loading || !prompt.trim()}
              className="w-full py-4 text-sm font-bold gap-3 rounded-xl shadow-xl shadow-accent/20"
              data-testid="llm-execute"
            >
              {loading ? (
                <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-4 h-4">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              )}
              {loading ? "Orchestrating..." : "Execute Query"}
            </Button>
          </div>

          {/* Response Area */}
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-muted">Orchestrator Output</label>
              {response && (
                <button 
                  onClick={() => {
                    navigator.clipboard.writeText(response);
                    // Could add toast here
                  }}
                  className="text-[10px] font-bold text-accent hover:underline"
                >
                  Copy Response
                </button>
              )}
            </div>
            
            <div className={cn(
              "min-h-[200px] p-6 rounded-2xl border border-border shadow-sm",
              loading ? "bg-bg/50 opacity-50" : "bg-bg/20"
            )}>
              {response ? (
                <div className="prose dark:prose-invert prose-sm max-w-none">
                  <MarkdownView value={response} />
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full py-12 text-muted/50 italic text-sm">
                  Waiting for query execution...
                </div>
              )}
            </div>
          </div>

          {canApply && (
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-border pb-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-muted">Safe Apply</label>
                <span className="text-[10px] text-muted uppercase tracking-widest">Diff → Review → Apply</span>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-muted">Change Summary</label>
                <input
                  value={changeSummary}
                  onChange={(e) => setChangeSummary(e.target.value)}
                  className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-accent"
                  placeholder="Summarize the changes"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={handlePreviewDiff}
                  disabled={diffLoading}
                  data-testid="llm-diff-preview"
                >
                  {diffLoading ? "Loading diff..." : "Preview Diff"}
                </button>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={handleCreateDraft}
                  data-testid="llm-create-draft"
                >
                  Create Draft
                </button>
                {draftId && (
                  <>
                    <button type="button" className="btn-secondary" onClick={handleSubmitReview} data-testid="llm-request-review">
                      Request Review
                    </button>
                    <a href={`/revisions/${draftId}`} className="btn-link" data-testid="llm-open-draft">
                      Open Draft
                    </a>
                  </>
                )}
              </div>
              {applyMessage && <div className="text-xs text-muted">{applyMessage}</div>}
              {diffParts && (
                <div className="diff-preview">
                  <div className="diff-stats">
                    <span className="diff-added">+ Added</span>
                    <span className="diff-removed">- Removed</span>
                  </div>
                  <pre className="diff-block">
                    {diffParts.map((part, index) => (
                      <span
                        key={index}
                        className={part.added ? "diff-line-added" : part.removed ? "diff-line-removed" : "diff-line-context"}
                      >
                        {part.value}
                      </span>
                    ))}
                  </pre>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 bg-bg/50 border-t border-border text-[9px] text-center uppercase font-bold tracking-[0.2em] text-muted/60">
          Powered by Deep Knowledge Integration
        </div>
      </div>
    </>
  );
}
