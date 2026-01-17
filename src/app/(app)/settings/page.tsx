import { requireUser } from "@/lib/auth";
import { getActiveWorkspace } from "@/lib/workspaces";
import { prisma } from "@/lib/prisma";
import { LlmContext } from "@/components/LlmContext";
import Link from "next/link";
import { cn } from "@/lib/utils";

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

  if (!workspace) return <div className="p-8 text-center text-muted">Select a workspace.</div>;

  const tabs = [
    { 
      id: "viewpoints", 
      label: "Viewpoints", 
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
          <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      )
    },
    { 
      id: "assets", 
      label: "Assets & Uploads", 
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
          <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
          <circle cx="9" cy="9" r="2" />
          <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
        </svg>
      )
    },
    { 
      id: "pdf", 
      label: "PDF & Export", 
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
          <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
          <polyline points="14 2 14 8 20 8" />
        </svg>
      )
    },
    { 
      id: "llm", 
      label: "AI Configuration", 
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
          <path d="M12 2a2 2 0 0 1 2 2c0 .74.4 1.39 1 1.73 1.6.9 2.45 2.76 2.08 4.67-.3 1.54-1.64 2.7-3.2 2.7-1.55 0-2.89-1.16-3.19-2.7C10.29 6.49 11.14 4.63 12.74 3.73c.6-.34 1-.99 1-1.73a2 2 0 0 1 2-2" />
          <path d="M8.5 14.5A2.5 2.5 0 0 0 11 17c1.38 0 2.5-1.12 2.5-2.5" />
        </svg>
      )
    },
    { 
      id: "danger", 
      label: "Danger Zone", 
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
          <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      )
    }
  ];

  return (
    <div className="grid grid-cols-[240px_1fr] h-full overflow-hidden bg-bg">
      <LlmContext value={{ type: "settings", workspaceId: workspace.id }} />

      <aside className="border-r border-border bg-panel flex flex-col">
        <div className="p-6 border-b border-border">
          <h3 className="text-sm font-bold uppercase tracking-widest text-muted">Settings</h3>
        </div>
        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          {tabs.map((t) => (
            <Link 
              key={t.id} 
              href={`?tab=${t.id}`} 
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
                tab === t.id 
                  ? "bg-accent/10 text-accent" 
                  : "text-muted hover:bg-bg hover:text-ink"
              )}
            >
              {t.icon}
              {t.label}
            </Link>
          ))}
        </nav>
      </aside>

      <main className="flex flex-col h-full overflow-hidden">
        <div className="p-6 border-b border-border bg-panel/50 backdrop-blur-sm sticky top-0 z-10">
          <h2 className="text-xl font-bold text-ink tracking-tight">{tabs.find((t) => t.id === tab)?.label}</h2>
        </div>
        <div className="flex-1 overflow-y-auto p-8 max-w-4xl space-y-8">
          {tab === "viewpoints" && (
            <div className="space-y-8">
              <section className="bg-panel border border-border rounded-xl p-6 shadow-sm">
                <h4 className="text-sm font-bold uppercase tracking-widest text-muted mb-4">New Viewpoint</h4>
                <form action="/api/viewpoints/create" method="post" className="space-y-4">
                  <input type="hidden" name="workspaceId" value={workspace.id} />
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold uppercase text-muted">Name</label>
                      <input name="name" required className="w-full px-3 py-2 bg-bg border border-border rounded-lg outline-none focus:ring-2 focus:ring-accent" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold uppercase text-muted">Type</label>
                      <select name="type" className="w-full px-3 py-2 bg-bg border border-border rounded-lg outline-none focus:ring-2 focus:ring-accent capitalize">
                        {VIEWPOINT_TYPES.map((t) => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase text-muted">Description</label>
                    <textarea name="description" rows={2} className="w-full px-3 py-2 bg-bg border border-border rounded-lg outline-none focus:ring-2 focus:ring-accent" />
                  </div>
                  <div className="pt-2">
                    <button type="submit" className="px-4 py-2 bg-accent text-white font-bold rounded-lg hover:bg-accent-hover transition-colors">Add Viewpoint</button>
                  </div>
                </form>
              </section>
              <section className="bg-panel border border-border rounded-xl p-6 shadow-sm">
                <h4 className="text-sm font-bold uppercase tracking-widest text-muted mb-4">Active Viewpoints</h4>
                <div className="space-y-2">
                  {viewpoints.map((v) => (
                    <div key={v.id} className="flex items-center justify-between p-3 bg-bg rounded-lg border border-border">
                      <div className="flex items-center gap-3">
                        <span className="w-2 h-2 rounded-full bg-accent"></span>
                        <span className="font-medium text-sm">{v.name}</span>
                        <span className="text-xs text-muted uppercase border border-border px-1.5 rounded">{v.type}</span>
                      </div>
                      <form action="/api/archive" method="post">
                        <input type="hidden" name="workspaceId" value={workspace.id} />
                        <input type="hidden" name="targetType" value="viewpoint" />
                        <input type="hidden" name="targetId" value={v.id} />
                        <button type="submit" className="text-xs text-muted hover:text-red-500 transition-colors">Archive</button>
                      </form>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          )}

          {tab === "assets" && (
            <div className="space-y-8">
              <section className="bg-panel border border-border rounded-xl p-6 shadow-sm">
                <h4 className="text-sm font-bold uppercase tracking-widest text-muted mb-4">Upload New Asset</h4>
                <form action="/api/assets/upload" method="post" encType="multipart/form-data" className="space-y-4">
                  <input type="hidden" name="workspaceId" value={workspace.id} />
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase text-muted">File</label>
                    <input type="file" name="file" required className="block w-full text-sm text-muted file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-accent/10 file:text-accent hover:file:bg-accent/20 cursor-pointer" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold uppercase text-muted">Author</label>
                      <input name="author" className="w-full px-3 py-2 bg-bg border border-border rounded-lg outline-none focus:ring-2 focus:ring-accent" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold uppercase text-muted">Attribution</label>
                      <input name="attributionText" className="w-full px-3 py-2 bg-bg border border-border rounded-lg outline-none focus:ring-2 focus:ring-accent" />
                    </div>
                  </div>
                  <div className="pt-2">
                    <button type="submit" className="px-4 py-2 bg-accent text-white font-bold rounded-lg hover:bg-accent-hover transition-colors">Upload File</button>
                  </div>
                </form>
              </section>
              <section className="bg-panel border border-border rounded-xl p-6 shadow-sm">
                <h4 className="text-sm font-bold uppercase tracking-widest text-muted mb-4">Manage Assets</h4>
                <div className="space-y-2">
                  {assets.map((a) => (
                    <div key={a.id} className="flex items-center justify-between p-3 bg-bg rounded-lg border border-border">
                      <span className="truncate text-sm font-mono">{a.storageKey}</span>
                      <form action="/api/archive" method="post">
                        <input type="hidden" name="workspaceId" value={workspace.id} />
                        <input type="hidden" name="targetType" value="asset" />
                        <input type="hidden" name="targetId" value={a.id} />
                        <button type="submit" className="text-xs text-muted hover:text-red-500 transition-colors">Archive</button>
                      </form>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          )}

          {tab === "pdf" && (
            <div className="space-y-8">
              <section className="bg-panel border border-border rounded-xl p-6 shadow-sm">
                <h4 className="text-sm font-bold uppercase tracking-widest text-muted mb-4">Print Set Builder</h4>
                <p className="text-sm text-muted mb-6">Select the entities and maps you want to bundle into a PDF document.</p>
                <form action="/api/pdf/build" method="post" className="max-w-md space-y-4">
                  <input type="hidden" name="workspaceId" value={workspace.id} />
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase text-muted">Entity IDs (comma)</label>
                    <input name="entityIds" placeholder="id1, id2..." className="w-full px-3 py-2 bg-bg border border-border rounded-lg outline-none focus:ring-2 focus:ring-accent font-mono text-xs" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase text-muted">Map IDs (comma)</label>
                    <input name="mapIds" className="w-full px-3 py-2 bg-bg border border-border rounded-lg outline-none focus:ring-2 focus:ring-accent font-mono text-xs" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase text-muted">Include Credits</label>
                    <select name="includeCredits" className="w-full px-3 py-2 bg-bg border border-border rounded-lg outline-none focus:ring-2 focus:ring-accent">
                      <option value="true">Yes</option>
                      <option value="false">No</option>
                    </select>
                  </div>
                  <div className="pt-2">
                    <button type="submit" className="px-4 py-2 bg-accent text-white font-bold rounded-lg hover:bg-accent-hover transition-colors">Generate Bundle PDF</button>
                  </div>
                </form>
              </section>
            </div>
          )}

          {tab === "llm" && (
            <div className="bg-panel border border-border rounded-xl p-6 shadow-sm">
              <h4 className="text-sm font-bold uppercase tracking-widest text-muted mb-4">LLM Service Status</h4>
              <p className="text-sm text-muted mb-6">Configuration is managed via server environment variables.</p>
              <div className="grid gap-3">
                <div className="flex items-center gap-3 p-3 bg-bg rounded-lg border border-border">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></span>
                  <span className="font-medium text-sm">Gemini AI (Enabled)</span>
                </div>
                <div className="flex items-center gap-3 p-3 bg-bg rounded-lg border border-border opacity-60">
                  <span className="w-2.5 h-2.5 rounded-full bg-slate-400"></span>
                  <span className="font-medium text-sm">Vertex AI (Disabled)</span>
                </div>
                <div className="flex items-center gap-3 p-3 bg-bg rounded-lg border border-border">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></span>
                  <span className="font-medium text-sm">Codex CLI (Enabled)</span>
                </div>
              </div>
            </div>
          )}

          {tab === "danger" && (
            <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 rounded-xl p-6 shadow-sm">
              <h4 className="text-sm font-bold uppercase tracking-widest text-red-600 dark:text-red-400 mb-4">Delete Workspace</h4>
              <p className="text-sm text-red-700 dark:text-red-300 mb-6">This action is irreversible. All articles, maps, and history will be lost.</p>
              <button className="px-4 py-2 border border-red-500 text-red-600 dark:text-red-400 font-bold rounded-lg hover:bg-red-500 hover:text-white transition-colors">Destroy Workspace</button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
