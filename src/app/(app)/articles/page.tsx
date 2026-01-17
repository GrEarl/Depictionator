import Link from "next/link";
import { FilterSummary } from "@/components/FilterSummary";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getActiveWorkspace } from "@/lib/workspaces";
import { LlmContext } from "@/components/LlmContext";
import { MarkdownEditor } from "@/components/MarkdownEditor";
import { WikiArticleImportPanel } from "@/components/WikiArticleImportPanel";
import { EntityStatus, EntityType } from "@prisma/client";

const ENTITY_TYPES = Object.values(EntityType);
const ENTITY_STATUSES = Object.values(EntityStatus);

type EntitySummary = {
  id: string;
  title: string;
  type: string;
  updatedAt: Date;
  article?: { baseRevisionId: string | null } | null;
};

type SearchParams = { [key: string]: string | string[] | undefined };
type PageProps = { searchParams: Promise<SearchParams> };

export default async function ArticlesPage({ searchParams }: PageProps) {
  const user = await requireUser();
  const workspace = await getActiveWorkspace(user.id);
  const resolvedSearchParams = await searchParams;
  
  const eraFilter = String(resolvedSearchParams.era ?? "all");
  const chapterFilter = String(resolvedSearchParams.chapter ?? "all");
  const viewpointFilter = String(resolvedSearchParams.viewpoint ?? "canon");
  const mode = String(resolvedSearchParams.mode ?? "canon");
  const query = String(resolvedSearchParams.q ?? "").trim();
  const typeFilterRaw = String(resolvedSearchParams.type ?? "all").toLowerCase();
  const statusFilterRaw = String(resolvedSearchParams.status ?? "all").toLowerCase();
  const tagsRaw = String(resolvedSearchParams.tags ?? "").trim();
  const unreadOnly = String(resolvedSearchParams.unread ?? "false") === "true";

  const typeFilter = ENTITY_TYPES.includes(typeFilterRaw as EntityType)
    ? (typeFilterRaw as EntityType)
    : "all";
  const statusFilter = ENTITY_STATUSES.includes(statusFilterRaw as EntityStatus)
    ? (statusFilterRaw as EntityStatus)
    : "all";
  const tagList = tagsRaw
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);

  const entities = workspace
    ? await prisma.entity.findMany({
        where: {
          workspaceId: workspace.id,
          softDeletedAt: null,
          ...(typeFilter === "all" ? {} : { type: typeFilter }),
          ...(statusFilter === "all" ? {} : { status: statusFilter }),
          ...(eraFilter === "all"
            ? {}
            : {
                OR: [
                  { worldExistFrom: eraFilter },
                  { worldExistTo: eraFilter },
                  { worldExistFrom: null, worldExistTo: null }
                ]
              }),
          ...(chapterFilter === "all"
            ? {}
            : {
                OR: [{ storyIntroChapterId: chapterFilter }, { storyIntroChapterId: null }]
              }),
          ...(query
            ? {
                OR: [
                  { title: { contains: query, mode: "insensitive" } },
                  { aliases: { has: query } },
                  { tags: { has: query } }
                ]
              }
            : {}),
          ...(tagList.length > 0 ? { tags: { hasSome: tagList } } : {})
        },
        include: { article: { select: { baseRevisionId: true } } },
        orderBy: { updatedAt: "desc" }
      })
    : [];

  const readStates = workspace
    ? await prisma.readState.findMany({
        where: { workspaceId: workspace.id, userId: user.id, targetType: "entity" }
      })
    : [];

  const readStateMap = new Map<string, { lastReadRevisionId?: string | null }>(
    readStates.map((state: any) => [state.targetId, state])
  );

  const filteredEntities = unreadOnly
    ? entities.filter((entity) => {
        const baseRevisionId = entity.article?.baseRevisionId ?? null;
        const readState = readStateMap.get(entity.id);
        return Boolean(baseRevisionId && readState?.lastReadRevisionId !== baseRevisionId);
      })
    : entities;

  const archivedEntities = workspace
    ? await prisma.entity.findMany({
        where: { workspaceId: workspace.id, softDeletedAt: { not: null } },
        orderBy: { updatedAt: "desc" }
      })
    : [];

  if (!workspace) return <div className="panel">Select a workspace.</div>;

  return (
    <div className="layout-3-pane">
      <LlmContext
        value={{
          type: "articles",
          entityIds: filteredEntities.map((entity: EntitySummary) => entity.id),
          filters: { eraFilter, chapterFilter, viewpointFilter, mode, query, typeFilter, statusFilter, tags: tagList, unreadOnly }
        }}
      />
      
      {/* Pane 1: Left Navigation / Entity List */}
      <aside className="pane-left">
        <div className="pane-header">
           <h3>Entities ({filteredEntities.length})</h3>
           <form method="get" className="quick-search">
             <input type="hidden" name="era" value={eraFilter} />
             <input type="hidden" name="chapter" value={chapterFilter} />
             <input type="hidden" name="viewpoint" value={viewpointFilter} />
             <input type="hidden" name="mode" value={mode} />
             <input name="q" defaultValue={query} placeholder="Search..." />
           </form>
        </div>
        <div className="entity-list">
          {filteredEntities.map((entity: EntitySummary) => {
             const readState = readStateMap.get(entity.id);
             const isUnread = entity.article?.baseRevisionId && readState?.lastReadRevisionId !== entity.article.baseRevisionId;
             return (
              <Link key={entity.id} href={`/articles/${entity.id}`} className="entity-item">
                <div className="entity-item-main">
                  <span className="entity-name">{entity.title}</span>
                  {isUnread && <span className="unread-dot" title="Unread updates" />}
                </div>
                <div className="entity-item-meta">
                  <span className={`type-tag tag-${entity.type.toLowerCase()}`}>{entity.type}</span>
                  <span className="updated-at">{new Date(entity.updatedAt).toLocaleDateString()}</span>
                </div>
              </Link>
             );
          })}
          {filteredEntities.length === 0 && <div className="muted p-4">No articles found.</div>}
        </div>
      </aside>

      {/* Pane 2: Center / Content / Empty State */}
      <main className="pane-center">
        <div className="empty-dashboard">
          <div className="hero-section">
            <h1>Articles</h1>
            <p>Welcome to the knowledge base. Select an article from the left to read or edit, or create a new one using the panel on the right.</p>
          </div>
          
          <div className="dashboard-grid">
             <section className="dashboard-section">
                <h4>Recently Updated</h4>
                <div className="recent-list">
                  {entities.slice(0, 5).map(e => (
                    <Link key={e.id} href={`/articles/${e.id}`} className="recent-item">
                       <strong>{e.title}</strong>
                       <span className="muted">{e.type}</span>
                    </Link>
                  ))}
                </div>
             </section>
             <section className="dashboard-section">
                <h4>Filters Active</h4>
                <FilterSummary />
                <Link href="/articles" className="link-button">Clear all filters</Link>
             </section>
          </div>
        </div>
      </main>

      {/* Pane 3: Right / Creation & Import Drawer */}
      <aside className="pane-right-drawer">
         <div className="pane-header">
            <h3>Actions</h3>
         </div>
         <div className="drawer-content">
            <details className="action-details" open>
               <summary>Create New Article</summary>
               <form action="/api/articles/create" method="post" className="form-grid p-2">
                  <input type="hidden" name="workspaceId" value={workspace.id} />
                  <label>Type <select name="type">{ENTITY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}</select></label>
                  <label>Title <input name="title" required /></label>
                  <label>Tags <input name="tags" placeholder="lore, history..." /></label>
                  <MarkdownEditor name="bodyMd" label="Initial Content" rows={6} />
                  <button type="submit" className="btn-primary">Create Article</button>
               </form>
            </details>
            
            <details className="action-details">
               <summary>Wiki Import</summary>
               <div className="p-2">
                 <WikiArticleImportPanel workspaceId={workspace.id} entityTypes={ENTITY_TYPES} />
               </div>
            </details>

            <details className="action-details">
               <summary>Advanced Filters</summary>
               <form method="get" className="form-grid p-2">
                  <input type="hidden" name="q" value={query} />
                  <label>Type <select name="type" defaultValue={typeFilter}><option value="all">All</option>{ENTITY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}</select></label>
                  <label>Status <select name="status" defaultValue={statusFilter}><option value="all">All</option>{ENTITY_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}</select></label>
                  <label>Unread Only <select name="unread" defaultValue={unreadOnly ? "true" : "false"}><option value="false">No</option><option value="true">Yes</option></select></label>
                  <button type="submit" className="btn-secondary">Apply Filters</button>
               </form>
            </details>

            {archivedEntities.length > 0 && (
              <details className="action-details">
                <summary>Archived ({archivedEntities.length})</summary>
                <div className="p-2 list-sm">
                  {archivedEntities.map(e => (
                    <div key={e.id} className="list-row-sm">
                      <span>{e.title}</span>
                      <form action="/api/restore" method="post">
                        <input type="hidden" name="workspaceId" value={workspace.id} /><input type="hidden" name="targetType" value="entity" /><input type="hidden" name="targetId" value={e.id} />
                        <button type="submit" className="link-button">Restore</button>
                      </form>
                    </div>
                  ))}
                </div>
              </details>
            )}
         </div>
      </aside>
    </div>
  );
}
