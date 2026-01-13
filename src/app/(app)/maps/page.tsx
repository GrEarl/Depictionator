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
  const maps = workspace
    ? await prisma.map.findMany({
        where: { workspaceId: workspace.id, softDeletedAt: null },
        include: { pins: true, paths: true },
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
            <h3>Create map</h3>
            <form action="/api/maps/create" method="post" className="form-grid">
              <input type="hidden" name="workspaceId" value={workspace.id} />
              <label>
                Title
                <input name="title" required />
              </label>
              <label>
                Parent map ID (optional)
                <input name="parentMapId" />
              </label>
              <button type="submit">Add map</button>
            </form>
          </section>

          <section className="panel">
            <h3>Create pin</h3>
            <form action="/api/pins/create" method="post" className="form-grid">
              <input type="hidden" name="workspaceId" value={workspace.id} />
              <label>
                Map
                <select name="mapId" required>
                  {maps.map((map) => (
                    <option key={map.id} value={map.id}>
                      {map.title}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                X
                <input name="x" type="number" step="0.1" required />
              </label>
              <label>
                Y
                <input name="y" type="number" step="0.1" required />
              </label>
              <label>
                Label
                <input name="label" />
              </label>
              <label>
                Location type
                <select name="locationType">
                  {LOCATION_TYPES.map((type) => (
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
                Override shape (optional)
                <select name="markerShape">
                  <option value="">--</option>
                  {SHAPES.map((shape) => (
                    <option key={shape} value={shape}>
                      {shape}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Override color (optional)
                <input name="markerColor" />
              </label>
              <button type="submit">Add pin</button>
            </form>
          </section>

          <section className="panel">
            <h3>Create path</h3>
            <form action="/api/paths/create" method="post" className="form-grid">
              <input type="hidden" name="workspaceId" value={workspace.id} />
              <label>
                Map
                <select name="mapId" required>
                  {maps.map((map) => (
                    <option key={map.id} value={map.id}>
                      {map.title}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Polyline JSON
                <textarea name="polyline" rows={3} defaultValue="[]" />
              </label>
              <label>
                Arrow style
                <select name="arrowStyle">
                  <option value="arrow">Arrow</option>
                  <option value="dashed">Dashed</option>
                  <option value="dotted">Dotted</option>
                </select>
              </label>
              <label>
                Stroke color
                <input name="strokeColor" />
              </label>
              <label>
                Stroke width
                <input name="strokeWidth" type="number" />
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
              <button type="submit">Add path</button>
            </form>
          </section>

          <section className="panel">
            <h3>Maps overview</h3>
            {maps.map((map) => (
              <div key={map.id} className="panel">
                <strong>{map.title}</strong>
                <div className="muted">Pins: {map.pins.length} · Paths: {map.paths.length}</div>
              </div>
            ))}
          </section>
        </>
      )}
    </div>
  );
}
