import { requireUser } from "@/lib/auth";
import { getActiveWorkspace } from "@/lib/workspaces";
import { prisma } from "@/lib/db";

const VIEWPOINT_TYPES = ["player", "faction", "character", "omniscient"];

export default async function SettingsPage() {
  const user = await requireUser();
  const workspace = await getActiveWorkspace(user.id);
  const viewpoints = workspace
    ? await prisma.viewpoint.findMany({
        where: { workspaceId: workspace.id, softDeletedAt: null },
        orderBy: { createdAt: "asc" }
      })
    : [];
  const archivedViewpoints = workspace
    ? await prisma.viewpoint.findMany({
        where: { workspaceId: workspace.id, softDeletedAt: { not: null } },
        orderBy: { createdAt: "asc" }
      })
    : [];
  const assets = workspace
    ? await prisma.asset.findMany({
        where: { workspaceId: workspace.id, softDeletedAt: null },
        orderBy: { createdAt: "desc" }
      })
    : [];
  const archivedAssets = workspace
    ? await prisma.asset.findMany({
        where: { workspaceId: workspace.id, softDeletedAt: { not: null } },
        orderBy: { createdAt: "desc" }
      })
    : [];

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
            <ul>
              {viewpoints.map((viewpoint) => (
                <li key={viewpoint.id} className="list-row">
                  <span>{viewpoint.name}</span>
                  <form action="/api/archive" method="post">
                    <input type="hidden" name="workspaceId" value={workspace.id} />
                    <input type="hidden" name="targetType" value="viewpoint" />
                    <input type="hidden" name="targetId" value={viewpoint.id} />
                    <button type="submit" className="link-button">Archive</button>
                  </form>
                </li>
              ))}
              {viewpoints.length === 0 && <li className="muted">No viewpoints.</li>}
            </ul>
            <h4>Archived viewpoints</h4>
            <ul>
              {archivedViewpoints.map((viewpoint) => (
                <li key={viewpoint.id} className="list-row">
                  <span>{viewpoint.name}</span>
                  <form action="/api/restore" method="post">
                    <input type="hidden" name="workspaceId" value={workspace.id} />
                    <input type="hidden" name="targetType" value="viewpoint" />
                    <input type="hidden" name="targetId" value={viewpoint.id} />
                    <button type="submit" className="link-button">Restore</button>
                  </form>
                </li>
              ))}
              {archivedViewpoints.length === 0 && <li className="muted">No archived viewpoints.</li>}
            </ul>
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
            <h3>Assets</h3>
            <ul>
              {assets.map((asset) => (
                <li key={asset.id} className="list-row">
                  <div>
                    {asset.storageKey} ÅE {Math.round(asset.size / 1024)} KB
                  </div>
                  <form action="/api/archive" method="post">
                    <input type="hidden" name="workspaceId" value={workspace.id} />
                    <input type="hidden" name="targetType" value="asset" />
                    <input type="hidden" name="targetId" value={asset.id} />
                    <button type="submit" className="link-button">Archive</button>
                  </form>
                </li>
              ))}
              {assets.length === 0 && <li className="muted">No assets uploaded.</li>}
            </ul>
            <h4>Archived assets</h4>
            <ul>
              {archivedAssets.map((asset) => (
                <li key={asset.id} className="list-row">
                  <div>{asset.storageKey}</div>
                  <form action="/api/restore" method="post">
                    <input type="hidden" name="workspaceId" value={workspace.id} />
                    <input type="hidden" name="targetType" value="asset" />
                    <input type="hidden" name="targetId" value={asset.id} />
                    <button type="submit" className="link-button">Restore</button>
                  </form>
                </li>
              ))}
              {archivedAssets.length === 0 && <li className="muted">No archived assets.</li>}
            </ul>
          </section>

          <section className="panel">
            <h3>PDF Export</h3>
            <form action="/api/pdf/export" method="post" className="form-grid">
              <input type="hidden" name="workspaceId" value={workspace.id} />
              <label>
                HTML to render
                <textarea name="html" rows={6} defaultValue={`<html><body><h1>Depictionator</h1><p>PDF export test</p></body></html>`} />
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
            <h3>Print set builder</h3>
            <form action="/api/pdf/build" method="post" className="form-grid">
              <input type="hidden" name="workspaceId" value={workspace.id} />
              <label>
                Entity IDs (comma)
                <input name="entityIds" />
              </label>
              <label>
                Map IDs (comma)
                <input name="mapIds" />
              </label>
              <label>
                Timeline IDs (comma)
                <input name="timelineIds" />
              </label>
              <label>
                Include credits
                <select name="includeCredits">
                  <option value="false">No</option>
                  <option value="true">Yes</option>
                </select>
              </label>
              <button type="submit">Generate Print Set PDF</button>
            </form>
          </section>

          <section className="panel">
            <h3>LLM Configuration</h3>
            <p className="muted">
              Configure LLM providers via env: LLM_PROVIDERS_ENABLED, LLM_DEFAULT_PROVIDER, GEMINI_API_KEY /
              GEMINI_MODEL, VERTEX_GEMINI_API_KEY / VERTEX_GEMINI_PROJECT / VERTEX_GEMINI_LOCATION /
              VERTEX_GEMINI_MODEL, and CODEX_CLI_PATH. The panel allows per-request API keys and Codex auth base64.
            </p>
          </section>
        </>
      )}
    </div>
  );
}

