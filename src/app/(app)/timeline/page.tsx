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

export default async function TimelinePage() {
  const user = await requireUser();
  const workspace = await getActiveWorkspace(user.id);
  const timelines = workspace
    ? await prisma.timeline.findMany({
        where: { workspaceId: workspace.id },
        include: { events: { orderBy: { createdAt: "desc" } } }
      })
    : [];
  const eras = workspace
    ? await prisma.era.findMany({
        where: { workspaceId: workspace.id },
        orderBy: { sortKey: "asc" }
      })
    : [];
  const chapters = workspace
    ? await prisma.chapter.findMany({
        where: { workspaceId: workspace.id },
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
                </li>
              ))}
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
                </li>
              ))}
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
                    </li>
                  ))}
                  {timeline.events.length === 0 && <li className="muted">No events.</li>}
                </ul>
              </div>
            ))}
          </section>
        </>
      )}
    </div>
  );
}
