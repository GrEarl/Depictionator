"use client";

import { useState } from "react";
import Link from "next/link";

type MetadataPayload = {
  title?: string;
  author?: string;
  year?: string;
  publisher?: string;
  sourceUrl?: string;
  doi?: string;
  url?: string;
};

type ReferenceFormProps = {
  workspaceId: string;
  defaultRetrievedAt: string;
};

export function ReferenceForm({ workspaceId, defaultRetrievedAt }: ReferenceFormProps) {
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [publisher, setPublisher] = useState("");
  const [year, setYear] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");

  const [lookupMode, setLookupMode] = useState<"doi" | "bibtex">("doi");
  const [lookupInput, setLookupInput] = useState("");
  const [lookupBibtex, setLookupBibtex] = useState("");
  const [lookupStatus, setLookupStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [lookupMessage, setLookupMessage] = useState<string | null>(null);

  const applyMetadata = (data: MetadataPayload) => {
    if (data.title) setTitle((prev) => prev || data.title || "");
    if (data.author) setAuthor((prev) => prev || data.author || "");
    if (data.publisher) setPublisher((prev) => prev || data.publisher || "");
    if (data.year) setYear((prev) => prev || data.year || "");

    const nextUrl = data.sourceUrl || data.url || (data.doi ? `https://doi.org/${data.doi}` : "");
    if (nextUrl) setSourceUrl((prev) => prev || nextUrl);
  };

  const handleLookup = async () => {
    if (lookupMode === "doi" && !lookupInput.trim()) return;
    if (lookupMode === "bibtex" && !lookupBibtex.trim()) return;

    setLookupStatus("loading");
    setLookupMessage(null);

    try {
      const response = await fetch("/api/references/metadata", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId,
          doi: lookupMode === "doi" ? lookupInput.trim() : undefined,
          bibtex: lookupMode === "bibtex" ? lookupBibtex.trim() : undefined
        })
      });

      const data = await response.json();
      if (!response.ok || !data?.data) {
        setLookupStatus("error");
        setLookupMessage(data?.error || "Metadata lookup failed");
        return;
      }

      applyMetadata(data.data as MetadataPayload);
      setLookupStatus("success");
      setLookupMessage("Metadata loaded. Review and edit before saving.");
    } catch (error) {
      setLookupStatus("error");
      setLookupMessage("Metadata lookup failed");
    }
  };

  return (
    <form action="/api/references/create" method="post" className="form-card">
      <input type="hidden" name="workspaceId" value={workspaceId} />

      <div className="reference-import-panel">
        <div className="reference-import-header">
          <div>
            <div className="reference-import-title">Metadata Assist</div>
            <div className="reference-import-subtitle">DOI or BibTeX to auto-fill fields</div>
          </div>
          <div className="reference-import-tabs">
            <button
              type="button"
              className={lookupMode === "doi" ? "active" : ""}
              onClick={() => setLookupMode("doi")}
            >
              DOI
            </button>
            <button
              type="button"
              className={lookupMode === "bibtex" ? "active" : ""}
              onClick={() => setLookupMode("bibtex")}
            >
              BibTeX
            </button>
          </div>
        </div>

        {lookupMode === "doi" ? (
          <div className="reference-import-body">
            <input
              value={lookupInput}
              onChange={(event) => setLookupInput(event.target.value)}
              placeholder="10.1000/xyz123 or https://doi.org/..."
            />
          </div>
        ) : (
          <div className="reference-import-body">
            <textarea
              value={lookupBibtex}
              onChange={(event) => setLookupBibtex(event.target.value)}
              rows={4}
              placeholder="Paste BibTeX entry here"
            />
          </div>
        )}

        <div className="reference-import-actions">
          <button
            type="button"
            className="btn-secondary"
            onClick={handleLookup}
            disabled={lookupStatus === "loading"}
          >
            {lookupStatus === "loading" ? "Loading..." : "Fetch Metadata"}
          </button>
          {lookupMessage && (
            <span className={`reference-import-status ${lookupStatus}`}>{lookupMessage}</span>
          )}
        </div>
      </div>

      {/* Type Selection */}
      <div className="form-group">
        <label className="form-label required">Reference Type</label>
        <select name="type" required className="form-select">
          <option value="url">URL</option>
          <option value="book">Book</option>
          <option value="pdf">PDF</option>
          <option value="image">Image</option>
          <option value="file">File</option>
          <option value="internal">Internal</option>
          <option value="other">Other</option>
        </select>
      </div>

      {/* Title */}
      <div className="form-group">
        <label className="form-label required">Title</label>
        <input
          type="text"
          name="title"
          required
          placeholder="Title of the source"
          className="form-input"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
        />
      </div>

      {/* Author */}
      <div className="form-group">
        <label className="form-label">Author(s)</label>
        <input
          type="text"
          name="author"
          placeholder="Author name(s)"
          className="form-input"
          value={author}
          onChange={(event) => setAuthor(event.target.value)}
        />
        <span className="form-hint">
          For multiple authors, separate with semicolons (;)
        </span>
      </div>

      {/* URL */}
      <div className="form-group">
        <label className="form-label">Source URL / DOI</label>
        <input
          type="url"
          name="sourceUrl"
          placeholder="https://... or https://doi.org/..."
          className="form-input"
          value={sourceUrl}
          onChange={(event) => setSourceUrl(event.target.value)}
        />
        <span className="form-hint">
          Paste the URL or a doi.org URL.
        </span>
      </div>

      {/* Publisher / Website */}
      <div className="form-group">
        <label className="form-label">Publisher / Website</label>
        <input
          type="text"
          name="publisher"
          placeholder="Publisher or website name"
          className="form-input"
          value={publisher}
          onChange={(event) => setPublisher(event.target.value)}
        />
      </div>

      {/* Published Year */}
      <div className="form-row">
        <div className="form-group">
          <label className="form-label">Published Year</label>
          <input
            type="number"
            name="year"
            min="1000"
            max="2100"
            placeholder="2024"
            className="form-input"
            value={year}
            onChange={(event) => setYear(event.target.value)}
          />
        </div>
        <div className="form-group">
          <label className="form-label">Access Date</label>
          <input
            type="date"
            name="retrievedAt"
            defaultValue={defaultRetrievedAt}
            className="form-input"
          />
        </div>
      </div>

      {/* License */}
      <div className="form-group">
        <label className="form-label">License</label>
        <select name="licenseId" className="form-select">
          <option value="">Unknown / Not specified</option>
          <option value="CC0">CC0 (Public Domain)</option>
          <option value="CC BY">CC BY (Attribution)</option>
          <option value="CC BY-SA">CC BY-SA (Attribution-ShareAlike)</option>
          <option value="CC BY-NC">CC BY-NC (Attribution-NonCommercial)</option>
          <option value="CC BY-NC-SA">CC BY-NC-SA</option>
          <option value="CC BY-ND">CC BY-ND (Attribution-NoDerivs)</option>
          <option value="GFDL">GFDL</option>
          <option value="Fair Use">Fair Use</option>
          <option value="All Rights Reserved">All Rights Reserved</option>
          <option value="Other">Other</option>
        </select>
      </div>

      {/* License URL */}
      <div className="form-group">
        <label className="form-label">License URL</label>
        <input
          type="url"
          name="licenseUrl"
          placeholder="https://creativecommons.org/licenses/..."
          className="form-input"
        />
      </div>

      {/* Notes */}
      <div className="form-group">
        <label className="form-label">Notes</label>
        <textarea
          name="notes"
          rows={4}
          placeholder="Additional notes about this source..."
          className="form-textarea"
        />
      </div>

      {/* Summary */}
      <div className="form-group">
        <label className="form-label">Summary (Optional)</label>
        <textarea
          name="summary"
          rows={3}
          placeholder="Short summary or abstract..."
          className="form-textarea"
        />
      </div>

      {/* Attribution Text */}
      <div className="form-group">
        <label className="form-label">Attribution Text (Optional)</label>
        <textarea
          name="attributionText"
          rows={3}
          placeholder="Preferred citation or attribution text..."
          className="form-textarea"
        />
        <span className="form-hint">
          If left empty, a citation will be auto-generated from the fields above
        </span>
      </div>

      {/* Actions */}
      <div className="form-actions">
        <Link href="/references" className="btn-secondary">
          Cancel
        </Link>
        <button type="submit" className="btn-primary">
          Add Reference
        </button>
      </div>
    </form>
  );
}
