"use client";

import { useState } from "react";
import { MarkdownView } from "@/components/MarkdownView";
import { MarkdownToc } from "@/components/MarkdownToc";
import { MarkdownEditor } from "@/components/MarkdownEditor";
import Link from "next/link";
import { useGlobalFilters } from "@/components/GlobalFilterProvider";

type Entity = any; // We'll type this loosely for now as it matches the Prisma output

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

  // Determine what we are viewing
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

  // For display
  const displayTitle = activeOverlay ? activeOverlay.title : entity.title;
  const displayBody = activeOverlay 
    ? (activeOverlay.activeRevision?.bodyMd ?? activeOverlay.revisions[0]?.bodyMd ?? "")
    : (entity.article?.baseRevision?.bodyMd ?? "");
  
  // For editing
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
          </div>
        </div>
        <div className="article-tabs">
          <button 
            className={`tab-btn ${tab === "read" ? "active" : ""}`}
            onClick={() => setTab("read")}
          >
            Read
          </button>
          <button 
            className={`tab-btn ${tab === "edit" ? "active" : ""}`}
            onClick={() => setTab("edit")}
          >
            Edit
          </button>
          <button 
            className={`tab-btn ${tab === "history" ? "active" : ""}`}
            onClick={() => setTab("history")}
          >
            History
          </button>
        </div>
      </div>

      <div className="article-layout-grid">
        <main className="article-content">
          {tab === "read" && (
            <div className="read-view">
              {displayBody ? (
                <MarkdownView value={displayBody} />
              ) : (
                <div className="empty-state">
                  <p>No content yet.</p>
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
                  label={`Editing ${activeOverlay ? "Overlay" : "Base Article"}`} 
                  defaultValue={displayBody}
                  rows={20}
                />
                
                <div className="edit-meta">
                  <label>
                    Change Summary (required)
                    <input name="changeSummary" required placeholder="What did you change?" className="input-text" />
                  </label>
                  <div className="edit-actions">
                    <button type="submit" className="btn-primary">Save Draft</button>
                  </div>
                </div>
              </form>
            </div>
          )}

          {tab === "history" && (
            <div className="history-view">
               <h3>Revision History</h3>
               {/* Simplified history list */}
               <ul className="history-list">
                 {(activeOverlay ? activeOverlay.revisions : entity.article?.revisions || []).map((rev: any) => (
                   <li key={rev.id} className="history-item">
                     <span className="history-date">{new Date(rev.createdAt).toLocaleDateString()}</span>
                     <span className="history-status">{rev.status}</span>
                     <span className="history-summary">{rev.changeSummary}</span>
                     <Link href={`/revisions/${rev.id}`} className="history-link">View</Link>
                   </li>
                 ))}
               </ul>
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
            <h4>Metadata</h4>
            <div className="meta-grid">
              <div className="meta-item">
                <span className="meta-label">Tags</span>
                <span className="meta-value">{entity.tags.join(", ") || "-"}</span>
              </div>
              <div className="meta-item">
                <span className="meta-label">Era</span>
                <span className="meta-value">{entity.worldExistFrom || "-"}</span>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
