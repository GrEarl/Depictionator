import { requireUser } from "@/lib/auth";
import { getActiveWorkspace } from "@/lib/workspaces";

const VIEWPOINT_TYPES = ["player", "faction", "character", "omniscient"];

export default async function SettingsPage() {
  const user = await requireUser();
  const workspace = await getActiveWorkspace(user.id);

  return (
    <div className="panel">
      <h2>Settings</h2>
      {!workspace && <p className="muted">Select a workspace to manage settings.</p>}

      {workspace && (
        <>
          <section className="panel">
            <h3>Viewpoints</h3>
            <form action="/api/viewpoints/create" method="post" className="form-grid">
              <input type="hidden" name="workspaceId" value={workspace.id} />
              <label>
                Name
                <input name="name" required />
              </label>
              <label>
                Type
                <select name="type">
                  {VIEWPOINT_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Linked Entity ID (optional)
                <input name="entityId" />
              </label>
              <label>
                Description
                <textarea name="description" rows={3} />
              </label>
              <button type="submit">Add viewpoint</button>
            </form>
          </section>

          <section className="panel">
            <h3>Asset upload</h3>
            <form action="/api/assets/upload" method="post" encType="multipart/form-data" className="form-grid">
              <input type="hidden" name="workspaceId" value={workspace.id} />
              <label>
                File
                <input type="file" name="file" required />
              </label>
              <label>
                Source URL
                <input name="sourceUrl" />
              </label>
              <label>
                Author
                <input name="author" />
              </label>
              <label>
                License ID
                <input name="licenseId" />
              </label>
              <label>
                License URL
                <input name="licenseUrl" />
              </label>
              <label>
                Attribution text
                <input name="attributionText" />
              </label>
              <button type="submit">Upload</button>
            </form>
          </section>

          <section className="panel">
            <h3>PDF Export</h3>
            <form action="/api/pdf/export" method="post" className="form-grid">
              <input type="hidden" name="workspaceId" value={workspace.id} />
              <label>
                HTML to render
                <textarea name="html" rows={6} defaultValue={`<html><body><h1>WorldLore Atlas</h1><p>PDF export test</p></body></html>`} />
              </label>
              <label>
                Include credits
                <select name="includeCredits">
                  <option value="false">No</option>
                  <option value="true">Yes</option>
                </select>
              </label>
              <button type="submit">Generate PDF</button>
            </form>
          </section>

          <section className="panel">
            <h3>LLM Configuration</h3>
            <p className="muted">Set GEMINI_API_KEY / GEMINI_MODEL or CODEX_EXEC_ALLOWLIST in environment.</p>
          </section>
        </>
      )}
    </div>
  );
}
