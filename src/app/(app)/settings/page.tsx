import { requireUser } from "@/auth";
import { getActiveWorkspace } from "@/lib/workspaces";
import { prisma } from "@/lib/db";
import { LlmContext } from "@/components/LlmContext";
import Link from "next/link";

const VIEWPOINT_TYPES = ["player", "faction", "character", "omniscient"];

type SearchParams = { [key: string]: string | string[] | undefined };

type SettingsPageProps = { searchParams: Promise<SearchParams> };

export default async function SettingsPage({ searchParams }: SettingsPageProps) {
  const user = await requireUser();
  const workspace = await getActiveWorkspace(user.id);
  const resolvedSearchParams = await searchParams;
  const tab = typeof resolvedSearchParams.tab === "string" ? resolvedSearchParams.tab : "viewpoints";

  const [viewpoints, assets] = workspace
    ? await Promise.all([
        prisma.viewpoint.findMany({
          where: { workspaceId: workspace.id, softDeletedAt: null },
          orderBy: { createdAt: "asc" }
        }),
        prisma.asset.findMany({
          where: { workspaceId: workspace.id, softDeletedAt: null },
          orderBy: { createdAt: "desc" }
        })
      ])
    : [[], []];

  if (!workspace) return <div className="panel">Select a workspace.</div>;

  const tabs = [
    { id: "viewpoints", label: "Viewpoints", icon: "V" },
    { id: "assets", label: "Assets & Uploads", icon: "A" },
    { id: "pdf", label: "PDF & Export", icon: "P" },
    { id: "llm", label: "LLM Configuration", icon: "L" },
    { id: "danger", label: "Danger Zone", icon: "!" }
  ];

  return (
    <div className="layout-2-pane-sidebar">
      <LlmContext value={{ type: "settings", workspaceId: workspace.id }} />

      <aside className="pane-sidebar">
        <div className="pane-header">
          <h3>Settings</h3>
        </div>
        <nav className="vertical-tabs">
          {tabs.map((t) => (
            <Link key={t.id} href={`?tab=${t.id}`} className={`tab-link-v ${tab === t.id ? "active" : ""}`}>
              <span className="tab-icon">{t.icon}</span>
              {t.label}
            </Link>
          ))}
        </nav>
      </aside>

      <main className="pane-main-content">
        <div className="pane-header">
          <h2>{tabs.find((t) => t.id === tab)?.label}</h2>
        </div>
        <div className="settings-content p-6">
          {tab === "viewpoints" && (
            <div className="settings-section-grid">
              <section className="settings-card">
                <h4>New Viewpoint</h4>
                <form action="/api/viewpoints/create" method="post" className="form-grid">
                  <input type="hidden" name="workspaceId" value={workspace.id} />
                  <label>
                    Name <input name="name" required />
                  </label>
                  <label>
                    Type
                    <select name="type">
                      {VIEWPOINT_TYPES.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Description <textarea name="description" rows={2} />
                  </label>
                  <button type="submit" className="btn-primary">Add Viewpoint</button>
                </form>
              </section>
              <section className="settings-card">
                <h4>Active Viewpoints</h4>
                <div className="list-sm">
                  {viewpoints.map((v) => (
                    <div key={v.id} className="list-row-sm">
                      <span>{v.name}</span>
                      <form action="/api/archive" method="post">
                        <input type="hidden" name="workspaceId" value={workspace.id} />
                        <input type="hidden" name="targetType" value="viewpoint" />
                        <input type="hidden" name="targetId" value={v.id} />
                        <button type="submit" className="link-button">Archive</button>
                      </form>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          )}

          {tab === "assets" && (
            <div className="settings-section-grid">
              <section className="settings-card">
                <h4>Upload New Asset</h4>
                <form action="/api/assets/upload" method="post" encType="multipart/form-data" className="form-grid">
                  <input type="hidden" name="workspaceId" value={workspace.id} />
                  <input type="file" name="file" required className="file-input" />
                  <label>
                    Author <input name="author" />
                  </label>
                  <label>
                    Attribution <input name="attributionText" />
                  </label>
                  <button type="submit" className="btn-primary">Upload File</button>
                </form>
              </section>
              <section className="settings-card">
                <h4>Manage Assets</h4>
                <div className="list-sm">
                  {assets.map((a) => (
                    <div key={a.id} className="list-row-sm">
                      <span className="truncate">{a.storageKey}</span>
                      <form action="/api/archive" method="post">
                        <input type="hidden" name="workspaceId" value={workspace.id} />
                        <input type="hidden" name="targetType" value="asset" />
                        <input type="hidden" name="targetId" value={a.id} />
                        <button type="submit" className="link-button">Archive</button>
                      </form>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          )}

          {tab === "pdf" && (
            <div className="settings-section-grid">
              <section className="settings-card full-width">
                <h4>Print Set Builder</h4>
                <p className="muted mb-4">Select the entities and maps you want to bundle into a PDF document.</p>
                <form action="/api/pdf/build" method="post" className="form-grid max-w-md">
                  <input type="hidden" name="workspaceId" value={workspace.id} />
                  <label>
                    Entity IDs (comma) <input name="entityIds" placeholder="id1, id2..." />
                  </label>
                  <label>
                    Map IDs (comma) <input name="mapIds" />
                  </label>
                  <label>
                    Include Credits
                    <select name="includeCredits">
                      <option value="true">Yes</option>
                      <option value="false">No</option>
                    </select>
                  </label>
                  <button type="submit" className="btn-primary">Generate Bundle PDF</button>
                </form>
              </section>
            </div>
          )}

          {tab === "llm" && (
            <div className="settings-card">
              <h4>LLM Service Status</h4>
              <p className="muted mb-4">Configuration is managed via server environment variables.</p>
              <div className="status-grid">
                <div className="status-item">
                  <span className="status-dot green"></span> Gemini AI (Enabled)
                </div>
                <div className="status-item">
                  <span className="status-dot"></span> Vertex AI (Disabled)
                </div>
                <div className="status-item">
                  <span className="status-dot green"></span> Codex CLI (Enabled)
                </div>
              </div>
            </div>
          )}

          {tab === "danger" && (
            <div className="settings-card danger-card">
              <h4>Delete Workspace</h4>
              <p>This action is irreversible. All articles, maps, and history will be lost.</p>
              <button className="btn-danger-outline mt-4">Destroy Workspace</button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
