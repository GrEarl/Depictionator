import { FilterSummary } from "@/components/FilterSummary";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getActiveWorkspace } from "@/lib/workspaces";
import { LlmContext } from "@/components/LlmContext";
import { MarkdownEditor } from "@/components/MarkdownEditor";

const EVENT_TYPES = [
  "battle",
  "travel",
  "political",
  "diplomatic",
  "discovery",
  "ritual",
  "disaster",
  "economic",
  "cultural",
  "mystery",
  "other"
];

type TimelineEventSummary = {
  id: string;
  title: string;
  worldStart: string | null;
  worldEnd: string | null;
  storyOrder: number | null;
  storyChapterId: string | null;
  eventType: string | null;
  locationMapId: string | null;
  involvedEntityIds: string[];
};
type TimelineSummary = {
  id: string;
  name: string;
  type: string;
  events: TimelineEventSummary[];
};
type TimelineArchiveSummary = { id: string; name: string };
type EraSummary = {
  id: string;
  name: string;
  worldStart: string | null;
  worldEnd: string | null;
};
type ChapterSummary = { id: string; name: string; orderIndex: number };
type EventListSummary = {
  id: string;
  title: string;
  timeline: { name: string | null } | null;
};
type MarkerStyleSummary = { id: string; name: string };


type SearchParams = { [key: string]: string | string[] | undefined };

type PageProps = { searchParams: Promise<SearchParams> };

export default async function TimelinePage({ searchParams }: PageProps) {
  const user = await requireUser();
  const workspace = await getActiveWorkspace(user.id);
  const resolvedSearchParams = await searchParams;
  const eraFilter = String(resolvedSearchParams.era ?? "all");
  const chapterFilter = String(resolvedSearchParams.chapter ?? "all");

  const worldCondition =
    eraFilter === "all"
      ? {}
      : {
          OR: [{ worldStart: eraFilter }, { worldEnd: eraFilter }, { worldStart: null, worldEnd: null }]
        };

  const storyCondition =
    chapterFilter === "all"
      ? {}
      : { OR: [{ storyChapterId: chapterFilter }, { storyChapterId: null }] };
  const timelines: TimelineSummary[] = workspace
    ? await prisma.timeline.findMany({
        where: { workspaceId: workspace.id, softDeletedAt: null },
        include: {
          events: {
            where: { softDeletedAt: null, ...worldCondition, ...storyCondition },
            orderBy: { createdAt: "desc" }
          }
        },
        orderBy: { name: "asc" }
      })
    : [];
  const archivedTimelines: TimelineArchiveSummary[] = workspace
    ? await prisma.timeline.findMany({
        where: { workspaceId: workspace.id, softDeletedAt: { not: null } },
        orderBy: { name: "asc" }
      })
    : [];
  const eras: EraSummary[] = workspace
    ? await prisma.era.findMany({
        where: { workspaceId: workspace.id, softDeletedAt: null },
        orderBy: { sortKey: "asc" }
      })
    : [];
  const archivedEras: EraSummary[] = workspace
    ? await prisma.era.findMany({
        where: { workspaceId: workspace.id, softDeletedAt: { not: null } },
        orderBy: { sortKey: "asc" }
      })
    : [];
  const chapters: ChapterSummary[] = workspace
    ? await prisma.chapter.findMany({
        where: { workspaceId: workspace.id, softDeletedAt: null },
        orderBy: { orderIndex: "asc" }
      })
    : [];
  const allEvents: EventListSummary[] = workspace
    ? await prisma.event.findMany({
        where: { workspaceId: workspace.id, softDeletedAt: null },
        include: { timeline: true },
        orderBy: { createdAt: "desc" }
      })
    : [];
  const markerStyles: MarkerStyleSummary[] = workspace
    ? await prisma.markerStyle.findMany({
        where: { workspaceId: workspace.id, softDeletedAt: null, target: "event" },
        orderBy: { createdAt: "desc" }
      })
    : [];
  const archivedChapters: ChapterSummary[] = workspace
    ? await prisma.chapter.findMany({
        where: { workspaceId: workspace.id, softDeletedAt: { not: null } },
        orderBy: { orderIndex: "asc" }
      })
    : [];

  const activeTab = String(resolvedSearchParams.tab ?? "world_history");
  const filteredTimelines = timelines.filter(t => 
    activeTab === 'all' || t.type === activeTab || (activeTab === 'world_history' && t.type === 'world_history') || (activeTab === 'game_storyline' && t.type === 'game_storyline')
  );

  return (
    <div className="panel">
      <LlmContext
        value={{
          type: "timeline",
          timelineIds: timelines.map((timeline) => timeline.id),
          filters: { eraFilter, chapterFilter }
        }}
      />
      <h2>Timeline</h2>
      <FilterSummary />
      
      <div className="link-grid" style={{ marginBottom: '16px' }}>
        <a href="?tab=world_history" style={{ fontWeight: activeTab === 'world_history' ? 'bold' : 'normal', borderColor: activeTab === 'world_history' ? 'var(--accent)' : 'var(--border)' }}>
          World History
        </a>
        <a href="?tab=game_storyline" style={{ fontWeight: activeTab === 'game_storyline' ? 'bold' : 'normal', borderColor: activeTab === 'game_storyline' ? 'var(--accent)' : 'var(--border)' }}>
          Game Storyline
        </a>
        <a href="?tab=all" style={{ fontWeight: activeTab === 'all' ? 'bold' : 'normal', borderColor: activeTab === 'all' ? 'var(--accent)' : 'var(--border)' }}>
          All
        </a>
      </div>

      {!workspace && <p className="muted">Select a workspace to manage timelines.</p>}

      {workspace && (
        <>
          <section className="panel">
            <h3>Timelines ({activeTab.replace('_', ' ')})</h3>
            {filteredTimelines.map((timeline) => (
              <div key={timeline.id} className="panel">
                <div className="list-row">
                  <strong>{timeline.name}</strong>
                  <span className="muted">{timeline.type}</span>
                </div>
                <ul>
                  {timeline.events.map((event) => (
                    <li key={event.id} className="list-row" style={{ alignItems: 'flex-start' }}>
                      <div>
                        <div style={{ fontWeight: 600 }}>{event.title}</div>
                        <div className="muted" style={{ fontSize: '13px' }}>
                           {event.worldStart ? `World: ${event.worldStart}` : ''} 
                           {(event.worldStart && (event.storyOrder || event.storyChapterId)) ? ' ﾂｷ ' : ''}
                           {event.storyChapterId ? `Chapter: ${chapters.find(c => c.id === event.storyChapterId)?.name ?? event.storyChapterId}` : ''}
                           {(event.storyChapterId && event.storyOrder) ? ' / ' : ''}
                           {event.storyOrder ? `Order: ${event.storyOrder}` : ''}
                        </div>
                        <div className="link-grid" style={{ marginTop: '4px', fontSize: '12px' }}>
                          {event.locationMapId && (
                            <a href={`/maps?map=${event.locationMapId}`}>View on Map</a>
                          )}
                          {event.involvedEntityIds.length > 0 && (
                            <a href={`/articles/${event.involvedEntityIds[0]}`}>
                              Related Entity {event.involvedEntityIds.length > 1 ? `(+${event.involvedEntityIds.length - 1})` : ''}
                            </a>
                          )}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                         <span className="badge">{event.eventType}</span>
                         <form action="/api/watches/toggle" method="post">
                           <input type="hidden" name="workspaceId" value={workspace.id} />
                           <input type="hidden" name="targetType" value="event" />
                           <input type="hidden" name="targetId" value={event.id} />
                           <button type="submit" className="link-button">Watch</button>
                         </form>
                      </div>
                    </li>
                  ))}
                  {timeline.events.length === 0 && <li className="muted">No events.</li>}
                </ul>
                <div className="list-row">
                  <form action="/api/watches/toggle" method="post">
                    <input type="hidden" name="workspaceId" value={workspace.id} />
                    <input type="hidden" name="targetType" value="timeline" />
                    <input type="hidden" name="targetId" value={timeline.id} />
                    <button type="submit" className="link-button">Watch</button>
                  </form>
                  <form action="/api/archive" method="post">
                    <input type="hidden" name="workspaceId" value={workspace.id} />
                    <input type="hidden" name="targetType" value="timeline" />
                    <input type="hidden" name="targetId" value={timeline.id} />
                    <button type="submit" className="link-button">Archive timeline</button>
                  </form>
                </div>
              </div>
            ))}
            {filteredTimelines.length === 0 && <p className="muted">No timelines found for this tab.</p>}
          </section>

          <section className="panel">
            <h3>Create timeline</h3>
            <form action="/api/timelines/create" method="post" className="form-grid">
              <input type="hidden" name="workspaceId" value={workspace.id} />
              <label>
                Name
                <input name="name" required />
              </label>
              <label>
                Type
                <select name="type">
                  <option value="world_history">World History</option>
                  <option value="game_storyline">Game Storyline</option>
                  <option value="dev_meta">Dev Meta</option>
                </select>
              </label>
              <button type="submit">Add</button>
            </form>
          </section>

          <section className="panel">
            <h3>Update timeline</h3>
            <form action="/api/timelines/update" method="post" className="form-grid">
              <input type="hidden" name="workspaceId" value={workspace.id} />
              <label>
                Timeline
                <select name="timelineId" required>
                  {timelines.map((timeline) => (
                    <option key={timeline.id} value={timeline.id}>
                      {timeline.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Name
                <input name="name" />
              </label>
              <label>
                Type
                <select name="type">
                  <option value="">--</option>
                  <option value="world_history">World History</option>
                  <option value="game_storyline">Game Storyline</option>
                  <option value="dev_meta">Dev Meta</option>
                </select>
              </label>
              <button type="submit">Update timeline</button>
            </form>
          </section>

          <section className="panel">
            <h3>Create era</h3>
            <form action="/api/eras/create" method="post" className="form-grid">
              <input type="hidden" name="workspaceId" value={workspace.id} />
              <label>
                Name
                <input name="name" required />
              </label>
              <label>
                World start
                <input name="worldStart" />
              </label>
              <label>
                World end
                <input name="worldEnd" />
              </label>
              <label>
                Sort key
                <input name="sortKey" type="number" required />
              </label>
              <button type="submit">Add era</button>
            </form>
            <ul>
              {eras.map((era) => (
                <li key={era.id} className="list-row">
                  <div>{era.name}</div>
                  <span className="muted">{era.worldStart} - {era.worldEnd}</span>
                  <form action="/api/archive" method="post">
                    <input type="hidden" name="workspaceId" value={workspace.id} />
                    <input type="hidden" name="targetType" value="era" />
                    <input type="hidden" name="targetId" value={era.id} />
                    <button type="submit" className="link-button">Archive</button>
                  </form>
                </li>
              ))}
            </ul>
          </section>

          <section className="panel">
            <h3>Update era</h3>
            <form action="/api/eras/update" method="post" className="form-grid">
              <input type="hidden" name="workspaceId" value={workspace.id} />
              <label>
                Era
                <select name="eraId" required>
                  {eras.map((era) => (
                    <option key={era.id} value={era.id}>
                      {era.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Name
                <input name="name" />
              </label>
              <label>
                World start
                <input name="worldStart" />
              </label>
              <label>
                World end
                <input name="worldEnd" />
              </label>
              <label>
                Sort key
                <input name="sortKey" type="number" />
              </label>
              <button type="submit">Update era</button>
            </form>
          </section>
          <section className="panel">
            <h3>Archived eras</h3>
            <ul>
              {archivedEras.map((era) => (
                <li key={era.id} className="list-row">
                  <span>{era.name}</span>
                  <form action="/api/restore" method="post">
                    <input type="hidden" name="workspaceId" value={workspace.id} />
                    <input type="hidden" name="targetType" value="era" />
                    <input type="hidden" name="targetId" value={era.id} />
                    <button type="submit" className="link-button">Restore</button>
                  </form>
                </li>
              ))}
              {archivedEras.length === 0 && <li className="muted">No archived eras.</li>}
            </ul>
          </section>

          <section className="panel">
            <h3>Create chapter</h3>
            <form action="/api/chapters/create" method="post" className="form-grid">
              <input type="hidden" name="workspaceId" value={workspace.id} />
              <label>
                Name
                <input name="name" required />
              </label>
              <label>
                Order
                <input name="orderIndex" type="number" required />
              </label>
              <label>
                Description
                <textarea name="description" rows={3} />
              </label>
              <button type="submit">Add chapter</button>
            </form>
            <ul>
              {chapters.map((chapter) => (
                <li key={chapter.id} className="list-row">
                  <div>{chapter.name}</div>
                  <span className="muted">Order {chapter.orderIndex}</span>
                  <form action="/api/archive" method="post">
                    <input type="hidden" name="workspaceId" value={workspace.id} />
                    <input type="hidden" name="targetType" value="chapter" />
                    <input type="hidden" name="targetId" value={chapter.id} />
                    <button type="submit" className="link-button">Archive</button>
                  </form>
                </li>
              ))}
            </ul>
          </section>

          <section className="panel">
            <h3>Update chapter</h3>
            <form action="/api/chapters/update" method="post" className="form-grid">
              <input type="hidden" name="workspaceId" value={workspace.id} />
              <label>
                Chapter
                <select name="chapterId" required>
                  {chapters.map((chapter) => (
                    <option key={chapter.id} value={chapter.id}>
                      {chapter.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Name
                <input name="name" />
              </label>
              <label>
                Order
                <input name="orderIndex" type="number" />
              </label>
              <label>
                Description
                <textarea name="description" rows={3} />
              </label>
              <button type="submit">Update chapter</button>
            </form>
          </section>
          <section className="panel">
            <h3>Archived chapters</h3>
            <ul>
              {archivedChapters.map((chapter) => (
                <li key={chapter.id} className="list-row">
                  <span>{chapter.name}</span>
                  <form action="/api/restore" method="post">
                    <input type="hidden" name="workspaceId" value={workspace.id} />
                    <input type="hidden" name="targetType" value="chapter" />
                    <input type="hidden" name="targetId" value={chapter.id} />
                    <button type="submit" className="link-button">Restore</button>
                  </form>
                </li>
              ))}
              {archivedChapters.length === 0 && <li className="muted">No archived chapters.</li>}
            </ul>
          </section>

          <section className="panel">
            <h3>Create event</h3>
            <form action="/api/events/create" method="post" className="form-grid">
              <input type="hidden" name="workspaceId" value={workspace.id} />
              <label>
                Timeline
                <select name="timelineId" required>
                  {timelines.map((timeline) => (
                    <option key={timeline.id} value={timeline.id}>
                      {timeline.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Title
                <input name="title" required />
              </label>
              <label>
                Event type
                <select name="eventType">
                  {EVENT_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Marker style
                <select name="markerStyleId">
                  <option value="">--</option>
                  {markerStyles.map((style) => (
                    <option key={style.id} value={style.id}>
                      {style.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                World start
                <input name="worldStart" />
              </label>
              <label>
                World end
                <input name="worldEnd" />
              </label>
              <label>
                Story order
                <input name="storyOrder" type="number" />
              </label>
              <label>
                Story chapter ID
                <input name="storyChapterId" />
              </label>
              <label>
                Location map ID
                <input name="locationMapId" />
              </label>
              <label>
                Location pin ID
                <input name="locationPinId" />
              </label>
              <label>
                Location X
                <input name="locationX" type="number" step="0.1" />
              </label>
              <label>
                Location Y
                <input name="locationY" type="number" step="0.1" />
              </label>
              <MarkdownEditor name="summaryMd" label="Summary (Markdown)" rows={4} />
              <label>
                Involved Entity IDs (comma)
                <input name="involvedEntityIds" />
              </label>
              <button type="submit">Add event</button>
            </form>
          </section>

          <section className="panel">
            <h3>Update event</h3>
            <form action="/api/events/update" method="post" className="form-grid">
              <input type="hidden" name="workspaceId" value={workspace.id} />
              <label>
                Event
                <select name="eventId" required>
                  {allEvents.map((event) => (
                    <option key={event.id} value={event.id}>
                      {event.title} ﾂｷ {event.timeline?.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Timeline ID
                <input name="timelineId" />
              </label>
              <label>
                Title
                <input name="title" />
              </label>
              <label>
                Event type
                <select name="eventType">
                  <option value="">--</option>
                  {EVENT_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Marker style
                <select name="markerStyleId">
                  <option value="">--</option>
                  {markerStyles.map((style) => (
                    <option key={style.id} value={style.id}>
                      {style.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                World start
                <input name="worldStart" />
              </label>
              <label>
                World end
                <input name="worldEnd" />
              </label>
              <label>
                Story order
                <input name="storyOrder" type="number" />
              </label>
              <label>
                Story chapter ID
                <input name="storyChapterId" />
              </label>
              <label>
                Location map ID
                <input name="locationMapId" />
              </label>
              <label>
                Location pin ID
                <input name="locationPinId" />
              </label>
              <label>
                Location X
                <input name="locationX" type="number" step="0.1" />
              </label>
              <label>
                Location Y
                <input name="locationY" type="number" step="0.1" />
              </label>
              <MarkdownEditor name="summaryMd" label="Summary (Markdown)" rows={4} />
              <label>
                Involved Entity IDs (comma)
                <input name="involvedEntityIds" />
              </label>
              <button type="submit">Update event</button>
            </form>
          </section>

          <section className="panel">
            <h3>Archived timelines</h3>
            <ul>
              {archivedTimelines.map((timeline) => (
                <li key={timeline.id} className="list-row">
                  <span>{timeline.name}</span>
                  <form action="/api/restore" method="post">
                    <input type="hidden" name="workspaceId" value={workspace.id} />
                    <input type="hidden" name="targetType" value="timeline" />
                    <input type="hidden" name="targetId" value={timeline.id} />
                    <button type="submit" className="link-button">Restore</button>
                  </form>
                </li>
              ))}
              {archivedTimelines.length === 0 && <li className="muted">No archived timelines.</li>}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}

