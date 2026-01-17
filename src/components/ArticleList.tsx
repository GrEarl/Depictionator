import Link from "next/link";
import { EntityType } from "@prisma/client";

type EntitySummary = {
  id: string;
  title: string;
  type: string;
  updatedAt: Date;
  article?: { baseRevisionId: string | null } | null;
  isUnread?: boolean;
};

type ArticleListProps = {
  entities: EntitySummary[];
  activeId?: string;
  filters: {
    query?: string;
    type?: string;
    status?: string;
  };
};

export function ArticleList({ entities, activeId, filters }: ArticleListProps) {
  return (
    <aside className="pane-left">
      <div className="pane-header">
        <h3>Entities ({entities.length})</h3>
        <form method="get" className="quick-search">
          <input 
            name="q" 
            defaultValue={filters.query} 
            placeholder="Search..." 
            className="input-text" 
          />
          {/* Preserve other filters as hidden inputs if needed, or rely on URL state */}
        </form>
        <div className="filter-chips mt-2">
           <Link href="?" className={`chip ${!filters.type || filters.type === 'all' ? 'active' : ''}`}>All</Link>
           <Link href="?type=character" className={`chip ${filters.type === 'character' ? 'active' : ''}`}>Chars</Link>
           <Link href="?type=location" className={`chip ${filters.type === 'location' ? 'active' : ''}`}>Locs</Link>
           <Link href="?type=event" className={`chip ${filters.type === 'event' ? 'active' : ''}`}>Events</Link>
        </div>
      </div>
      <div className="entity-list">
        {entities.map((entity) => (
          <Link
            key={entity.id}
            href={`/articles/${entity.id}`}
            className={`entity-item ${activeId === entity.id ? "active" : ""}`}
          >
            <div className="entity-item-main">
              <span className="entity-name">{entity.title}</span>
              {entity.isUnread && <span className="unread-dot" title="Unread updates" />}
            </div>
            <div className="entity-item-meta">
              <span className={`type-tag type-${entity.type}`}>{entity.type}</span>
              <span className="updated-at">
                {new Date(entity.updatedAt).toLocaleDateString()}
              </span>
            </div>
          </Link>
        ))}
        {entities.length === 0 && (
          <div className="muted p-4 text-center">No articles found.</div>
        )}
      </div>
    </aside>
  );
}
