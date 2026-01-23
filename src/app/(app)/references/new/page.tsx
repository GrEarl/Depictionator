import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getActiveWorkspace } from "@/lib/workspaces";

/**
 * New Reference Page
 * Create a new reference entry for the library
 */
export default async function NewReferencePage() {
  const user = await requireUser();
  const workspace = await getActiveWorkspace(user.id);

  if (!workspace) {
    return <div className="panel">Select a workspace first.</div>;
  }

  return (
    <div className="page-container max-w-2xl">
      <div className="page-header">
        <div>
          <Link href="/references" className="back-link">
            ← Back to Library
          </Link>
          <h1 className="page-title">Add Reference</h1>
          <p className="page-subtitle">
            Add a new source to your reference library
          </p>
        </div>
      </div>

      <form action="/api/references/create" method="post" className="form-card">
        <input type="hidden" name="workspaceId" value={workspace.id} />

        {/* Type Selection */}
        <div className="form-group">
          <label className="form-label required">Reference Type</label>
          <select name="type" required className="form-select">
            <option value="webpage">Webpage</option>
            <option value="book">Book</option>
            <option value="article">Journal Article</option>
            <option value="document">Document</option>
            <option value="image">Image</option>
            <option value="video">Video</option>
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
          />
          <span className="form-hint">
            For multiple authors, separate with semicolons (;)
          </span>
        </div>

        {/* URL */}
        <div className="form-group">
          <label className="form-label">URL</label>
          <input
            type="url"
            name="url"
            placeholder="https://..."
            className="form-input"
          />
        </div>

        {/* DOI */}
        <div className="form-group">
          <label className="form-label">DOI</label>
          <input
            type="text"
            name="doi"
            placeholder="10.xxxx/..."
            className="form-input"
          />
        </div>

        {/* Publisher / Website */}
        <div className="form-group">
          <label className="form-label">Publisher / Website</label>
          <input
            type="text"
            name="publisher"
            placeholder="Publisher or website name"
            className="form-input"
          />
        </div>

        {/* Published Year */}
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Published Year</label>
            <input
              type="number"
              name="publishedYear"
              min="1000"
              max="2100"
              placeholder="2024"
              className="form-input"
            />
          </div>
          <div className="form-group">
            <label className="form-label">Access Date</label>
            <input
              type="date"
              name="accessedAt"
              defaultValue={new Date().toISOString().split("T")[0]}
              className="form-input"
            />
          </div>
        </div>

        {/* License */}
        <div className="form-group">
          <label className="form-label">License</label>
          <select name="license" className="form-select">
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

        {/* Citation Text */}
        <div className="form-group">
          <label className="form-label">Citation Text (Optional)</label>
          <textarea
            name="citationText"
            rows={3}
            placeholder="Pre-formatted citation in your preferred style..."
            className="form-textarea"
          />
          <span className="form-hint">
            If left empty, citation will be auto-generated from the fields above
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
    </div>
  );
}
