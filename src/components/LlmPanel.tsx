"use client";

import { useState } from "react";

export function LlmPanel({ workspaceId }: { workspaceId?: string | null }) {
  const [open, setOpen] = useState(false);
  const [provider, setProvider] = useState("gemini");
  const [prompt, setPrompt] = useState("");
  const [response, setResponse] = useState<string>("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setResponse("");
    const form = new FormData();
    form.append("provider", provider);
    form.append("prompt", prompt);
    if (workspaceId) form.append("workspaceId", workspaceId);
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
    const res = await fetch("/api/llm/execute", {
      method: "POST",
      body: form
    });
    const data = await res.json();
    setResponse(JSON.stringify(data, null, 2));
    setLoading(false);
  }

  return (
    <div className={`llm-panel ${open ? "open" : ""}`}>
      <button type="button" className="llm-toggle" onClick={() => setOpen(!open)}>
        LLM
      </button>
      {open && (
        <div className="llm-body">
          <form onSubmit={handleSubmit} className="form-grid">
            <label>
              Provider
              <select value={provider} onChange={(event) => setProvider(event.target.value)}>
                <option value="gemini">Gemini</option>
                <option value="codex_cli">Codex CLI</option>
              </select>
            </label>
            <label>
              Prompt
              <textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} rows={6} />
            </label>
            <button type="submit" disabled={loading}>
              {loading ? "Running..." : "Run"}
            </button>
          </form>
          <pre className="code-block">{response || "No output yet."}</pre>
        </div>
      )}
    </div>
  );
}
