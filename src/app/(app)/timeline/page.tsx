import { FilterSummary } from "@/components/FilterSummary";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getActiveWorkspace } from "@/lib/workspaces";

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

type SearchParams = { [key: string]: string | string[] | undefined };

export default async function TimelinePage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireUser();
  const workspace = await getActiveWorkspace(user.id);
  const eraFilter = String(searchParams.era ?? "all");
  const chapterFilter = String(searchParams.chapter ?? "all");

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
  const timelines = workspace
    ? await prisma.timeline.findMany({
        where: { workspaceId: workspace.id, softDeletedAt: null },
        include: {
          events: {
            where: { softDeletedAt: null, ...worldCondition, ...storyCondition },
            orderBy: { createdAt: "desc" }
          }
        }
      })
    : [];
  const archivedTimelines = workspace
    ? await prisma.timeline.findMany({
        where: { workspaceId: workspace.id, softDeletedAt: { not: null } },
        orderBy: { createdAt: "desc" }
      })
    : [];
  const eras = workspace
    ? await prisma.era.findMany({
        where: { workspaceId: workspace.id, softDeletedAt: null },
        orderBy: { sortKey: "asc" }
      })
    : [];
  const archivedEras = workspace
    ? await prisma.era.findMany({
        where: { workspaceId: workspace.id, softDeletedAt: { not: null } },
        orderBy: { sortKey: "asc" }
      })
    : [];
  const chapters = workspace
    ? await prisma.chapter.findMany({
        where: { workspaceId: workspace.id, softDeletedAt: null },
        orderBy: { orderIndex: "asc" }
      })
    : [];
  const markerStyles = workspace
    ? await prisma.markerStyle.findMany({
        where: { workspaceId: workspace.id, softDeletedAt: null, target: "event" },
        orderBy: { createdAt: "desc" }
      })
    : [];
  const archivedChapters = workspace
    ? await prisma.chapter.findMany({
        where: { workspaceId: workspace.id, softDeletedAt: { not: null } },
        orderBy: { orderIndex: "asc" }
      })
    : [];

  return (
    <div className="panel">
      <h2>Timeline</h2>
      <FilterSummary />
      {!workspace && <p className="muted">Select a workspace to manage timelines.</p>}

      {workspace && (
        <>
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
              <label>
                Summary (Markdown)
                <textarea name="summaryMd" rows={3} />
              </label>
              <button type="submit">Add event</button>
            </form>
          </section>

          <section className="panel">
            <h3>Timelines</h3>
            {timelines.map((timeline) => (
              <div key={timeline.id} className="panel">
                <strong>{timeline.name}</strong>
                <div className="muted">{timeline.type}</div>
                <ul>
                  {timeline.events.map((event) => (
                    <li key={event.id} className="list-row">
                      <div>{event.title}</div>
                      <span className="muted">{event.eventType}</span>
                      <form action="/api/archive" method="post">
                        <input type="hidden" name="workspaceId" value={workspace.id} />
                        <input type="hidden" name="targetType" value="event" />
                        <input type="hidden" name="targetId" value={event.id} />
                        <button type="submit" className="link-button">Archive</button>
                      </form>
                    </li>
                  ))}
                  {timeline.events.length === 0 && <li className="muted">No events.</li>}
                </ul>
                <form action="/api/archive" method="post">
                  <input type="hidden" name="workspaceId" value={workspace.id} />
                  <input type="hidden" name="targetType" value="timeline" />
                  <input type="hidden" name="targetId" value={timeline.id} />
                  <button type="submit" className="link-button">Archive timeline</button>
                </form>
              </div>
            ))}
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
