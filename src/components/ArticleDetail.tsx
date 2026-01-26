"use client";

import { useEffect, useMemo, useState } from "react";
import { MarkdownView } from "@/components/MarkdownView";
import { MarkdownToc } from "@/components/MarkdownToc";
import { MarkdownEditor } from "@/components/MarkdownEditor";
import { Infobox } from "@/components/Infobox";
import Link from "next/link";
import { useGlobalFilters } from "@/components/GlobalFilterProvider";
import { toWikiPath } from "@/lib/wiki";
import { getProtectionLevel, type ProtectionLevel } from "@/lib/protection";
import { autoLinkMarkdown, type AutoLinkTarget } from "@/lib/markdown";
import { Backlinks, BacklinksCompact } from "@/components/Backlinks";

type Entity = any;
type Asset = { id: string; storageKey: string; mimeType: string } | null;
type EntityRef = { id: string; title: string; type: string };
type RelatedEntity = EntityRef & { relation: string; direction: 'to' | 'from' };
type LocationPin = { id: string; map: { id: string; title: string } | null };
type BacklinkEntity = { id: string; title: string; type: string };

export function ArticleDetail({
  entity,
  workspaceId,
  user,
  userRole,
  mainImage,
  parentEntity,
  childEntities,
  relatedEntities,
  locations,
  searchQuery,
  isWatching,
  linkTargets,
  backlinks
}: {
  entity: Entity;
  workspaceId: string;
  user: any;
  userRole?: string;
  mainImage?: Asset;
  parentEntity?: EntityRef | null;
  childEntities?: EntityRef[];
  relatedEntities?: RelatedEntity[];
  locations?: LocationPin[];
  searchQuery?: string;
  isWatching?: boolean;
  linkTargets?: AutoLinkTarget[];
  backlinks?: BacklinkEntity[];
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

  // Parse infobox media (audio/video)
  const infoboxMedia = useMemo(() => {
    if (!entity.infoboxMediaJson) return null;
    try {
      const parsed = JSON.parse(entity.infoboxMediaJson);
      return {
        audio: Array.isArray(parsed.audio) ? parsed.audio : [],
        video: Array.isArray(parsed.video) ? parsed.video : []
      };
    } catch {
      return null;
    }
  }, [entity.infoboxMediaJson]);
  const relevantRevisions = activeOverlay ? overlayRevisions : baseRevisions;

  const publishedRevision = activeOverlay ? activeOverlay.activeRevision : entity.article?.baseRevision;
  const latestRevision = relevantRevisions[0];

  const currentRevision = publishedRevision || latestRevision;
  const displayBody = currentRevision?.bodyMd || "";
  const displayTitle = activeOverlay ? activeOverlay.title : entity.title;
  const protectionLevel = getProtectionLevel(entity.tags ?? []);
  const isAdmin = userRole === "admin";
  const isProtectedAdmin = protectionLevel === "admin";
  const canEdit = !isProtectedAdmin || isAdmin;
  const manageDisabled = isProtectedAdmin && !isAdmin;
  const [renderBody, setRenderBody] = useState(displayBody);
  const safeLinkTargets = useMemo(() => linkTargets ?? [], [linkTargets]);
  const linkedBody = useMemo(
    () => autoLinkMarkdown(renderBody, safeLinkTargets),
    [renderBody, safeLinkTargets]
  );
  const linkedSummary = useMemo(
    () => autoLinkMarkdown(entity.summaryMd ?? "", safeLinkTargets),
    [entity.summaryMd, safeLinkTargets]
  );

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

  const categoryTags = (entity.tags ?? [])
    .filter((tag: string) => tag.startsWith("category:"))
    .map((tag: string) => tag.replace(/^category:/, ""));
  const templateTags = (entity.tags ?? [])
    .filter((tag: string) => tag.startsWith("template:"))
    .map((tag: string) => tag.replace(/^template:/, ""));
  const plainTags = (entity.tags ?? []).filter(
    (tag: string) =>
      !tag.startsWith("category:") &&
      !tag.startsWith("template:") &&
      !tag.startsWith("protected:")
  );

  useEffect(() => {
    const templateRegex = /\{\{TEMPLATE:([^}|]+)(?:\|[^}]*)?\}\}/g;
    const matches = Array.from(displayBody.matchAll(templateRegex)) as RegExpMatchArray[];
    if (matches.length === 0) {
      setRenderBody(displayBody);
      return;
    }
    const names = Array.from(
      new Set(
        matches
          .map((match) => (match[1] ?? "").trim().replace(/^Template:/i, ""))
          .filter(Boolean)
      )
    );
    if (names.length === 0) {
      setRenderBody(displayBody);
      return;
    }

    const controller = new AbortController();
    const resolveTemplates = async () => {
      try {
        const response = await fetch("/api/templates/resolve", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ workspaceId, names }),
          signal: controller.signal
        });
        const data = await response.json();
        const items: Array<{ name: string; bodyMd: string }> = Array.isArray(data.items) ? data.items : [];
        const map = new Map(items.map((item) => [item.name.toLowerCase(), item.bodyMd]));
        let expanded = displayBody;
        names.forEach((name) => {
          const content = map.get(name.toLowerCase()) || `> Missing template: ${name}`;
          const escaped = name.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&");
          const pattern = new RegExp(`\\{\\{TEMPLATE:(?:Template:)?${escaped}[^}]*\\}\\}`, "g");
          expanded = expanded.replace(pattern, content);
        });
        setRenderBody(expanded);
      } catch {
        setRenderBody(displayBody);
      }
    };
    resolveTemplates();
    return () => controller.abort();
  }, [displayBody, workspaceId]);

  const hasRenderBody = Boolean(renderBody?.trim());

  const hasInfoboxMedia = Boolean(infoboxMedia?.audio?.length || infoboxMedia?.video?.length);
  const showInfobox = Boolean(mainImage || hasInfoboxMedia);

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
                  <Link href={toWikiPath(parentEntity.title)}>{parentEntity.title}</Link>
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
            <div className="article-header-actions">
              <div className="article-badges">
                <span className={`badge type-${entity.type.toLowerCase()}`}>{entity.type}</span>
                <span className={`badge status-${entity.status}`}>{entity.status}</span>
                {activeOverlay && <span className="badge overlay">Viewpoint</span>}
                {!publishedRevision && latestRevision && <span className="badge status-draft">Draft</span>}
                {protectionLevel !== "none" && (
                  <span className={`badge protected-${protectionLevel}`}>Protected {protectionLevel}</span>
                )}
              </div>
              <div className="article-action-group">
                <div className="article-action-tabs" role="tablist" aria-label="Article views">
                  {(["read", "edit", "history", "relations"] as const).map((t) => (
                    <button
                      key={t}
                      className={`tab-btn ${tab === t ? "active" : ""}`}
                      aria-pressed={tab === t}
                      disabled={t === "edit" && !canEdit}
                      onClick={() => {
                        if (t === "edit" && !canEdit) return;
                        setTab(t);
                      }}
                    >
                      {t === "relations" ? "Relations" : t.charAt(0).toUpperCase() + t.slice(1)}
                    </button>
                  ))}
                </div>
                <Link
                  href={toWikiPath(`Talk:${displayTitle}`)}
                  className="btn-link"
                >
                  Talk
                </Link>
              </div>
            </div>
          </div>
        </div>

        <div className="article-main-content">
          {tab === "read" && (
            <>
              <div className="read-view">
                {/* Infobox with image */}
                {showInfobox && (
                  <Infobox
                    title={displayTitle}
                    image={
                      mainImage
                        ? {
                            src: `/api/assets/file/${mainImage.id}`,
                            alt: displayTitle,
                            caption: entity.summaryMd?.split("\n")[0] || displayTitle
                          }
                        : undefined
                    }
                    audio={infoboxMedia?.audio?.map((a: { assetId: string; caption?: string }) => ({
                      src: `/api/assets/file/${a.assetId}`,
                      caption: a.caption
                    }))}
                    video={infoboxMedia?.video?.map((v: { assetId: string; caption?: string }) => ({
                      src: `/api/assets/file/${v.assetId}`,
                      caption: v.caption
                    }))}
                    rows={[
                      { label: "Type", value: entity.type },
                      { label: "Status", value: entity.status },
                      ...(entity.worldExistFrom || entity.worldExistTo ? [{
                        label: "Period",
                        value: `${entity.worldExistFrom || '?'} - ${entity.worldExistTo || '?'}`
                      }] : []),
                      ...(parentEntity ? [{
                        label: "Part of",
                        value: <Link href={toWikiPath(parentEntity.title)} className="entity-link">{parentEntity.title}</Link>
                      }] : []),
                      ...(locations && locations.length > 0 ? [{
                        label: "Locations",
                        value: locations.length.toString()
                      }] : []),
                    ]}
                  />
                )}

                {/* Summary/Lead section */}
                {entity.summaryMd && (
                  <div className="article-summary">
                    <MarkdownView value={linkedSummary} />
                  </div>
                )}

                {/* Table of Contents */}
                {hasRenderBody && (
                  <div className="article-toc-inline">
                    <MarkdownToc value={renderBody} />
                  </div>
                )}

                {/* Main Body */}
                <div className="read-body">
                  {hasRenderBody ? (
                    <MarkdownView value={linkedBody} />
                  ) : (
                    <div className="empty-content">
                      <p>This article has no content yet.</p>
                      <button className="btn-primary" onClick={() => setTab("edit")}>
                        Start writing
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Child Entities */}
              {childEntities && childEntities.length > 0 && (
                <div className="article-section">
                  <h2>Sub-entries</h2>
                  <div className="entity-grid">
                    {childEntities.map((child) => (
                      <Link
                        key={child.id}
                        href={toWikiPath(child.title)}
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
                        href={toWikiPath(rel.title)}
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

              {/* Backlinks - What Links Here */}
              {backlinks && backlinks.length > 0 && (
                <div className="article-section">
                  <Backlinks backlinks={backlinks} currentTitle={displayTitle} />
                </div>
              )}

              {categoryTags.length > 0 && (
                <div className="article-section">
                  <h2>Categories</h2>
                  <div className="tag-list">
                    {categoryTags.map((tag: string) => (
                      <Link key={tag} href={`/categories/${encodeURIComponent(tag)}`} className="tag-chip">
                        {tag}
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {templateTags.length > 0 && (
                <div className="article-section">
                  <h2>Templates</h2>
                  <div className="tag-list">
                    {templateTags.map((tag: string) => (
                      <Link key={tag} href={`/templates/${encodeURIComponent(tag)}`} className="tag-chip">
                        {tag}
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {tab === "edit" && !canEdit && (
            <div className="panel">
              <h2 className="text-lg font-bold">Protected</h2>
              <p className="muted mt-2">This page is protected. Only admins can edit it.</p>
            </div>
          )}

          {tab === "edit" && canEdit && (
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
                  workspaceId={workspaceId}
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
                        href={toWikiPath(rel.title)}
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
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/api/assets/file/${mainImage.id}`}
                alt={entity.title}
                className="absolute inset-0 w-full h-full object-cover"
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
              {plainTags.length > 0 && (
                <tr>
                  <th>Tags</th>
                  <td>
                    {plainTags.map((tag: string) => (
                      <span key={tag} className="tag-chip">{tag}</span>
                    ))}
                  </td>
                </tr>
              )}
              {parentEntity && (
                <tr>
                  <th>Parent</th>
                  <td>
                    <Link href={toWikiPath(parentEntity.title)} className="entity-link">
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

          {/* Backlinks Section */}
          {backlinks && backlinks.length > 0 && (
            <div className="infobox-backlinks mt-4 pt-4 border-t border-border">
              <BacklinksCompact backlinks={backlinks} />
            </div>
          )}

          {/* Quick Actions */}
          <div className="infobox-actions">
            <details className="action-details">
               <summary>Manage</summary>
               <div className="p-4 space-y-4">
                  {/* Main Image Upload */}
                  <form
                    action="/api/entities/main-image"
                    method="post"
                    encType="multipart/form-data"
                    className="form-grid"
                  >
                    <input type="hidden" name="workspaceId" value={workspaceId} />
                    <input type="hidden" name="entityId" value={entity.id} />
                    <label>
                      Main Image
                      <input
                        type="file"
                        name="file"
                        accept="image/*"
                        disabled={manageDisabled}
                        className="file-input"
                      />
                    </label>
                    <button type="submit" className="btn-secondary" disabled={manageDisabled}>
                      {mainImage ? "Replace Image" : "Upload Image"}
                    </button>
                  </form>

                  {mainImage && (
                    <form action="/api/entities/main-image" method="post" className="form-grid">
                      <input type="hidden" name="workspaceId" value={workspaceId} />
                      <input type="hidden" name="entityId" value={entity.id} />
                      <input type="hidden" name="assetId" value="" />
                      <button
                        type="submit"
                        className="btn-link text-xs text-muted"
                        disabled={manageDisabled}
                      >
                        Remove current image
                      </button>
                    </form>
                  )}

                  <hr className="border-border" />

                  <form action="/api/articles/rename" method="post" className="form-grid">
                    <input type="hidden" name="workspaceId" value={workspaceId} />
                    <input type="hidden" name="entityId" value={entity.id} />
                    <label>
                      Rename title
                      <input name="title" defaultValue={entity.title} disabled={manageDisabled} />
                    </label>
                    <label className="flex items-center gap-2 text-xs font-semibold normal-case tracking-normal text-muted">
                      <input type="checkbox" name="addRedirect" defaultChecked disabled={manageDisabled} />
                      Keep old title as redirect (alias)
                    </label>
                    <button type="submit" className="btn-secondary" disabled={manageDisabled}>Rename</button>
                  </form>

                  {isAdmin ? (
                    <form action="/api/articles/protect" method="post" className="form-grid">
                      <input type="hidden" name="workspaceId" value={workspaceId} />
                      <input type="hidden" name="entityId" value={entity.id} />
                      <label>
                        Protection level
                        <select name="level" defaultValue={protectionLevel}>
                          <option value="none">None</option>
                          <option value="editor">Editors</option>
                          <option value="admin">Admins</option>
                        </select>
                      </label>
                      <button type="submit" className="btn-secondary">Update protection</button>
                    </form>
                  ) : (
                    protectionLevel !== "none" && (
                      <div className="muted text-xs">Protected: admin only.</div>
                    )
                  )}

                  <form action="/api/watches/toggle" method="post" className="form-grid">
                    <input type="hidden" name="workspaceId" value={workspaceId} />
                    <input type="hidden" name="targetType" value="entity" />
                    <input type="hidden" name="targetId" value={entity.id} />
                    <button type="submit" className="btn-secondary">
                      {isWatching ? "Unwatch" : "Watch"}
                    </button>
                  </form>

                  <form action="/api/articles/delete" method="post" className="form-grid">
                    <input type="hidden" name="workspaceId" value={workspaceId} />
                    <input type="hidden" name="entityId" value={entity.id} />
                    <button
                      type="submit"
                      className="btn-danger"
                      disabled={manageDisabled}
                      onClick={(event) => {
                        if (!window.confirm("Delete this article? You can restore it later.")) {
                          event.preventDefault();
                        }
                      }}
                    >
                      Delete
                    </button>
                  </form>
               </div>
            </details>
          </div>
        </div>
      </aside>
    </>
  );
}
