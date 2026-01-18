"use client";

import { useState } from "react";
import { MarkdownView } from "@/components/MarkdownView";
import { MarkdownToc } from "@/components/MarkdownToc";
import { MarkdownEditor } from "@/components/MarkdownEditor";
import Link from "next/link";
import Image from "next/image";
import { useGlobalFilters } from "@/components/GlobalFilterProvider";

type Entity = any;
type Asset = { id: string; storageKey: string; mimeType: string } | null;
type EntityRef = { id: string; title: string; type: string };
type RelatedEntity = EntityRef & { relation: string; direction: 'to' | 'from' };
type LocationPin = { id: string; map: { id: string; title: string } | null };

export function ArticleDetail({
  entity,
  workspaceId,
  user,
  mainImage,
  parentEntity,
  childEntities,
  relatedEntities,
  locations,
  searchQuery
}: {
  entity: Entity;
  workspaceId: string;
  user: any;
  mainImage?: Asset;
  parentEntity?: EntityRef | null;
  childEntities?: EntityRef[];
  relatedEntities?: RelatedEntity[];
  locations?: LocationPin[];
  searchQuery?: string;
}) {
  const [tab, setTab] = useState<"read" | "edit" | "history" | "relations">("read");
  const { mode, viewpointId, eraId, chapterId } = useGlobalFilters();

  // Context (Base vs Overlay)
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

  // Revisions & Content
  const baseRevisions = entity.article?.revisions || [];
  const overlayRevisions = activeOverlay?.revisions || [];
  const relevantRevisions = activeOverlay ? overlayRevisions : baseRevisions;

  const publishedRevision = activeOverlay ? activeOverlay.activeRevision : entity.article?.baseRevision;
  const latestRevision = relevantRevisions[0];

  const currentRevision = publishedRevision || latestRevision;
  const displayBody = currentRevision?.bodyMd || "";
  const displayTitle = activeOverlay ? activeOverlay.title : entity.title;

  // Compare Tab
  const currentIndex = relevantRevisions.findIndex((r: any) => r.id === currentRevision?.id);
  const compareIndex = currentIndex === -1 ? 1 : currentIndex + 1;
  const previousRevision = relevantRevisions[compareIndex] || null;

  // Edit Targets
  const targetType = activeOverlay ? "overlay" : "base";
  const targetId = activeOverlay ? activeOverlay.id : entity.id;

  // Group relations by type
  const relationsByType = (relatedEntities || []).reduce((acc, rel) => {
    const key = rel.relation.replace(/_/g, " ");
    if (!acc[key]) acc[key] = [];
    acc[key].push(rel);
    return acc;
  }, {} as Record<string, RelatedEntity[]>);

  return (
    <>
      {/* Center Pane: Content */}
      <main className="pane-center">
        <div className="article-header">
          {typeof searchQuery !== "undefined" && (
            <form action="/articles" method="get" className="article-search-bar">
              <div className="article-search-input">
                <svg className="article-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8"></circle>
                  <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                </svg>
                <input
                  name="q"
                  defaultValue={searchQuery}
                  placeholder="Search articles..."
                />
              </div>
              <button type="submit" className="btn-secondary">
                Search
              </button>
            </form>
          )}
          <div className="article-title-row">
            <div>
              {parentEntity && (
                <div className="article-breadcrumb">
                  <Link href={`/articles/${parentEntity.id}`}>{parentEntity.title}</Link>
                  <span className="breadcrumb-sep">/</span>
                </div>
              )}
              <h1>{displayTitle}</h1>
              {entity.aliases?.length > 0 && (
                <div className="article-aliases">
                  Also known as: {entity.aliases.join(", ")}
                </div>
              )}
            </div>
            <div className="article-badges">
              <span className={`badge type-${entity.type.toLowerCase()}`}>{entity.type}</span>
              <span className={`badge status-${entity.status}`}>{entity.status}</span>
              {activeOverlay && <span className="badge overlay">Viewpoint</span>}
              {!publishedRevision && latestRevision && <span className="badge status-draft">Draft</span>}
            </div>
          </div>
          <div className="article-tabs">
            {(["read", "edit", "history", "relations"] as const).map((t) => (
              <button
                key={t}
                className={`tab-btn ${tab === t ? "active" : ""}`}
                onClick={() => setTab(t)}
              >
                {t === "relations" ? "Relations" : t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <div className="article-main-content">
          {tab === "read" && (
            <>
              {/* Summary/Lead section */}
              {entity.summaryMd && (
                <div className="article-summary">
                  <MarkdownView value={entity.summaryMd} />
                </div>
              )}

              {/* Table of Contents */}
              {displayBody && (
                <div className="article-toc-inline">
                  <MarkdownToc value={displayBody} />
                </div>
              )}

              {/* Main Body */}
              <div className="read-view">
                {displayBody ? (
                  <MarkdownView value={displayBody} />
                ) : (
                  <div className="empty-content">
                    <p>This article has no content yet.</p>
                    <button className="btn-primary" onClick={() => setTab("edit")}>
                      Start writing
                    </button>
                  </div>
                )}
              </div>

              {/* Child Entities */}
              {childEntities && childEntities.length > 0 && (
                <div className="article-section">
                  <h2>Sub-entries</h2>
                  <div className="entity-grid">
                    {childEntities.map((child) => (
                      <Link
                        key={child.id}
                        href={`/articles/${child.id}`}
                        className="entity-card"
                      >
                        <span className="entity-card-type">{child.type}</span>
                        <span className="entity-card-title">{child.title}</span>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {/* Related Entities (brief) */}
              {relatedEntities && relatedEntities.length > 0 && (
                <div className="article-section">
                  <h2>Related</h2>
                  <div className="related-list">
                    {relatedEntities.slice(0, 10).map((rel) => (
                      <Link
                        key={`${rel.id}-${rel.relation}`}
                        href={`/articles/${rel.id}`}
                        className="related-item"
                      >
                        <span className="related-type">{rel.relation.replace(/_/g, " ")}</span>
                        <span className="related-title">{rel.title}</span>
                      </Link>
                    ))}
                    {relatedEntities.length > 10 && (
                      <button className="btn-link" onClick={() => setTab("relations")}>
                        View all {relatedEntities.length} relations
                      </button>
                    )}
                  </div>
                </div>
              )}
            </>
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
                  label={`Editing ${activeOverlay ? "Overlay (Draft)" : "Base Article"}`}
                  defaultValue={displayBody}
                  rows={30}
                  placeholder="# Article Title

Write your article content here using Markdown or WikiText syntax.

## Section Heading

Regular paragraph text. You can use **bold**, *italic*, and [[internal links]].

### Subsection

- Bullet point
- Another point

[[File:example.jpg|thumb|Caption text]]
"
                />

                <div className="edit-footer">
                  <div className="edit-summary-row">
                    <label>
                      <strong>Edit Summary</strong>
                      <input
                        name="changeSummary"
                        required
                        placeholder="Describe your changes..."
                        className="input-text"
                      />
                    </label>
                  </div>
                  <div className="edit-actions">
                    <span className="edit-hint">
                      {targetType === "base"
                        ? "Changes will be published immediately."
                        : "Changes will be saved as draft."}
                    </span>
                    <button type="submit" className="btn-primary">
                      {targetType === "base" ? "Publish" : "Save Draft"}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          )}

          {tab === "history" && (
            <div className="history-view">
              <h2>Revision History ({relevantRevisions.length})</h2>
              {relevantRevisions.length === 0 ? (
                <p className="muted">No revisions found.</p>
              ) : (
                <table className="history-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Summary</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {relevantRevisions.map((rev: any, idx: number) => (
                      <tr key={rev.id} className={idx === 0 ? "current" : ""}>
                        <td className="history-date">
                          {new Date(rev.createdAt).toLocaleString()}
                        </td>
                        <td className="history-summary">
                          {rev.changeSummary || "(No summary)"}
                        </td>
                        <td>
                          <span className={`status-badge ${rev.status}`}>{rev.status}</span>
                        </td>
                        <td>
                          <Link href={`/revisions/${rev.id}`} className="btn-link">
                            View
                          </Link>
                          {idx > 0 && (
                            <form action="/api/revisions/restore" method="post" className="inline-form">
                              <input type="hidden" name="workspaceId" value={workspaceId} />
                              <input type="hidden" name="revisionId" value={rev.id} />
                              <button type="submit" className="btn-link">Restore</button>
                            </form>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {tab === "relations" && (
            <div className="relations-view">
              <h2>All Relations</h2>

              {/* Add Relation Form */}
              <details className="add-relation-form">
                <summary>Add New Relation</summary>
                <form action="/api/entity-relations/create" method="post" className="form-grid">
                  <input type="hidden" name="workspaceId" value={workspaceId} />
                  <input type="hidden" name="fromEntityId" value={entity.id} />

                  <label>
                    Related Entity (search)
                    <input
                      name="toEntityQuery"
                      required
                      placeholder="Type a title or alias..."
                    />
                    <span className="text-xs text-muted">Search by name instead of ID.</span>
                  </label>
                  <label>
                    Relation Type
                    <select name="relationType">
                      <option value="related_to">Related To</option>
                      <option value="member_of">Member Of</option>
                      <option value="allied_with">Allied With</option>
                      <option value="enemy_of">Enemy Of</option>
                      <option value="parent_of">Parent Of</option>
                      <option value="child_of">Child Of</option>
                      <option value="located_in">Located In</option>
                      <option value="owns">Owns</option>
                      <option value="created_by">Created By</option>
                      <option value="participated_in">Participated In</option>
                      <option value="custom">Custom</option>
                    </select>
                  </label>
                  <label>
                    Custom Label (optional)
                    <input name="customLabel" placeholder="e.g., mentor of..." />
                  </label>
                  <button type="submit" className="btn-primary">Add Relation</button>
                </form>
              </details>

              {/* Relations grouped by type */}
              {Object.entries(relationsByType).map(([relType, rels]) => (
                <div key={relType} className="relation-group">
                  <h3>{relType}</h3>
                  <div className="entity-grid">
                    {rels.map((rel) => (
                      <Link
                        key={`${rel.id}-${rel.direction}`}
                        href={`/articles/${rel.id}`}
                        className="entity-card"
                      >
                        <span className="entity-card-type">{rel.type}</span>
                        <span className="entity-card-title">{rel.title}</span>
                        <span className="entity-card-direction">
                          {rel.direction === 'to' ? 'outgoing' : 'incoming'}
                        </span>
                      </Link>
                    ))}
                  </div>
                </div>
              ))}

              {(!relatedEntities || relatedEntities.length === 0) && (
                <p className="muted">No relations defined yet.</p>
              )}
            </div>
          )}
        </div>
      </main>

      {/* Right Pane: Infobox / Metadata */}
      <aside className="pane-right-drawer">
         <div className="pane-header">
           <h3>Infobox</h3>
         </div>
         <div className="drawer-content p-4">
          {/* Main Image */}
          {mainImage && (
            <div className="infobox-image relative w-full aspect-square bg-bg rounded-md overflow-hidden border border-border">
              <Image
                src={`/api/assets/file/${mainImage.id}`}
                alt={entity.title}
                fill
                className="object-cover"
                sizes="(max-width: 768px) 100vw, 300px"
              />
            </div>
          )}
          {!mainImage && (
            <div className="infobox-image-placeholder">
              <span>{entity.type.charAt(0)}</span>
            </div>
          )}

          <h3 className="infobox-title">{entity.title}</h3>

          <table className="infobox-table">
            <tbody>
              <tr>
                <th>Type</th>
                <td>{entity.type}</td>
              </tr>
              <tr>
                <th>Status</th>
                <td>{entity.status}</td>
              </tr>
              {entity.worldExistFrom && (
                <tr>
                  <th>Active Period</th>
                  <td>{entity.worldExistFrom} - {entity.worldExistTo || "Present"}</td>
                </tr>
              )}
              {entity.tags?.length > 0 && (
                <tr>
                  <th>Tags</th>
                  <td>
                    {entity.tags.map((tag: string) => (
                      <span key={tag} className="tag-chip">{tag}</span>
                    ))}
                  </td>
                </tr>
              )}
              {parentEntity && (
                <tr>
                  <th>Parent</th>
                  <td>
                    <Link href={`/articles/${parentEntity.id}`} className="entity-link">
                      {parentEntity.title}
                    </Link>
                  </td>
                </tr>
              )}
              {locations && locations.length > 0 && (
                <tr>
                  <th>Locations</th>
                  <td>
                    {locations.filter(l => l.map).map((loc) => (
                      <Link
                        key={loc.id}
                        href={`/maps?map=${loc.map?.id}`}
                        className="entity-link"
                      >
                        {loc.map?.title}
                      </Link>
                    ))}
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {/* Quick Actions */}
          <div className="infobox-actions">
            <details className="action-details">
               <summary>Actions</summary>
               <div className="p-2">
                  <form action="/api/entities/update" method="post" className="form-grid">
                    <input type="hidden" name="workspaceId" value={workspaceId} />
                    <input type="hidden" name="entityId" value={entity.id} />
                    <label className="file-upload-label">
                      <span>Upload Main Image</span>
                      <input type="file" name="mainImage" accept="image/*" />
                    </label>
                  </form>
               </div>
            </details>
          </div>
        </div>
      </aside>
    </>
  );
}
