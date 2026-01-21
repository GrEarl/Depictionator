import { requireUser } from "@/lib/auth";
import { getActiveWorkspace } from "@/lib/workspaces";
import { prisma } from "@/lib/prisma";
import { LlmContext } from "@/components/LlmContext";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { CopyButton } from "@/components/CopyButton";

const VIEWPOINT_TYPES = ["player", "faction", "character", "omniscient"];

type SearchParams = { [key: string]: string | string[] | undefined };

type SettingsPageProps = { searchParams: Promise<SearchParams> };

export default async function SettingsPage({ searchParams }: SettingsPageProps) {
  const user = await requireUser();
  const workspace = await getActiveWorkspace(user.id);
  const resolvedSearchParams = await searchParams;
  const tab = typeof resolvedSearchParams.tab === "string" ? resolvedSearchParams.tab : "members";
  const rawNotice = typeof resolvedSearchParams.notice === "string" ? resolvedSearchParams.notice : null;
  const rawError = typeof resolvedSearchParams.error === "string" ? resolvedSearchParams.error : null;
  const noticeText =
    rawNotice === "member-added"
      ? "Member added successfully."
      : rawNotice === "member-updated"
      ? "Member role updated."
      : null;
  const errorText =
    rawError === "invalid-email"
      ? "Enter a valid email address."
      : rawError === "user-not-found"
      ? "User not found. Ask them to sign up or use the invite link."
      : rawError === "not-authorized"
      ? "Admin role required to add members."
      : rawError === "invalid-request"
      ? "Invalid request."
      : rawError === "invalid-role"
      ? "Invalid role selection."
      : rawError === "member-not-found"
      ? "Member not found."
      : rawError === "cannot-change-owner"
      ? "Owner role cannot be changed."
      : rawError === "workspace-not-found"
      ? "Workspace not found."
      : null;

  const [viewpoints, assets, members] = workspace
    ? await Promise.all([
        prisma.viewpoint.findMany({
          where: { workspaceId: workspace.id, softDeletedAt: null },
          orderBy: { createdAt: "asc" },
          include: { entity: { select: { id: true, title: true } } }
        }),
        prisma.asset.findMany({
          where: { workspaceId: workspace.id, softDeletedAt: null },
          orderBy: { createdAt: "desc" }
        }),
        prisma.workspaceMember.findMany({
          where: { workspaceId: workspace.id },
          include: { user: { select: { id: true, name: true, email: true } } },
          orderBy: { createdAt: "asc" }
        })
      ])
    : [[], [], []];

  if (!workspace) return <div className="p-8 text-center text-muted">Select a workspace.</div>;

  const tabs = [
    {
      id: "members",
      label: "Team & Access",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      )
    },
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
          {tab === "members" && (
            <div className="space-y-8">
              {(noticeText || errorText) && (
                <div
                  className={cn(
                    "rounded-xl border px-4 py-3 text-sm font-semibold",
                    noticeText
                      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                      : "bg-red-500/10 text-red-400 border-red-500/30"
                  )}
                >
                  {noticeText || errorText}
                </div>
              )}
              <section className="bg-panel border border-border rounded-xl p-6 shadow-sm">
                <h4 className="text-sm font-bold uppercase tracking-widest text-muted mb-4">Invite Link</h4>
                <p className="text-sm text-muted mb-4">Share this link to invite collaborators to your workspace. New members will join with viewer permissions.</p>
                <div className="flex gap-3">
                  <input
                    type="text"
                    readOnly
                    defaultValue={`https://internal.copiqta.com/join/${workspace.slug}`}
                    className="flex-1 px-3 py-2 bg-bg border border-border rounded-lg outline-none font-mono text-xs select-all"
                  />
                  <CopyButton
                    text={`https://internal.copiqta.com/join/${workspace.slug}`}
                    label="Copy Link"
                  />
                </div>
              </section>

              <section className="bg-panel border border-border rounded-xl p-6 shadow-sm">
                <h4 className="text-sm font-bold uppercase tracking-widest text-muted mb-4">Add Member by Email</h4>
                <p className="text-sm text-muted mb-4">Add an existing user directly. If they do not have an account, share the invite link above.</p>
                <form action="/api/workspaces/members/add" method="post" className="space-y-4">
                  <input type="hidden" name="workspaceId" value={workspace.id} />
                  <div className="grid gap-3 sm:grid-cols-[1fr_160px]">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold uppercase tracking-widest text-muted">User Email</label>
                      <input
                        type="email"
                        name="email"
                        required
                        placeholder="member@example.com"
                        className="w-full px-3 py-2 bg-bg border border-border rounded-lg outline-none focus:ring-2 focus:ring-accent text-sm"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold uppercase tracking-widest text-muted">Role</label>
                      <select
                        name="role"
                        defaultValue="viewer"
                        className="w-full px-3 py-2 bg-bg border border-border rounded-lg outline-none focus:ring-2 focus:ring-accent text-sm"
                      >
                        <option value="viewer">Viewer</option>
                        <option value="editor">Editor</option>
                        <option value="reviewer">Reviewer</option>
                        <option value="admin">Admin</option>
                      </select>
                    </div>
                  </div>
                  <button type="submit" className="px-4 py-2 bg-accent text-white font-bold rounded-lg hover:bg-accent-hover transition-colors">
                    Add Member
                  </button>
                </form>
              </section>

              <section className="bg-panel border border-border rounded-xl p-6 shadow-sm">
                <h4 className="text-sm font-bold uppercase tracking-widest text-muted mb-4">Team Members ({members.length})</h4>
                <div className="space-y-2">
                  {members.map((member) => {
                    const isOwner = member.userId === workspace.createdById;
                    return (
                      <div key={member.id} className="flex items-center justify-between p-3 bg-bg rounded-lg border border-border">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-gradient-accent flex items-center justify-center text-white font-black text-sm">
                            {member.user.name?.[0]?.toUpperCase() || member.user.email[0].toUpperCase()}
                          </div>
                          <div>
                            <div className="font-medium text-sm">{member.user.name || member.user.email}</div>
                            {member.user.name && <div className="text-xs text-muted">{member.user.email}</div>}
                          </div>
                          {isOwner ? (
                            <span className="text-xs uppercase border px-2 py-0.5 rounded border-accent text-accent">
                              Owner
                            </span>
                          ) : (
                            <span className={`text-xs uppercase border px-2 py-0.5 rounded ${
                              member.role === 'admin' ? 'border-accent-secondary text-accent-secondary' :
                              'border-border text-muted'
                            }`}>
                              {member.role}
                            </span>
                          )}
                        </div>
                        {!isOwner && member.userId !== user.id && (
                          <form action="/api/workspaces/members/update-role" method="post" className="flex items-center gap-2">
                            <input type="hidden" name="workspaceId" value={workspace.id} />
                            <input type="hidden" name="memberId" value={member.id} />
                            <select
                              name="role"
                              defaultValue={member.role}
                              className="px-2 py-1 bg-bg border border-border rounded text-xs"
                            >
                              <option value="viewer">Viewer</option>
                              <option value="editor">Editor</option>
                              <option value="reviewer">Reviewer</option>
                              <option value="admin">Admin</option>
                            </select>
                            <button type="submit" className="px-2 py-1 text-xs border border-border rounded hover:bg-bg">
                              Update
                            </button>
                          </form>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            </div>
          )}

          {tab === "viewpoints" && (
            <div className="space-y-8">
              <section className="bg-panel border border-border rounded-xl p-6 shadow-sm">
                <h4 className="text-sm font-bold uppercase tracking-widest text-muted mb-4">New Viewpoint</h4>
                <form action="/api/viewpoints/create" method="post" className="space-y-4">
                  <input type="hidden" name="workspaceId" value={workspace.id} />
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold uppercase text-muted">Name</label>
                      <input name="name" required placeholder="e.g., Player Character" className="w-full px-3 py-2 bg-bg border border-border rounded-lg outline-none focus:ring-2 focus:ring-accent" />
                      <span className="text-xs text-muted">Unique name for this perspective</span>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold uppercase text-muted">Type</label>
                      <select name="type" className="w-full px-3 py-2 bg-bg border border-border rounded-lg outline-none focus:ring-2 focus:ring-accent capitalize">
                        {VIEWPOINT_TYPES.map((t) => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                      </select>
                      <span className="text-xs text-muted">Category of perspective</span>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase text-muted">Description</label>
                    <textarea name="description" rows={2} placeholder="What information is known/unknown from this viewpoint?" className="w-full px-3 py-2 bg-bg border border-border rounded-lg outline-none focus:ring-2 focus:ring-accent" />
                    <span className="text-xs text-muted">Optional notes about this perspective's knowledge</span>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase text-muted">Linked Entity (optional)</label>
                    <input
                      name="entityQuery"
                      placeholder="Type entity title or alias"
                      className="w-full px-3 py-2 bg-bg border border-border rounded-lg outline-none focus:ring-2 focus:ring-accent"
                    />
                    <span className="text-xs text-muted">Leave blank if not linked to a specific entity.</span>
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
                        <div>
                          <div className="font-medium text-sm">{v.name}</div>
                          {v.description && <div className="text-xs text-muted">{v.description}</div>}
                          {v.entity && (
                            <div className="text-[10px] text-muted uppercase tracking-widest">
                              Linked: {v.entity.title}
                            </div>
                          )}
                        </div>
                        <span className="text-xs text-muted uppercase border border-border px-1.5 rounded">{v.type}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <details className="action-details">
                          <summary>Manage</summary>
                          <form action="/api/viewpoints/update" method="post" className="form-grid p-4">
                            <input type="hidden" name="workspaceId" value={workspace.id} />
                            <input type="hidden" name="viewpointId" value={v.id} />
                            <label>
                              Name
                              <input name="name" defaultValue={v.name} />
                            </label>
                            <label>
                              Type
                              <select name="type" defaultValue={v.type} className="capitalize">
                                {VIEWPOINT_TYPES.map((t) => (
                                  <option key={t} value={t}>{t}</option>
                                ))}
                              </select>
                            </label>
                            <label>
                              Description
                              <textarea name="description" rows={2} defaultValue={v.description || ""} />
                            </label>
                            <label>
                              Linked Entity (optional)
                              <input
                                name="entityQuery"
                                defaultValue={v.entity?.title ?? ""}
                                placeholder="Type entity title or alias"
                              />
                              <span className="text-xs text-muted">Leave blank to clear link.</span>
                            </label>
                            <button type="submit" className="btn-secondary">Update</button>
                          </form>
                        </details>
                        <form action="/api/archive" method="post">
                          <input type="hidden" name="workspaceId" value={workspace.id} />
                          <input type="hidden" name="targetType" value="viewpoint" />
                          <input type="hidden" name="targetId" value={v.id} />
                          <button type="submit" className="text-xs text-muted hover:text-red-500 transition-colors">Archive</button>
                        </form>
                      </div>
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
                    <span className="text-xs text-muted">Images, PDFs, or reference documents</span>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold uppercase text-muted">Author</label>
                      <input name="author" placeholder="e.g., Your Name" className="w-full px-3 py-2 bg-bg border border-border rounded-lg outline-none focus:ring-2 focus:ring-accent" />
                      <span className="text-xs text-muted">Optional: Creator name</span>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold uppercase text-muted">Attribution</label>
                      <input name="attributionText" placeholder="e.g., CC-BY 4.0" className="w-full px-3 py-2 bg-bg border border-border rounded-lg outline-none focus:ring-2 focus:ring-accent" />
                      <span className="text-xs text-muted">Optional: License info</span>
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
                <p className="text-sm text-muted mb-6">Select the entities and maps you want to bundle into a PDF document for printing or sharing.</p>
                <form action="/api/pdf/build" method="post" className="max-w-md space-y-4">
                  <input type="hidden" name="workspaceId" value={workspace.id} />
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase text-muted">Entities (comma-separated)</label>
                    <input
                      name="entityQuery"
                      placeholder="e.g., Alice, Northern Empire, Dragon War"
                      className="w-full px-3 py-2 bg-bg border border-border rounded-lg outline-none focus:ring-2 focus:ring-accent text-xs"
                    />
                    <span className="text-xs text-muted">Search by title or alias (no IDs needed).</span>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase text-muted">Maps (comma-separated)</label>
                    <input
                      name="mapQuery"
                      placeholder="e.g., World Map, Capital District"
                      className="w-full px-3 py-2 bg-bg border border-border rounded-lg outline-none focus:ring-2 focus:ring-accent text-xs"
                    />
                    <span className="text-xs text-muted">Optional: Include map snapshots by name.</span>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase text-muted">Include Credits</label>
                    <select name="includeCredits" className="w-full px-3 py-2 bg-bg border border-border rounded-lg outline-none focus:ring-2 focus:ring-accent">
                      <option value="true">Yes (Recommended)</option>
                      <option value="false">No</option>
                    </select>
                    <span className="text-xs text-muted">Append attribution page for external sources</span>
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
