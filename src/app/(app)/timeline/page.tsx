import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getActiveWorkspace } from "@/lib/workspaces";
import { LlmContext } from "@/components/LlmContext";
import { VisualTimeline } from "@/components/VisualTimeline";
import type { Prisma } from "@prisma/client";
import Link from "next/link";

const EVENT_TYPES = [
  "battle", "travel", "political", "diplomatic", "discovery", "ritual", "disaster", "economic", "cultural", "mystery", "other"
];

type SearchParams = { [key: string]: string | string[] | undefined };
type PageProps = { searchParams: Promise<SearchParams> };

export default async function TimelinePage({ searchParams }: PageProps) {
  const user = await requireUser();
  const workspace = await getActiveWorkspace(user.id);
  const resolvedSearchParams = await searchParams;
  
  const eraFilter = String(resolvedSearchParams.era ?? "all");
  const chapterFilter = String(resolvedSearchParams.chapter ?? "all");
  const viewpointFilter = String(resolvedSearchParams.viewpoint ?? "canon");
  const mode = String(resolvedSearchParams.mode ?? "canon");
  const query = String(resolvedSearchParams.q ?? "").trim();
  const activeTab = String(resolvedSearchParams.tab ?? "visual");

  const worldCondition = eraFilter === "all" ? {} : {
    OR: [{ worldStart: eraFilter }, { worldEnd: eraFilter }, { worldStart: null, worldEnd: null }]
  };
  const storyCondition = chapterFilter === "all" ? {} : {
    OR: [{ storyChapterId: chapterFilter }, { storyChapterId: null }]
  };
  const eventCondition: Prisma.EventWhereInput = {
    ...(query ? { title: { contains: query, mode: "insensitive" } } : {})
  };

  const buildUrl = (overrides: Record<string, string | undefined>) => {
    const params = new URLSearchParams();
    const merged = {
      era: eraFilter,
      chapter: chapterFilter,
      viewpoint: viewpointFilter,
      mode,
      q: query || undefined,
      tab: activeTab,
      ...overrides
    };
    Object.entries(merged).forEach(([key, value]) => {
      if (value !== undefined && value !== "") {
        params.set(key, value);
      }
    });
    const qs = params.toString();
    return qs ? `?${qs}` : "";
  };

  const [timelines, eras, chapters, markerStyles] = workspace ? await Promise.all([
    prisma.timeline.findMany({
      where: { workspaceId: workspace.id, softDeletedAt: null },
      include: {
        events: {
          where: { softDeletedAt: null, ...worldCondition, ...storyCondition, ...eventCondition },
          orderBy: { storyOrder: "asc" }
        }
      },
      orderBy: { name: "asc" }
    }),
    prisma.era.findMany({ where: { workspaceId: workspace.id, softDeletedAt: null }, orderBy: { sortKey: "asc" } }),
    prisma.chapter.findMany({ where: { workspaceId: workspace.id, softDeletedAt: null }, orderBy: { orderIndex: "asc" } }),
    prisma.markerStyle.findMany({ where: { workspaceId: workspace.id, softDeletedAt: null, target: "event" } })
  ]) : [[], [], [], []];

  if (!workspace) return <div className="panel">Select a workspace.</div>;

  return (
    <div className="layout-3-pane">
      <LlmContext
        value={{
          type: "timeline",
          timelineIds: timelines.map((t) => t.id),
          filters: { eraFilter, chapterFilter, viewpointFilter, mode, query }
        }}
      />

      {/* Pane 1: Left - Context / Eras & Chapters */}
      <aside className="pane-left">
        <div className="pane-header">
           <h3>Context</h3>
           <form method="get" className="quick-search">
             <input type="hidden" name="era" value={eraFilter} />
             <input type="hidden" name="chapter" value={chapterFilter} />
             <input type="hidden" name="viewpoint" value={viewpointFilter} />
             <input type="hidden" name="mode" value={mode} />
             <input type="hidden" name="tab" value={activeTab} />
             <input name="q" defaultValue={query} placeholder="Search events..." />
           </form>
        </div>
        <div className="context-list">
          <section className="context-section">
             <h4>Eras</h4>
             <div className="filter-chips">
               <Link href={buildUrl({ era: "all" })} className={`chip ${eraFilter === 'all' ? 'active' : ''}`}>All</Link>
               {eras.map(era => (
                 <Link key={era.id} href={buildUrl({ era: era.id })} className={`chip ${eraFilter === era.id ? 'active' : ''}`}>
                    {era.name}
                 </Link>
               ))}
             </div>
          </section>
          <section className="context-section">
             <h4>Chapters</h4>
             <div className="filter-chips">
               <Link href={buildUrl({ chapter: "all" })} className={`chip ${chapterFilter === 'all' ? 'active' : ''}`}>All</Link>
               {chapters.map(ch => (
                 <Link key={ch.id} href={buildUrl({ chapter: ch.id })} className={`chip ${chapterFilter === ch.id ? 'active' : ''}`}>
                    {ch.name}
                 </Link>
               ))}
             </div>
          </section>
        </div>
      </aside>

      {/* Pane 2: Center - Timeline View */}
      <main className="pane-center">
        <div className="pane-header-tabs">
           <Link href={buildUrl({ tab: "visual" })} className={`tab-link ${activeTab === 'visual' ? 'active' : ''}`}>Visual Lanes</Link>
           <Link href={buildUrl({ tab: "list" })} className={`tab-link ${activeTab === 'list' ? 'active' : ''}`}>Event List</Link>
        </div>
        
        <div className="timeline-content">
          {activeTab === 'visual' ? (
            <VisualTimeline timelines={timelines as any} chapters={chapters} />
          ) : (
            <div className="event-list-view p-4">
              {timelines.map(t => (
                <section key={t.id} className="timeline-group">
                   <h4>{t.name}</h4>
                   {t.events.map(e => (
                     <div key={e.id} className="list-row">
                        <div>
                          <strong>{e.title}</strong>
                          <div className="muted text-xs">{e.worldStart || 'No date'} ﾂｷ {e.eventType}</div>
                        </div>
                        <Link href={`/timeline?editEvent=${e.id}`} className="link-button">Edit</Link>
                     </div>
                   ))}
                </section>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Pane 3: Right - Actions / Forms */}
      <aside className="pane-right-drawer">
         <div className="pane-header">
            <h3>Management</h3>
         </div>
         <div className="drawer-content">
            <details className="action-details" open>
               <summary>Create Event</summary>
               <form action="/api/events/create" method="post" className="form-grid p-2">
                  <input type="hidden" name="workspaceId" value={workspace.id} />
                  <label>Timeline <select name="timelineId" required>{timelines.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
                  <label>Title <input name="title" required /></label>
                  <label>Type <select name="eventType">{EVENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}</select></label>
                  <label>World Start <input name="worldStart" placeholder="Era/Year" /></label>
                  <label>Chapter <select name="storyChapterId"><option value="">--</option>{chapters.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
                  <label>Order <input name="storyOrder" type="number" defaultValue={0} /></label>
                  <button type="submit" className="btn-primary">Add Event</button>
               </form>
            </details>

            <details className="action-details">
               <summary>Timelines & Eras</summary>
               <div className="p-2">
                 <form action="/api/timelines/create" method="post" className="form-grid mb-4">
                    <input type="hidden" name="workspaceId" value={workspace.id} />
                    <label>New Timeline Name <input name="name" required /></label>
                    <button type="submit" className="btn-secondary">Create Timeline</button>
                 </form>
                 <form action="/api/eras/create" method="post" className="form-grid">
                    <input type="hidden" name="workspaceId" value={workspace.id} />
                    <label>New Era Name <input name="name" required /></label>
                    <label>Sort Key <input name="sortKey" type="number" defaultValue={eras.length} /></label>
                    <button type="submit" className="btn-secondary">Create Era</button>
                 </form>
               </div>
            </details>
         </div>
      </aside>
    </div>
  );
}
