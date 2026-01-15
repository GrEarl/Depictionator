import { FilterSummary } from "@/components/FilterSummary";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getActiveWorkspace } from "@/lib/workspaces";
import { LlmContext } from "@/components/LlmContext";
import { MapEditor } from "@/components/MapEditor";
import { WikiMapImportPanel } from "@/components/WikiMapImportPanel";

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

type SearchParams = { [key: string]: string | string[] | undefined };

type PageProps = { searchParams: Promise<SearchParams> };
type MapReadState = { targetId: string; lastReadAt: Date };
type MarkerStyleSummary = {
  id: string;
  name: string;
  target: string;
  shape: string;
  color: string;
  eventType: string | null;
  locationType: string | null;
};
type MapPinSummary = {
  id: string;
  x: number;
  y: number;
  label: string | null;
  entityId: string | null;
  markerShape: string | null;
  markerColor: string | null;
  markerStyleId: string | null;
  markerStyle: MarkerStyleSummary | null;
  truthFlag: string | null;
  locationType: string | null;
  viewpointId: string | null;
  worldFrom: string | null;
  worldTo: string | null;
  storyFromChapterId: string | null;
  storyToChapterId: string | null;
};
type MapPathSummary = {
  id: string;
  polyline: unknown;
  arrowStyle: string | null;
  strokeColor: string | null;
  strokeWidth: number | null;
  markerStyle: MarkerStyleSummary | null;
};
type MapSummary = {
  id: string;
  title: string;
  parentMapId: string | null;
  bounds: unknown;
  imageAssetId: string | null;
  pins: MapPinSummary[];
  paths: MapPathSummary[];
  updatedAt: Date;
};
type ArchivedMapSummary = { id: string; title: string };
type PinWithMapSummary = {
  id: string;
  label: string | null;
  map: { title: string | null } | null;
};
type PathWithMapSummary = { id: string; map: { title: string | null } | null };

export default async function MapsPage({ searchParams }: PageProps) {
  const user = await requireUser();
  const workspace = await getActiveWorkspace(user.id);
  const resolvedSearchParams = await searchParams;
  const eraFilter = String(resolvedSearchParams.era ?? "all");
  const chapterFilter = String(resolvedSearchParams.chapter ?? "all");
  const viewpointFilter = String(resolvedSearchParams.viewpoint ?? "canon");
  const mode = String(resolvedSearchParams.mode ?? "canon");

  const viewpointCondition =
    mode === "canon"
      ? { viewpointId: null }
      : mode === "viewpoint"
        ? { viewpointId: viewpointFilter === "canon" ? null : viewpointFilter }
        : { OR: [{ viewpointId: null }, { viewpointId: viewpointFilter === "canon" ? null : viewpointFilter }] };

  const worldCondition =
    eraFilter === "all"
      ? {}
      : {
          OR: [{ worldFrom: eraFilter }, { worldTo: eraFilter }, { worldFrom: null, worldTo: null }]
        };

  const storyCondition =
    chapterFilter === "all"
      ? {}
      : {
          OR: [
            { storyFromChapterId: chapterFilter },
            { storyToChapterId: chapterFilter },
            { storyFromChapterId: null, storyToChapterId: null }
          ]
        };
  const markerStyles: MarkerStyleSummary[] = workspace
    ? await prisma.markerStyle.findMany({
        where: { workspaceId: workspace.id, softDeletedAt: null },
        orderBy: { createdAt: "desc" }
      })
    : [];
  const archivedMarkerStyles: MarkerStyleSummary[] = workspace
    ? await prisma.markerStyle.findMany({
        where: { workspaceId: workspace.id, softDeletedAt: { not: null } },
        orderBy: { createdAt: "desc" }
      })
    : [];
  const maps: MapSummary[] = workspace
    ? await prisma.map.findMany({
        where: { workspaceId: workspace.id, softDeletedAt: null },
        include: {
          pins: {
            where: {
              softDeletedAt: null,
              ...viewpointCondition,
              ...worldCondition,
              ...storyCondition
            },
            include: { markerStyle: true }
          },
          paths: {
            where: {
              softDeletedAt: null,
              ...viewpointCondition,
              ...worldCondition,
              ...storyCondition
            },
            include: { markerStyle: true }
          }
        },
        orderBy: { createdAt: "desc" }
      })
    : [];
  const mapReadStates: MapReadState[] = workspace
    ? await prisma.readState.findMany({
        where: {
          workspaceId: workspace.id,
          userId: user.id,
          targetType: "map"
        }
      })
    : [];
  const mapReadMap = new Map(
    mapReadStates.map((state) => [state.targetId, state])
  );
  const allPins: PinWithMapSummary[] = workspace
    ? await prisma.pin.findMany({
        where: { workspaceId: workspace.id, softDeletedAt: null },
        include: { map: true },
        // orderBy: { id: "desc" }
      })
    : [];
  const allPaths: PathWithMapSummary[] = workspace
    ? await prisma.path.findMany({
        where: { workspaceId: workspace.id, softDeletedAt: null },
        include: { map: true },
        // orderBy: { id: "desc" }
      })
    : [];
  const locationStyleMap = new Map(
    markerStyles
      .filter((style) => style.target === "location" && style.locationType)
      .map((style) => [
        style.locationType ?? "",
        { shape: style.shape, color: style.color }
      ])
  );
  const defaultPathStyle =
    markerStyles.find((style) => style.target === "path") ?? null;
  const selectedMapId = String(resolvedSearchParams.map ?? maps[0]?.id ?? "");
  const selectedMap = maps.find((map) => map.id === selectedMapId) ?? null;
  const parentMap = selectedMap?.parentMapId ? maps.find((m) => m.id === selectedMap.parentMapId) : null;
  const childMaps = selectedMap ? maps.filter((m) => m.parentMapId === selectedMap.id) : [];

  const mapPayload = selectedMap
    ? {
        id: selectedMap.id,
        title: selectedMap.title,
        bounds: Array.isArray(selectedMap.bounds)
          ? (selectedMap.bounds as [[number, number], [number, number]])
          : null,
        imageUrl: selectedMap.imageAssetId
          ? `/api/assets/file/${selectedMap.imageAssetId}`
          : null,
        pins: selectedMap.pins.map((pin) => {
          const fallbackStyle = locationStyleMap.get(pin.locationType ?? "");
          const style = pin.markerStyle
            ? { shape: pin.markerStyle.shape, color: pin.markerStyle.color }
            : fallbackStyle ?? null;
          return {
            id: pin.id,
            x: pin.x,
            y: pin.y,
            label: pin.label,
            entityId: pin.entityId,
            markerShape: pin.markerShape,
            markerColor: pin.markerColor,
            markerStyleId: pin.markerStyleId,
            markerStyle: style,
            truthFlag: pin.truthFlag,
            locationType: pin.locationType,
            viewpointId: pin.viewpointId,
            worldFrom: pin.worldFrom,
            worldTo: pin.worldTo,
            storyFromChapterId: pin.storyFromChapterId,
            storyToChapterId: pin.storyToChapterId
          };
        }),
        paths: selectedMap.paths.map((path) => ({
          id: path.id,
          polyline: Array.isArray(path.polyline)
            ? (path.polyline as { x: number; y: number }[])
            : [],
          arrowStyle: path.arrowStyle ?? "arrow",
          strokeColor: path.strokeColor,
          strokeWidth: path.strokeWidth ?? null,
          markerStyle: path.markerStyle
            ? { color: path.markerStyle.color }
            : defaultPathStyle
              ? { color: defaultPathStyle.color }
              : null
        }))
      }
    : null;
  const archivedMaps: ArchivedMapSummary[] = workspace
    ? await prisma.map.findMany({
        where: { workspaceId: workspace.id, softDeletedAt: { not: null } },
        orderBy: { createdAt: "desc" }
      })
    : [];

  return (
    <div className="panel">
      <LlmContext
        value={{
          type: "maps",
          mapIds: maps.map((map) => map.id),
          selectedMapId,
          filters: { eraFilter, chapterFilter, viewpointFilter, mode }
        }}
      />
      <h2>Maps</h2>
      <FilterSummary />
      {!workspace && (
        <p className="muted">Select a workspace to manage maps, pins, and styles.</p>
      )}

      {workspace && (
        <>
          <section className="panel">
            <h3>Map preview</h3>
            
            {/* Hierarchical Navigation */}
            <div className="list-row" style={{justifyContent: 'flex-start', gap: '16px'}}>
               {parentMap && (
                 <a href={`/maps?map=${parentMap.id}`} className="link-button">
                   &larr; Up to {parentMap.title}
                 </a>
               )}
               {childMaps.length > 0 && (
                 <div style={{display:'flex', gap:'8px', alignItems:'center'}}>
                   <span className="muted">Sub-regions:</span>
                   {childMaps.map(child => (
                     <a key={child.id} href={`/maps?map=${child.id}`} className="badge" style={{textDecoration:'none', cursor:'pointer'}}>
                       {child.title}
                     </a>
                   ))}
                 </div>
               )}
            </div>

            <form action="/maps" method="get" className="form-grid">
              <label>
                Map
                <select name="map" defaultValue={selectedMapId}>
                  {maps.map((map) => (
                    <option key={map.id} value={map.id}>
                      {map.title}
                    </option>
                  ))}
                </select>
              </label>
              <input type="hidden" name="era" value={eraFilter} />
              <input type="hidden" name="chapter" value={chapterFilter} />
              <input type="hidden" name="viewpoint" value={viewpointFilter} />
              <input type="hidden" name="mode" value={mode} />
              <button type="submit">Load map</button>
            </form>
            {workspace && (
              <MapEditor
                map={mapPayload}
                workspaceId={workspace.id}
                markerStyles={markerStyles}
                locationTypes={LOCATION_TYPES}
              />
            )}
          </section>

          <WikiMapImportPanel workspaceId={workspace.id} />

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
            <h4>Archived marker styles</h4>
            <ul>
              {archivedMarkerStyles.map((style) => (
                <li key={style.id} className="list-row">
                  <span>{style.name}</span>
                  <form action="/api/restore" method="post">
                    <input type="hidden" name="workspaceId" value={workspace.id} />
                    <input type="hidden" name="targetType" value="marker_style" />
                    <input type="hidden" name="targetId" value={style.id} />
                    <button type="submit" className="link-button">Restore</button>
                  </form>
                </li>
              ))}
              {archivedMarkerStyles.length === 0 && <li className="muted">No archived styles.</li>}
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
              <label>
                Image asset ID (optional)
                <input name="imageAssetId" />
              </label>
              <label>
                Bounds JSON (optional)
                <input name="bounds" placeholder="[[0,0],[1000,1000]]" />
              </label>
              <button type="submit">Add map</button>
            </form>
          </section>

          <section className="panel">
            <h3>Update map</h3>
            <form action="/api/maps/update" method="post" className="form-grid">
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
                Title
                <input name="title" />
              </label>
              <label>
                Parent map ID
                <input name="parentMapId" />
              </label>
              <label>
                Image asset ID
                <input name="imageAssetId" />
              </label>
              <label>
                Bounds JSON
                <input name="bounds" placeholder="[[0,0],[1000,1000]]" />
              </label>
              <button type="submit">Update map</button>
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
                Entity ID (optional)
                <input name="entityId" />
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
                Truth flag
                <select name="truthFlag">
                  <option value="canonical">canonical</option>
                  <option value="rumor">rumor</option>
                  <option value="mistaken">mistaken</option>
                  <option value="propaganda">propaganda</option>
                  <option value="unknown">unknown</option>
                </select>
              </label>
              <label>
                Viewpoint ID
                <input name="viewpointId" />
              </label>
              <label>
                World from
                <input name="worldFrom" />
              </label>
              <label>
                World to
                <input name="worldTo" />
              </label>
              <label>
                Story from chapter ID
                <input name="storyFromChapterId" />
              </label>
              <label>
                Story to chapter ID
                <input name="storyToChapterId" />
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
            <h3>Update pin</h3>
            <form action="/api/pins/update" method="post" className="form-grid">
              <input type="hidden" name="workspaceId" value={workspace.id} />
              <label>
                Pin
                <select name="pinId" required>
                  {allPins.map((pin) => (
                    <option key={pin.id} value={pin.id}>
                      {(pin.label || pin.id).slice(0, 24)} · {pin.map?.title}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                X
                <input name="x" type="number" step="0.1" />
              </label>
              <label>
                Y
                <input name="y" type="number" step="0.1" />
              </label>
              <label>
                Label
                <input name="label" />
              </label>
              <label>
                Entity ID (optional)
                <input name="entityId" />
              </label>
              <label>
                Location type
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
                Truth flag
                <select name="truthFlag">
                  <option value="">--</option>
                  <option value="canonical">canonical</option>
                  <option value="rumor">rumor</option>
                  <option value="mistaken">mistaken</option>
                  <option value="propaganda">propaganda</option>
                  <option value="unknown">unknown</option>
                </select>
              </label>
              <label>
                Viewpoint ID
                <input name="viewpointId" />
              </label>
              <label>
                World from
                <input name="worldFrom" />
              </label>
              <label>
                World to
                <input name="worldTo" />
              </label>
              <label>
                Story from chapter ID
                <input name="storyFromChapterId" />
              </label>
              <label>
                Story to chapter ID
                <input name="storyToChapterId" />
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
                Override shape
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
                Override color
                <input name="markerColor" />
              </label>
              <button type="submit">Update pin</button>
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
                Truth flag
                <select name="truthFlag">
                  <option value="canonical">canonical</option>
                  <option value="rumor">rumor</option>
                  <option value="mistaken">mistaken</option>
                  <option value="propaganda">propaganda</option>
                  <option value="unknown">unknown</option>
                </select>
              </label>
              <label>
                Viewpoint ID
                <input name="viewpointId" />
              </label>
              <label>
                World from
                <input name="worldFrom" />
              </label>
              <label>
                World to
                <input name="worldTo" />
              </label>
              <label>
                Story from chapter ID
                <input name="storyFromChapterId" />
              </label>
              <label>
                Story to chapter ID
                <input name="storyToChapterId" />
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
              <label>
                Related event ID
                <input name="relatedEventId" />
              </label>
              <label>
                Related entity IDs (comma)
                <input name="relatedEntityIds" />
              </label>
              <button type="submit">Add path</button>
            </form>
          </section>

          <section className="panel">
            <h3>Update path</h3>
            <form action="/api/paths/update" method="post" className="form-grid">
              <input type="hidden" name="workspaceId" value={workspace.id} />
              <label>
                Path
                <select name="pathId" required>
                  {allPaths.map((path) => (
                    <option key={path.id} value={path.id}>
                      {path.id.slice(0, 10)} · {path.map?.title}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Polyline JSON
                <textarea name="polyline" rows={3} />
              </label>
              <label>
                Arrow style
                <select name="arrowStyle">
                  <option value="">--</option>
                  <option value="arrow">Arrow</option>
                  <option value="dashed">Dashed</option>
                  <option value="dotted">Dotted</option>
                </select>
              </label>
              <label>
                Truth flag
                <select name="truthFlag">
                  <option value="">--</option>
                  <option value="canonical">canonical</option>
                  <option value="rumor">rumor</option>
                  <option value="mistaken">mistaken</option>
                  <option value="propaganda">propaganda</option>
                  <option value="unknown">unknown</option>
                </select>
              </label>
              <label>
                Viewpoint ID
                <input name="viewpointId" />
              </label>
              <label>
                World from
                <input name="worldFrom" />
              </label>
              <label>
                World to
                <input name="worldTo" />
              </label>
              <label>
                Story from chapter ID
                <input name="storyFromChapterId" />
              </label>
              <label>
                Story to chapter ID
                <input name="storyToChapterId" />
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
              <label>
                Related event ID
                <input name="relatedEventId" />
              </label>
              <label>
                Related entity IDs (comma)
                <input name="relatedEntityIds" />
              </label>
              <button type="submit">Update path</button>
            </form>
          </section>

          <section className="panel">
            <h3>Maps overview</h3>
            {maps.map((map) => (
              <div key={map.id} className="panel">
                <div className="list-row">
                  <strong>{map.title}</strong>
                  {(() => {
                    const readState = mapReadMap.get(map.id);
                    const isUnread = !readState || map.updatedAt > readState.lastReadAt;
                    return isUnread ? <span className="badge">Unread</span> : null;
                  })()}
                </div>
                <div className="muted">Pins: {map.pins.length} · Paths: {map.paths.length}</div>
                <div className="list-row">
                  <form action="/api/watches/toggle" method="post">
                    <input type="hidden" name="workspaceId" value={workspace.id} />
                    <input type="hidden" name="targetType" value="map" />
                    <input type="hidden" name="targetId" value={map.id} />
                    <button type="submit" className="link-button">Toggle Watch</button>
                  </form>
                  <form action="/api/read-state/mark" method="post">
                    <input type="hidden" name="workspaceId" value={workspace.id} />
                    <input type="hidden" name="targetType" value="map" />
                    <input type="hidden" name="targetId" value={map.id} />
                    <button type="submit" className="link-button">Mark Read</button>
                  </form>
                  <form action="/api/archive" method="post">
                    <input type="hidden" name="workspaceId" value={workspace.id} />
                    <input type="hidden" name="targetType" value="map" />
                    <input type="hidden" name="targetId" value={map.id} />
                    <button type="submit" className="link-button">Archive</button>
                  </form>
                </div>
              </div>
            ))}
          </section>
          <section className="panel">
            <h3>Archived maps</h3>
            <ul>
              {archivedMaps.map((map) => (
                <li key={map.id} className="list-row">
                  <span>{map.title}</span>
                  <form action="/api/restore" method="post">
                    <input type="hidden" name="workspaceId" value={workspace.id} />
                    <input type="hidden" name="targetType" value="map" />
                    <input type="hidden" name="targetId" value={map.id} />
                    <button type="submit" className="link-button">Restore</button>
                  </form>
                </li>
              ))}
              {archivedMaps.length === 0 && <li className="muted">No archived maps.</li>}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}
