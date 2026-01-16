"use client";

import { useState } from "react";
import { MarkdownView } from "@/components/MarkdownView";
import { MarkdownToc } from "@/components/MarkdownToc";
import { MarkdownEditor } from "@/components/MarkdownEditor";
import Link from "next/link";
import { useGlobalFilters } from "@/components/GlobalFilterProvider";

type Entity = any;

export function ArticleDetail({ 
  entity, 
  workspaceId, 
  user 
}: { 
  entity: Entity; 
  workspaceId: string;
  user: any;
}) {
  const [tab, setTab] = useState<"read" | "edit" | "history" | "compare">("read");
  const { mode, viewpointId, eraId, chapterId } = useGlobalFilters();

  // 1. Determine Context (Base vs Overlay)
  const isCanonMode = mode === "canon" || viewpointId === "canon";
  const overlayCandidates = (entity.overlays ?? []).filter((overlay: any) => {
    if (eraId !== "all") {
      const matchesEra =
        overlay.worldFrom === eraId ||
        overlay.worldTo === eraId ||
        (!overlay.worldFrom && !overlay.worldTo);
      if (!matchesEra) return false;
    }
    if (chapterId !== "all") {
      const matchesChapter =
        overlay.storyFromChapterId === chapterId ||
        overlay.storyToChapterId === chapterId ||
        (!overlay.storyFromChapterId && !overlay.storyToChapterId);
      if (!matchesChapter) return false;
    }
    return true;
  });
  
  const activeOverlay = !isCanonMode && viewpointId !== "canon"
    ? overlayCandidates.find((o: any) => o.viewpointId === viewpointId) ?? null
    : null;

  // 2. Resolve Revisions & Content
  const baseRevisions = entity.article?.revisions || [];
  const overlayRevisions = activeOverlay?.revisions || [];
  const relevantRevisions = activeOverlay ? overlayRevisions : baseRevisions;

  // Logic: Prefer active/base revision (published state), fallback to latest revision (draft/head).
  const publishedRevision = activeOverlay ? activeOverlay.activeRevision : entity.article?.baseRevision;
  const latestRevision = relevantRevisions[0]; // Assumes desc sort by date
  
  const currentRevision = publishedRevision || latestRevision;
  const displayBody = currentRevision?.bodyMd || "";
  const displayTitle = activeOverlay ? activeOverlay.title : entity.title;

  // For Compare Tab: Previous Revision
  // Find the revision *after* the current one in the sorted list (which means it's older)
  const currentIndex = relevantRevisions.findIndex((r: any) => r.id === currentRevision?.id);
  // If current is not found (e.g. unsaved state?), default to 0. If found, next is +1.
  const compareIndex = currentIndex === -1 ? 1 : currentIndex + 1;
  const previousRevision = relevantRevisions[compareIndex] || null;

  // Edit Targets
  const targetType = activeOverlay ? "overlay" : "base";
  const targetId = activeOverlay ? activeOverlay.id : entity.id;

  return (
    <div className="article-container">
      <div className="article-header">
        <div className="article-title-row">
          <h1>{displayTitle}</h1>
          <div className="article-badges">
            <span className={`badge type-${entity.type.toLowerCase()}`}>{entity.type}</span>
            <span className={`badge status-${entity.status}`}>{entity.status}</span>
            {activeOverlay && <span className="badge overlay">Viewpoint: {viewpointId}</span>}
            {!publishedRevision && latestRevision && <span className="badge status-draft">Draft</span>}
          </div>
        </div>
        <div className="article-tabs">
          {["read", "edit", "history", "compare"].map((t) => (
            <button 
              key={t}
              className={`tab-btn ${tab === t ? "active" : ""}`}
              onClick={() => setTab(t as any)}
            >
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="article-layout-grid">
        <main className="article-content">
          {tab === "read" && (
            <div className="read-view">
              {displayBody ? (
                <MarkdownView value={displayBody} />
              ) : (
                <div className="empty-state-centered">
                  <p className="muted">No content available for this view.</p>
                  <button className="btn-primary" onClick={() => setTab("edit")}>Start writing</button>
                </div>
              )}
            </div>
          )}

          {tab === "edit" && (
            <div className="edit-view">
              <form action="/api/revisions/create" method="post" className="edit-form">
                <input type="hidden" name="workspaceId" value={workspaceId} />
                <input type="hidden" name="targetType" value={targetType} />
                <input type="hidden" name="articleId" value={entity.id} />
                {activeOverlay && <input type="hidden" name="overlayId" value={targetId} />}
                
                <MarkdownEditor 
                  name="bodyMd" 
                  label={`Editing ${activeOverlay ? "Overlay (Draft)" : "Base Article (Public)"}`} 
                  defaultValue={displayBody}
                  rows={25}
                  placeholder="# Start writing here..."
                />
                
                <div className="panel" style={{ marginTop: '24px', background: '#f8f9fa' }}>
                  <div className="form-grid">
                    <label>
                      <strong>Change Summary</strong> <span className="muted">(Required)</span>
                      <input 
                        name="changeSummary" 
                        required 
                        placeholder="e.g. Fixed typos in the second paragraph..." 
                        className="input-text" 
                      />
                    </label>
                    <div className="edit-actions" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span className="text-xs muted">
                        {targetType === "base" 
                          ? "Note: Base edits publish immediately." 
                          : "Note: Overlay edits are saved as drafts first."}
                      </span>
                      <button type="submit" className="btn-primary">
                        {targetType === "base" ? "Publish Changes" : "Save Draft"}
                      </button>
                    </div>
                  </div>
                </div>
              </form>
            </div>
          )}

          {tab === "history" && (
            <div className="history-view">
               <div className="list-header" style={{ marginBottom: '16px' }}>
                 <h3>Revision History ({relevantRevisions.length})</h3>
               </div>
               {relevantRevisions.length === 0 ? (
                 <p className="muted">No revisions found.</p>
               ) : (
                 <ul className="history-list">
                   {relevantRevisions.map((rev: any) => (
                     <li key={rev.id} className="history-item">
                       <div className="history-meta">
                         <span className={`status-dot ${rev.status === 'approved' || rev.status === 'published' ? 'green' : ''}`}></span>
                         <span className="history-date">
                           {new Date(rev.createdAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
                         </span>
                         <span className="type-tag" style={{ fontSize: '10px' }}>{rev.status}</span>
                       </div>
                       <div className="history-summary">{rev.changeSummary || "No summary provided"}</div>
                       <div className="history-actions">
                         <Link href={`/revisions/${rev.id}`} className="history-link">View Revision</Link>
                         {/* Could add Restore button here later */}
                       </div>
                     </li>
                   ))}
                 </ul>
               )}
            </div>
          )}

          {tab === "compare" && (
            <div className="compare-view">
              <div className="compare-layout">
                <div className="compare-pane">
                  <div className="compare-pane-header">
                    Previous {previousRevision ? `(${new Date(previousRevision.createdAt).toLocaleDateString()})` : "(None)"}
                  </div>
                  <div className="read-view" style={{ fontSize: '14px' }}>
                    {previousRevision ? (
                      <MarkdownView value={previousRevision.bodyMd} />
                    ) : (
                      <p className="muted">No previous revision to compare against.</p>
                    )}
                  </div>
                </div>
                <div className="compare-pane">
                  <div className="compare-pane-header">
                    Current {currentRevision ? `(${new Date(currentRevision.createdAt).toLocaleDateString()})` : "(Live)"}
                  </div>
                  <div className="read-view" style={{ fontSize: '14px' }}>
                     <MarkdownView value={displayBody} />
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>

        <aside className="article-sidebar-col">
          {tab === "read" && displayBody && (
            <div className="sidebar-section toc-section">
              <MarkdownToc value={displayBody} />
            </div>
          )}
          
          <div className="sidebar-section metadata-section">
            <h4>Entity Metadata</h4>
            <div className="meta-grid">
              <div className="meta-item">
                <span className="meta-label">ID</span>
                <span className="meta-value" style={{ fontFamily: 'monospace', fontSize: '12px' }}>{entity.id.substring(0,8)}...</span>
              </div>
              <div className="meta-item">
                <span className="meta-label">Tags</span>
                <span className="meta-value">{entity.tags.join(", ") || "-"}</span>
              </div>
              <div className="meta-item">
                <span className="meta-label">World Existence</span>
                <span className="meta-value">
                   {entity.worldExistFrom ? `${entity.worldExistFrom} - ${entity.worldExistTo || 'Present'}` : "Always"}
                </span>
              </div>
            </div>
          </div>

          <div className="sidebar-section">
             <h4>Context</h4>
             <div className="meta-grid">
               <div className="meta-item">
                 <span className="meta-label">Viewpoint</span>
                 <span className="meta-value">{viewpointId === 'canon' ? 'Canon (Objective)' : viewpointId}</span>
               </div>
               {activeOverlay && (
                 <div className="meta-item">
                   <span className="meta-label">Overlay Status</span>
                   <span className="meta-value">{activeOverlay.activeRevision?.status ?? 'draft'}</span>
                 </div>
               )}
             </div>
          </div>
        </aside>
      </div>
    </div>
  );
}