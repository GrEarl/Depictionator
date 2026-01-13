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

const LOCATION_TYPES = [
  "capital",
  "city",
  "village",
  "fortress",
  "dungeon",
  "ruin",
  "landmark",
  "region",
  "outpost",
  "camp",
  "port",
  "temple",
  "mine",
  "gate",
  "road",
  "other"
];

const SHAPES = ["circle", "square", "diamond", "triangle", "hex", "star"];

export default async function MapsPage() {
  const user = await requireUser();
  const workspace = await getActiveWorkspace(user.id);
  const markerStyles = workspace
    ? await prisma.markerStyle.findMany({
        where: { workspaceId: workspace.id },
        orderBy: { createdAt: "desc" }
      })
    : [];

  return (
    <div className="panel">
      <h2>Maps</h2>
      <FilterSummary />
      {!workspace && (
        <p className="muted">Select a workspace to manage maps, pins, and styles.</p>
      )}

      {workspace && (
        <>
          <section className="panel">
            <h3>Marker styles</h3>
            <form action="/api/marker-styles/create" method="post" className="form-grid">
              <input type="hidden" name="workspaceId" value={workspace.id} />
              <label>
                Name
                <input name="name" required />
              </label>
              <label>
                Target
                <select name="target" required>
                  <option value="event">Event</option>
                  <option value="location">Location</option>
                  <option value="path">Path</option>
                </select>
              </label>
              <label>
                Event type (optional)
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
                Location type (optional)
                <select name="locationType">
                  <option value="">--</option>
                  {LOCATION_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Shape
                <select name="shape" required>
                  {SHAPES.map((shape) => (
                    <option key={shape} value={shape}>
                      {shape}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Color
                <input name="color" defaultValue="#4b6ea8" />
              </label>
              <label>
                Icon key
                <input name="iconKey" placeholder="optional" />
              </label>
              <button type="submit">Add style</button>
            </form>
            <ul>
              {markerStyles.map((style) => (
                <li key={style.id} className="list-row">
                  <div>
                    <strong>{style.name}</strong> · {style.target} · {style.shape} · {style.color}
                    {style.eventType && <span className="muted"> · {style.eventType}</span>}
                    {style.locationType && <span className="muted"> · {style.locationType}</span>}
                  </div>
                  <form action="/api/marker-styles/delete" method="post">
                    <input type="hidden" name="workspaceId" value={workspace.id} />
                    <input type="hidden" name="styleId" value={style.id} />
                    <button type="submit" className="link-button">Delete</button>
                  </form>
                </li>
              ))}
              {markerStyles.length === 0 && (
                <li className="muted">No marker styles yet.</li>
              )}
            </ul>
          </section>

          <section className="panel">
            <h3>Map layers & pins</h3>
            <p className="muted">
              Map hierarchy, pins, and paths will appear here. Marker styles above control shapes/colors
              by event type or location type.
            </p>
          </section>
        </>
      )}
    </div>
  );
}
