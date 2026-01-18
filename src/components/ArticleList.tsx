import Link from "next/link";
import { cn } from "@/lib/utils";

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
    <aside className="w-[320px] border-r border-border bg-panel flex flex-col h-full overflow-hidden">
      <div className="p-4 border-b border-border space-y-3 bg-bg/30">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-widest text-muted">
            Entities
            <span className="ml-2 bg-muted/20 text-muted px-1.5 py-0.5 rounded text-[10px]">
              {entities.length}
            </span>
          </h3>
        </div>
        
        <form method="get" className="relative group">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted group-focus-within:text-accent transition-colors" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
          <input 
            name="q" 
            defaultValue={filters.query} 
            placeholder="Search entities..." 
            className="w-full pl-9 pr-3 py-2 bg-bg border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition-all placeholder:text-muted/70"
          />
        </form>

        <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-none">
           <Link href="?" className={cn("px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded-md border transition-all whitespace-nowrap", !filters.type || filters.type === 'all' ? "bg-accent/10 border-accent/20 text-accent" : "bg-panel border-border text-muted hover:border-accent/50 hover:text-ink")}>All</Link>
           <Link href="?type=character" className={cn("px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded-md border transition-all whitespace-nowrap", filters.type === 'character' ? "bg-accent/10 border-accent/20 text-accent" : "bg-panel border-border text-muted hover:border-accent/50 hover:text-ink")}>Characters</Link>
           <Link href="?type=location" className={cn("px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded-md border transition-all whitespace-nowrap", filters.type === 'location' ? "bg-accent/10 border-accent/20 text-accent" : "bg-panel border-border text-muted hover:border-accent/50 hover:text-ink")}>Locations</Link>
           <Link href="?type=event" className={cn("px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded-md border transition-all whitespace-nowrap", filters.type === 'event' ? "bg-accent/10 border-accent/20 text-accent" : "bg-panel border-border text-muted hover:border-accent/50 hover:text-ink")}>Events</Link>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="p-2 space-y-0.5">
          {entities.map((entity) => (
            <Link
              key={entity.id}
              href={`/articles/${entity.id}`}
              className={cn(
                "group flex items-center justify-between px-3 py-3 rounded-lg transition-all border border-transparent",
                activeId === entity.id 
                  ? "bg-accent/10 border-accent/20 shadow-sm" 
                  : "hover:bg-bg hover:border-border"
              )}
            >
              <div className="flex flex-col gap-0.5 min-w-0">
                <div className="flex items-center gap-2">
                  <span className={cn(
                    "text-sm font-medium truncate transition-colors",
                    activeId === entity.id ? "text-accent" : "text-ink"
                  )}>
                    {entity.title}
                  </span>
                  {entity.isUnread && (
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" title="Unread updates" />
                  )}
                </div>
                <div className="flex items-center gap-2 text-[10px] text-muted uppercase tracking-wider">
                  <span>{entity.type}</span>
                  <span>•</span>
                  <span className="opacity-70 group-hover:opacity-100 transition-opacity">
                    {new Date(entity.updatedAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
              
              <svg 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="currentColor" 
                strokeWidth="2" 
                className={cn(
                  "w-4 h-4 text-muted transition-transform opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0",
                  activeId === entity.id && "opacity-100 translate-x-0 text-accent"
                )}
              >
                <polyline points="9 18 15 12 9 6"></polyline>
              </svg>
            </Link>
          ))}
          
          {entities.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-muted gap-2">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-8 h-8 opacity-50">
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
                <line x1="12" y1="18" x2="12" y2="12"></line>
                <line x1="9" y1="15" x2="15" y2="15"></line>
              </svg>
              <p className="text-xs font-medium">No entities found</p>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
