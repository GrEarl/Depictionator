"use client";

import { useState } from "react";

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
  const [query, setQuery] = useState("");
  const [lang, setLang] = useState("en");
  const [results, setResults] = useState<WikiSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [page, setPage] = useState<WikiPage | null>(null);

  const [importTitle, setImportTitle] = useState("");
  const [importPageId, setImportPageId] = useState("");
  const [entityType, setEntityType] = useState(entityTypes[0] ?? "concept");
  const [publish, setPublish] = useState("true");
  const [targetLang, setTargetLang] = useState("");
  const [useLlm, setUseLlm] = useState("true");
  const [aggregateLangs, setAggregateLangs] = useState("true");
  const [llmProvider, setLlmProvider] = useState("gemini_ai");
  const [llmModel, setLlmModel] = useState("");

  async function runSearch() {
    if (!query.trim()) return;
    setLoading(true);
    setError("");
    setResults([]);
    setPage(null);
    try {
      const form = new FormData();
      form.append("query", query.trim());
      form.append("lang", lang.trim());
      const res = await fetch("/api/wiki/search", { method: "POST", body: form });
      if (!res.ok) {
        setError(await res.text());
        return;
      }
      const data = (await res.json()) as { results?: WikiSearchResult[] };
      setResults(data.results ?? []);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }

  async function loadPage(result: WikiSearchResult) {
    setLoading(true);
    setError("");
    try {
      const form = new FormData();
      form.append("pageId", String(result.pageId));
      form.append("lang", lang.trim());
      const res = await fetch("/api/wiki/page", { method: "POST", body: form });
      if (!res.ok) {
        setError(await res.text());
        return;
      }
      const data = (await res.json()) as { page?: WikiPage };
      setPage(data.page ?? null);
      setImportTitle(result.title);
      setImportPageId(String(result.pageId));
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="panel wiki-panel">
      <h3>Wiki import (search + preview)</h3>
      <div className="form-grid">
        <label>
          Search query
          <input value={query} onChange={(event) => setQuery(event.target.value)} />
        </label>
        <label>
          Language
          <input value={lang} onChange={(event) => setLang(event.target.value)} />
        </label>
        <button type="button" onClick={runSearch} disabled={loading}>
          {loading ? "Searching..." : "Search"}
        </button>
        {error && <div className="muted">Error: {error}</div>}
      </div>

      {results.length > 0 && (
        <div className="wiki-results">
          {results.map((result) => (
            <div key={result.pageId} className="wiki-card">
              <strong>{result.title}</strong>
              <div className="wiki-snippet">{result.snippet}</div>
              <div className="list-row">
                <a href={result.url} target="_blank" rel="noreferrer">Open</a>
                <button type="button" className="link-button" onClick={() => loadPage(result)}>
                  Preview
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {page && (
        <div className="wiki-card">
          <strong>{page.title}</strong>
          <div className="wiki-snippet">{page.extract?.slice(0, 400)}{page.extract?.length > 400 ? "..." : ""}</div>
          {page.images?.length > 0 && (
            <div className="wiki-images">
              {page.images.slice(0, 12).map((img) => (
                <span key={img} className="wiki-image-chip">{img}</span>
              ))}
            </div>
          )}
        </div>
      )}

      <form action="/api/wiki/import/article" method="post" className="form-grid">
        <input type="hidden" name="workspaceId" value={workspaceId} />
        <label>
          Title
          <input name="title" value={importTitle} onChange={(event) => setImportTitle(event.target.value)} />
        </label>
        <label>
          Page ID
          <input name="pageId" value={importPageId} onChange={(event) => setImportPageId(event.target.value)} />
        </label>
        <label>
          Language
          <input name="lang" value={lang} onChange={(event) => setLang(event.target.value)} />
        </label>
        <label>
          Target language (optional)
          <input name="targetLang" value={targetLang} onChange={(event) => setTargetLang(event.target.value)} />
        </label>
        <label>
          Entity type
          <select name="entityType" value={entityType} onChange={(event) => setEntityType(event.target.value)}>
            {entityTypes.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </label>
        <label>
          Publish
          <select name="publish" value={publish} onChange={(event) => setPublish(event.target.value)}>
            <option value="true">Yes</option>
            <option value="false">No</option>
          </select>
        </label>
        <details className="panel" style={{ padding: "12px" }}>
          <summary>LLM options</summary>
          <label>
            Use LLM
            <select name="useLlm" value={useLlm} onChange={(event) => setUseLlm(event.target.value)}>
              <option value="true">true</option>
              <option value="false">false</option>
            </select>
          </label>
          <label>
            Aggregate languages
            <select name="aggregateLangs" value={aggregateLangs} onChange={(event) => setAggregateLangs(event.target.value)}>
              <option value="true">true</option>
              <option value="false">false</option>
            </select>
          </label>
          <label>
            LLM provider
            <select name="llmProvider" value={llmProvider} onChange={(event) => setLlmProvider(event.target.value)}>
              <option value="gemini_ai">gemini_ai</option>
              <option value="gemini_vertex">gemini_vertex</option>
              <option value="codex_cli">codex_cli</option>
            </select>
          </label>
          <label>
            LLM model (optional)
            <input name="llmModel" value={llmModel} onChange={(event) => setLlmModel(event.target.value)} />
          </label>
        </details>
        <button type="submit">Import</button>
      </form>
    </section>
  );
}
