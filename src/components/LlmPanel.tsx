"use client";

import { useState } from "react";

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

  const [geminiModel, setGeminiModel] = useState(defaultGeminiModel ?? "gemini-1.5-flash");
  const [geminiSearch, setGeminiSearch] = useState(false);
  const [geminiApiKey, setGeminiApiKey] = useState("");

  const [vertexModel, setVertexModel] = useState(defaultVertexModel ?? "gemini-1.5-flash");
  const [vertexSearch, setVertexSearch] = useState(false);
  const [vertexApiKey, setVertexApiKey] = useState("");
  const [vertexProject, setVertexProject] = useState("");
  const [vertexLocation, setVertexLocation] = useState("");

  const [codexAuthBase64, setCodexAuthBase64] = useState("");

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!prompt.trim()) return;
    setLoading(true);
    setResponse("");

    const form = new FormData();
    form.append("provider", provider);
    form.append("prompt", prompt);
    if (workspaceId) form.append("workspaceId", workspaceId);

    if (provider === "gemini_ai") {
      form.append("model", geminiModel);
      form.append("search", geminiSearch ? "true" : "false");
      if (geminiApiKey.trim()) form.append("apiKey", geminiApiKey.trim());
    }

    if (provider === "gemini_vertex") {
      form.append("model", vertexModel);
      form.append("search", vertexSearch ? "true" : "false");
      if (vertexApiKey.trim()) form.append("apiKey", vertexApiKey.trim());
      if (vertexProject.trim()) form.append("vertexProject", vertexProject.trim());
      if (vertexLocation.trim()) form.append("vertexLocation", vertexLocation.trim());
    }

    if (provider === "codex_cli") {
      if (codexAuthBase64.trim()) form.append("codexAuthBase64", codexAuthBase64.trim());
    }

    const contextEl = document.getElementById("llm-context");
    let pageContext: unknown = null;
    if (contextEl?.textContent) {
      try {
        pageContext = JSON.parse(contextEl.textContent);
      } catch {
        pageContext = contextEl.textContent;
      }
    }
    const contextPayload = {
      url: window.location.href,
      title: document.title,
      page: pageContext
    };
    form.append("context", JSON.stringify(contextPayload));

    try {
      const res = await fetch("/api/llm/execute", {
        method: "POST",
        body: form
      });
      const data = await res.json();
      if (data?.result?.data?.text) {
        setResponse(data.result.data.text);
      } else if (data?.result?.error) {
        setResponse(data.result.error);
      } else {
        setResponse(JSON.stringify(data, null, 2));
      }
    } catch (error) {
      setResponse(String(error));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={`llm-panel ${open ? "open" : ""}`}>
      <button type="button" className="llm-toggle" onClick={() => setOpen(!open)}>
        LLM
      </button>
      {open && (
        <div className="llm-body">
          {availableProviders.length === 0 ? (
            <p className="muted">No LLM providers enabled in environment.</p>
          ) : (
            <form onSubmit={handleSubmit} className="form-grid">
              <label>
                Provider
                <select value={provider} onChange={(event) => setProvider(event.target.value as Provider)}>
                  {availableProviders.map((value) => (
                    <option key={value} value={value}>
                      {PROVIDER_LABELS[value] ?? value}
                    </option>
                  ))}
                </select>
              </label>

              {provider === "gemini_ai" && (
                <>
                  <label>
                    Gemini API key (optional)
                    <input
                      type="password"
                      value={geminiApiKey}
                      onChange={(event) => setGeminiApiKey(event.target.value)}
                      placeholder="Uses GEMINI_API_KEY if blank"
                    />
                  </label>
                  <label>
                    Model
                    <input value={geminiModel} onChange={(event) => setGeminiModel(event.target.value)} />
                  </label>
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={geminiSearch}
                      onChange={(event) => setGeminiSearch(event.target.checked)}
                    />
                    Enable Google Search tool
                  </label>
                </>
              )}

              {provider === "gemini_vertex" && (
                <>
                  <label>
                    Vertex API key (optional)
                    <input
                      type="password"
                      value={vertexApiKey}
                      onChange={(event) => setVertexApiKey(event.target.value)}
                      placeholder="Uses VERTEX_GEMINI_API_KEY if blank"
                    />
                  </label>
                  <label>
                    Vertex Project
                    <input
                      value={vertexProject}
                      onChange={(event) => setVertexProject(event.target.value)}
                      placeholder="Uses VERTEX_GEMINI_PROJECT if blank"
                    />
                  </label>
                  <label>
                    Vertex Location
                    <input
                      value={vertexLocation}
                      onChange={(event) => setVertexLocation(event.target.value)}
                      placeholder="e.g. us-central1"
                    />
                  </label>
                  <label>
                    Model
                    <input value={vertexModel} onChange={(event) => setVertexModel(event.target.value)} />
                  </label>
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={vertexSearch}
                      onChange={(event) => setVertexSearch(event.target.checked)}
                    />
                    Enable Google Search tool
                  </label>
                </>
              )}

              {provider === "codex_cli" && (
                <>
                  <label>
                    Codex auth.json (base64, optional)
                    <textarea
                      value={codexAuthBase64}
                      onChange={(event) => setCodexAuthBase64(event.target.value)}
                      rows={4}
                      placeholder="If blank, uses ~/.codex/auth.json"
                      spellCheck={false}
                    />
                  </label>
                  <p className="muted">Model fixed to GPT-5.2 with search enabled.</p>
                </>
              )}

              <label>
                Prompt
                <textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} rows={6} />
              </label>
              <button type="submit" disabled={loading}>
                {loading ? "Running..." : "Run"}
              </button>
            </form>
          )}
          <pre className="code-block">{response || "No output yet."}</pre>
        </div>
      )}
    </div>
  );
}
