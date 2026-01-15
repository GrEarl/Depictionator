import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getActiveWorkspace } from "@/lib/workspaces";
import { LlmContext } from "@/components/LlmContext";
import { WikiMapImportPanel } from "@/components/WikiMapImportPanel";
import { MapEditorClient } from "@/components/MapEditorClient";
import Link from "next/link";

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

export default async function MapsPage({ searchParams }: PageProps) {
  const user = await requireUser();
  const workspace = await getActiveWorkspace(user.id);
  const resolvedSearchParams = await searchParams;

  const selectedMapId = typeof resolvedSearchParams.map === "string" ? resolvedSearchParams.map : undefined;
  const tab = typeof resolvedSearchParams.tab === "string" ? resolvedSearchParams.tab : "manage";
  const query = typeof resolvedSearchParams.q === "string" ? resolvedSearchParams.q : "";
  const eraFilter = String(resolvedSearchParams.era ?? "all");
  const chapterFilter = String(resolvedSearchParams.chapter ?? "all");
  const viewpointFilter = String(resolvedSearchParams.viewpoint ?? "canon");
  const mode = String(resolvedSearchParams.mode ?? "canon");

  const [maps, markerStyles, archivedMaps] = workspace
    ? await Promise.all([
        prisma.map.findMany({
          where: { workspaceId: workspace.id, softDeletedAt: null },
          include: {
            pins: { where: { softDeletedAt: null }, include: { markerStyle: true } },
            paths: { where: { softDeletedAt: null }, include: { markerStyle: true } }
          },
          orderBy: { createdAt: "desc" }
        }),
        prisma.markerStyle.findMany({
          where: { workspaceId: workspace.id, softDeletedAt: null },
          orderBy: { createdAt: "desc" }
        }),
        prisma.map.findMany({
          where: { workspaceId: workspace.id, softDeletedAt: { not: null } },
          orderBy: { createdAt: "desc" }
        })
      ])
    : [[], [], []];

  if (!workspace) return <div className="panel">Select a workspace.</div>;

  const mapQuery = query.trim().toLowerCase();
  const visibleMaps = mapQuery ? maps.filter((m) => m.title.toLowerCase().includes(mapQuery)) : maps;
  const activeMap = maps.find((m) => m.id === selectedMapId) || maps[0];

  const buildUrl = (overrides: Record<string, string | undefined>) => {
    const params = new URLSearchParams();
    const merged = {
      era: eraFilter,
      chapter: chapterFilter,
      viewpoint: viewpointFilter,
      mode,
      q: query || undefined,
      map: selectedMapId,
      tab,
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

  const mapPayload = activeMap
    ? {
        id: activeMap.id,
        title: activeMap.title,
        bounds: activeMap.bounds as any,
        imageUrl: activeMap.imageAssetId ? `/api/assets/file/${activeMap.imageAssetId}` : null,
        pins: activeMap.pins.map((p) => ({
          ...p,
          markerStyle: p.markerStyle ? { shape: p.markerStyle.shape, color: p.markerStyle.color } : null
        })),
        paths: activeMap.paths.map((p) => ({
          ...p,
          polyline: p.polyline as any,
          markerStyle: p.markerStyle ? { color: p.markerStyle.color } : null
        }))
      }
    : null;

  return (
    <div className="layout-3-pane">
      <LlmContext value={{ type: "maps", workspaceId: workspace.id, selectedMapId: activeMap?.id }} />

      {/* Pane 1: Left - Map List & Hierarchy */}
      <aside className="pane-left">
        <div className="pane-header">
          <h3>Maps ({maps.length})</h3>
          <form method="get" className="quick-search">
            <input type="hidden" name="era" value={eraFilter} />
            <input type="hidden" name="chapter" value={chapterFilter} />
            <input type="hidden" name="viewpoint" value={viewpointFilter} />
            <input type="hidden" name="mode" value={mode} />
            <input name="q" defaultValue={query} placeholder="Search maps..." />
          </form>
        </div>
        <div className="scroll-content">
          <div className="map-tree p-2">
            {visibleMaps
              .filter((m) => !m.parentMapId)
              .map((rootMap) => (
                <div key={rootMap.id} className="map-tree-item-group">
                  <Link
                    href={buildUrl({ map: rootMap.id })}
                    className={`map-link ${activeMap?.id === rootMap.id ? "active" : ""}`}
                  >
                    Map: {rootMap.title}
                  </Link>
                  <div className="map-tree-children ml-4">
                    {visibleMaps
                      .filter((m) => m.parentMapId === rootMap.id)
                      .map((child) => (
                        <Link
                          key={child.id}
                          href={buildUrl({ map: child.id })}
                          className={`map-link-sm ${activeMap?.id === child.id ? "active" : ""}`}
                        >
                          Child: {child.title}
                        </Link>
                      ))}
                  </div>
                </div>
              ))}
            {visibleMaps.length === 0 && <div className="muted p-4">No maps found.</div>}
          </div>
        </div>
      </aside>

      {/* Pane 2: Center - Map Editor */}
      <main className="pane-center overflow-hidden">
        {activeMap ? (
          <MapEditorClient
            map={mapPayload as any}
            workspaceId={workspace.id}
            markerStyles={markerStyles as any}
            locationTypes={LOCATION_TYPES}
          />
        ) : (
          <div className="empty-state-centered">
            <div className="hero-icon">Map</div>
            <h2>No Maps Found</h2>
            <p className="muted">Create your first map or import one from Wikipedia to get started.</p>
          </div>
        )}
      </main>

      {/* Pane 3: Right - Actions / Forms */}
      <aside className="pane-right-drawer">
        <div className="pane-header-tabs">
          <Link href={buildUrl({ tab: "manage" })} className={`tab-link ${tab === "manage" ? "active" : ""}`}>
            Manage
          </Link>
          <Link href={buildUrl({ tab: "styles" })} className={`tab-link ${tab === "styles" ? "active" : ""}`}>
            Styles
          </Link>
          <Link href={buildUrl({ tab: "wiki" })} className={`tab-link ${tab === "wiki" ? "active" : ""}`}>
            Wiki
          </Link>
        </div>

        <div className="drawer-content scroll-content">
          {tab === "manage" && (
            <>
              <details className="action-details" open>
                <summary>Map Settings</summary>
                <form action="/api/maps/update" method="post" className="form-grid p-4">
                  <input type="hidden" name="workspaceId" value={workspace.id} />
                  <input type="hidden" name="mapId" value={activeMap?.id} />
                  <label>
                    Title <input name="title" defaultValue={activeMap?.title} />
                  </label>
                  <label>
                    Image Asset ID <input name="imageAssetId" defaultValue={activeMap?.imageAssetId || ""} />
                  </label>
                  <button type="submit" className="btn-secondary">Update Map</button>
                </form>
              </details>
              <details className="action-details">
                <summary>Create New Map</summary>
                <form action="/api/maps/create" method="post" className="form-grid p-4">
                  <input type="hidden" name="workspaceId" value={workspace.id} />
                  <label>
                    Title <input name="title" required />
                  </label>
                  <label>
                    Parent Map
                    <select name="parentMapId">
                      <option value="">None</option>
                      {maps.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.title}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button type="submit" className="btn-primary">Create Map</button>
                </form>
              </details>
              {archivedMaps.length > 0 && (
                <details className="action-details">
                  <summary>Archived ({archivedMaps.length})</summary>
                  <div className="p-4 list-sm">
                    {archivedMaps.map((m) => (
                      <div key={m.id} className="list-row-sm">
                        <span>{m.title}</span>
                        <form action="/api/restore" method="post">
                          <input type="hidden" name="workspaceId" value={workspace.id} />
                          <input type="hidden" name="targetType" value="map" />
                          <input type="hidden" name="targetId" value={m.id} />
                          <button type="submit" className="link-button">Restore</button>
                        </form>
                      </div>
                    ))}
                  </div>
                </details>
              )}
            </>
          )}

          {tab === "styles" && (
            <div className="p-4">
              <h4>Marker Styles</h4>
              <form action="/api/marker-styles/create" method="post" className="form-grid mb-6">
                <input type="hidden" name="workspaceId" value={workspace.id} />
                <label>
                  Name <input name="name" required />
                </label>
                <label>
                  Target
                  <select name="target">
                    <option value="location">Location</option>
                    <option value="event">Event</option>
                    <option value="path">Path</option>
                  </select>
                </label>
                <label>
                  Shape <select name="shape">{SHAPES.map((s) => <option key={s} value={s}>{s}</option>)}</select>
                </label>
                <label>
                  Color <input name="color" type="color" defaultValue="#1f4b99" />
                </label>
                <button type="submit" className="btn-primary">Add Style</button>
              </form>
              <div className="style-list">
                {markerStyles.map((s) => (
                  <div key={s.id} className="list-row-sm">
                    <span className={`marker-shape-sm marker-${s.shape}`} style={{ backgroundColor: s.color } as any} />
                    <span>{s.name}</span>
                    <form action="/api/marker-styles/delete" method="post">
                      <input type="hidden" name="workspaceId" value={workspace.id} />
                      <input type="hidden" name="styleId" value={s.id} />
                      <button type="submit" className="link-button">Delete</button>
                    </form>
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === "wiki" && (
            <div className="p-4">
              <WikiMapImportPanel workspaceId={workspace.id} />
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
