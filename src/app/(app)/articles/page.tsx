import Link from "next/link";
import { FilterSummary } from "@/components/FilterSummary";
import { requireUser } from "@/lib/auth";
import { getActiveWorkspace } from "@/lib/workspaces";
import { LlmContext } from "@/components/LlmContext";
import { MarkdownEditor } from "@/components/MarkdownEditor";
import { WikiArticleImportPanel } from "@/components/WikiArticleImportPanel";
import { ArticleList } from "@/components/ArticleList";
import { getFilteredEntities } from "@/lib/data/articles";
import { EntityStatus, EntityType } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const ENTITY_TYPES = Object.values(EntityType);
const ENTITY_STATUSES = Object.values(EntityStatus);

type SearchParams = { [key: string]: string | string[] | undefined };
type PageProps = { searchParams: Promise<SearchParams> };

export default async function ArticlesPage({ searchParams }: PageProps) {
  const user = await requireUser();
  const workspace = await getActiveWorkspace(user.id);
  
  if (!workspace) return <div className="panel">Select a workspace.</div>;

  const resolvedSearchParams = await searchParams;
  const eraFilter = String(resolvedSearchParams.era ?? "all");
  const chapterFilter = String(resolvedSearchParams.chapter ?? "all");
  const query = String(resolvedSearchParams.q ?? "").trim();
  const typeFilter = String(resolvedSearchParams.type ?? "all");
  const statusFilter = String(resolvedSearchParams.status ?? "all");
  const unreadOnly = String(resolvedSearchParams.unread ?? "false") === "true";

  const entities = await getFilteredEntities({
    workspaceId: workspace.id,
    query,
    type: typeFilter,
    status: statusFilter,
    era: eraFilter,
    chapter: chapterFilter,
    unreadOnly,
    userId: user.id
  });
  
  // Calculate unread state manually for now if not handled in fetcher perfectly
  const readStates = await prisma.readState.findMany({
    where: { workspaceId: workspace.id, userId: user.id, targetType: "entity" }
  });
  const readStateMap = new Map(readStates.map(r => [r.targetId, r]));

  const enrichedEntities = entities.map(e => ({
     ...e,
     isUnread: Boolean(e.article?.baseRevisionId && readStateMap.get(e.id)?.lastReadRevisionId !== e.article?.baseRevisionId)
  }));
  
  // Archived (separate query)
  const archivedEntities = await prisma.entity.findMany({
    where: { workspaceId: workspace.id, softDeletedAt: { not: null } },
    orderBy: { updatedAt: "desc" }
  });

  return (
    <div className="layout-3-pane">
      <LlmContext
        value={{
          type: "articles",
          entityIds: entities.map(e => e.id),
          filters: { eraFilter, chapterFilter, query, typeFilter }
        }}
      />
      
      {/* Pane 1: Shared List */}
      <ArticleList 
        entities={enrichedEntities} 
        filters={{ query, type: typeFilter }} 
      />

      {/* Pane 2: Dashboard (Empty State) */}
      <main className="pane-center">
        <div className="empty-dashboard">
          <div className="hero-section">
            <h1 className="text-4xl font-extrabold tracking-tight">Knowledge Base</h1>
            <p className="muted mt-2">Select an article from the list to view details, or create a new entry.</p>
          </div>
          
          <div className="dashboard-grid">
             <section className="dashboard-section">
                <h4 className="text-[10px] font-bold uppercase text-muted tracking-widest mb-4">Recently Updated</h4>
                <div className="recent-list">
                  {entities.slice(0, 5).map(e => (
                    <Link key={e.id} href={`/articles/${e.id}`} className="recent-item group">
                       <div className="font-semibold text-ink group-hover:text-accent transition-colors">{e.title}</div>
                       <div className="text-[10px] muted uppercase tracking-tighter">{e.type} • {new Date(e.updatedAt).toLocaleDateString()}</div>
                    </Link>
                  ))}
                </div>
             </section>
             <section className="dashboard-section">
                <h4 className="text-[10px] font-bold uppercase text-muted tracking-widest mb-4">Quick Filters</h4>
                <FilterSummary />
                <div className="mt-4">
                  <Link href="/articles" className="btn-secondary text-xs">Reset Filters</Link>
                </div>
             </section>
          </div>
        </div>
      </main>

      {/* Pane 3: Right / Creation & Import Drawer */}
      <aside className="pane-right-drawer">
         <div className="pane-header">
            <h3 className="text-sm font-bold uppercase tracking-widest text-muted">Tools</h3>
         </div>
         <div className="drawer-content">
            <details className="action-details" open>
               <summary>Create New Article</summary>
               <form action="/api/articles/create" method="post" className="form-grid p-4">
                  <input type="hidden" name="workspaceId" value={workspace.id} />
                  <label>
                    Type
                    <select name="type">{ENTITY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}</select>
                    <span className="text-xs text-muted mt-1 block">What kind of entity is this?</span>
                  </label>
                  <label>
                    Title
                    <input name="title" required placeholder="e.g., The Great War, Lord Varian" />
                    <span className="text-xs text-muted mt-1 block">A descriptive name for this entity</span>
                  </label>
                  <label>
                    Tags
                    <input name="tags" placeholder="e.g., lore, history, major-character" />
                    <span className="text-xs text-muted mt-1 block">Separate multiple tags with commas (e.g., "lore, magic")</span>
                  </label>
                  <MarkdownEditor name="bodyMd" label="Initial Content" rows={6} defaultMode="write" />
                  <button type="submit" className="btn-primary">Create Article</button>
               </form>
            </details>
            
            <details className="action-details">
               <summary>Wiki Import</summary>
               <div className="p-4">
                 <WikiArticleImportPanel workspaceId={workspace.id} entityTypes={ENTITY_TYPES} />
               </div>
            </details>

            {archivedEntities.length > 0 && (
              <details className="action-details">
                <summary>Archived ({archivedEntities.length})</summary>
                <div className="p-4 list-sm">
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
