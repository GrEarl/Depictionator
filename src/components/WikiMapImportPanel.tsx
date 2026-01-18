"use client";

import { useState, type FormEvent } from "react";

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
  const [parentMapQuery, setParentMapQuery] = useState("");
  const [assetImporting, setAssetImporting] = useState(false);
  const [mapImporting, setMapImporting] = useState(false);
  const [assetMessage, setAssetMessage] = useState("");
  const [mapMessage, setMapMessage] = useState("");
  const [assetError, setAssetError] = useState("");
  const [mapError, setMapError] = useState("");
  const [importedMapId, setImportedMapId] = useState<string | null>(null);

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

  async function handleAssetImport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAssetImporting(true);
    setAssetMessage("");
    setAssetError("");
    try {
      const form = new FormData(event.currentTarget);
      const res = await fetch(event.currentTarget.action, { method: "POST", body: form });
      if (!res.ok) {
        const text = await res.text();
        let message = text;
        try {
          const json = JSON.parse(text) as { error?: string };
          message = json.error ?? message;
        } catch {}
        setAssetError(message || "Import failed.");
        return;
      }
      await res.json();
      setAssetMessage("Image imported.");
    } catch (err) {
      setAssetError(String(err));
    } finally {
      setAssetImporting(false);
    }
  }

  async function handleMapImport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMapImporting(true);
    setMapMessage("");
    setMapError("");
    setImportedMapId(null);
    try {
      const form = new FormData(event.currentTarget);
      const res = await fetch(event.currentTarget.action, { method: "POST", body: form });
      if (!res.ok) {
        const text = await res.text();
        let message = text;
        try {
          const json = JSON.parse(text) as { error?: string };
          message = json.error ?? message;
        } catch {}
        setMapError(message || "Import failed.");
        return;
      }
      const data = (await res.json()) as { map?: { id: string; title: string } };
      const title = data.map?.title || "Map";
      setMapMessage(`${title} imported.`);
      if (data.map?.id) {
        setImportedMapId(data.map.id);
      }
    } catch (err) {
      setMapError(String(err));
    } finally {
      setMapImporting(false);
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

      <form action="/api/wiki/import/asset" method="post" className="form-grid" onSubmit={handleAssetImport}>
        <input type="hidden" name="workspaceId" value={workspaceId} />
        <label>
          Image title
          <input name="imageTitle" value={imageTitle} onChange={(event) => setImageTitle(event.target.value)} />
        </label>
        <label>
          Language
          <input name="lang" value={lang} onChange={(event) => setLang(event.target.value)} />
        </label>
        <button type="submit" disabled={assetImporting}>
          {assetImporting ? "Importing..." : "Import image asset"}
        </button>
        {assetMessage && <div className="muted">{assetMessage}</div>}
        {assetError && <div className="muted">Error: {assetError}</div>}
      </form>

      <form
        action="/api/wiki/import/map"
        method="post"
        className="form-grid"
        style={{ marginTop: "12px" }}
        onSubmit={handleMapImport}
      >
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
          Parent map (search, optional)
          <input
            name="parentMapQuery"
            value={parentMapQuery}
            onChange={(event) => setParentMapQuery(event.target.value)}
            placeholder="Type a map name..."
          />
        </label>
        <label>
          Bounds JSON (optional)
          <input name="bounds" value={bounds} onChange={(event) => setBounds(event.target.value)} placeholder="[[0,0],[1000,1000]]" />
        </label>
        <label>
          Language
          <input name="lang" value={lang} onChange={(event) => setLang(event.target.value)} />
        </label>
        <button type="submit" disabled={mapImporting}>
          {mapImporting ? "Importing..." : "Import map"}
        </button>
        {mapMessage && (
          <div className="muted">
            {mapMessage}{" "}
            {importedMapId && (
              <a href={`/maps?map=${importedMapId}`} className="underline">
                Open map
              </a>
            )}
          </div>
        )}
        {mapError && <div className="muted">Error: {mapError}</div>}
      </form>
    </section>
  );
}
