"use client";

import { useState } from "react";

type WikiPage = {
  pageId: number;
  title: string;
  url: string;
  extract: string;
  wikitext: string;
  images: string[];
};

type WikiMapImportPanelProps = {
  workspaceId: string;
};

export function WikiMapImportPanel({ workspaceId }: WikiMapImportPanelProps) {
  const [lang, setLang] = useState("en");
  const [pageTitle, setPageTitle] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [imageTitle, setImageTitle] = useState("");
  const [mapTitle, setMapTitle] = useState("");
  const [bounds, setBounds] = useState("");
  const [parentMapId, setParentMapId] = useState("");

  async function fetchImages() {
    if (!pageTitle.trim()) return;
    setLoading(true);
    setError("");
    setImages([]);
    try {
      const form = new FormData();
      form.append("title", pageTitle.trim());
      form.append("lang", lang.trim());
      const res = await fetch("/api/wiki/page", { method: "POST", body: form });
      if (!res.ok) {
        setError(await res.text());
        return;
      }
      const data = (await res.json()) as { page?: WikiPage };
      const page = data.page;
      if (!page) {
        setError("Page not found");
        return;
      }
      const onlyFiles = (page.images ?? []).filter((img) => img.startsWith("File:"));
      setImages(onlyFiles);
      if (!imageTitle && onlyFiles[0]) {
        setImageTitle(onlyFiles[0]);
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="panel wiki-panel">
      <h3>Wiki import (map/image)</h3>
      <div className="form-grid">
        <label>
          Page title (to list images)
          <input value={pageTitle} onChange={(event) => setPageTitle(event.target.value)} />
        </label>
        <label>
          Language
          <input value={lang} onChange={(event) => setLang(event.target.value)} />
        </label>
        <button type="button" onClick={fetchImages} disabled={loading}>
          {loading ? "Loading..." : "Fetch images"}
        </button>
        {error && <div className="muted">Error: {error}</div>}
      </div>
      {images.length > 0 && (
        <div className="wiki-images">
          {images.slice(0, 20).map((img) => (
            <button
              key={img}
              type="button"
              className="wiki-image-chip"
              onClick={() => setImageTitle(img)}
            >
              {img}
            </button>
          ))}
        </div>
      )}

      <form action="/api/wiki/import/asset" method="post" className="form-grid">
        <input type="hidden" name="workspaceId" value={workspaceId} />
        <label>
          Image title
          <input name="imageTitle" value={imageTitle} onChange={(event) => setImageTitle(event.target.value)} />
        </label>
        <label>
          Language
          <input name="lang" value={lang} onChange={(event) => setLang(event.target.value)} />
        </label>
        <button type="submit">Import image asset</button>
      </form>

      <form action="/api/wiki/import/map" method="post" className="form-grid" style={{ marginTop: "12px" }}>
        <input type="hidden" name="workspaceId" value={workspaceId} />
        <label>
          Map title
          <input name="mapTitle" value={mapTitle} onChange={(event) => setMapTitle(event.target.value)} />
        </label>
        <label>
          Image title
          <input name="imageTitle" value={imageTitle} onChange={(event) => setImageTitle(event.target.value)} />
        </label>
        <label>
          Parent map ID (optional)
          <input name="parentMapId" value={parentMapId} onChange={(event) => setParentMapId(event.target.value)} />
        </label>
        <label>
          Bounds JSON (optional)
          <input name="bounds" value={bounds} onChange={(event) => setBounds(event.target.value)} placeholder="[[0,0],[1000,1000]]" />
        </label>
        <label>
          Language
          <input name="lang" value={lang} onChange={(event) => setLang(event.target.value)} />
        </label>
        <button type="submit">Import map</button>
      </form>
    </section>
  );
}
