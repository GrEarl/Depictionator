import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getActiveWorkspace } from "@/lib/workspaces";
import { LlmContext } from "@/components/LlmContext";
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
  const requestedTab = typeof resolvedSearchParams.tab === "string" ? resolvedSearchParams.tab : "manage";
  const tab = ["entities", "manage", "styles"].includes(requestedTab) ? requestedTab : "manage";
  const query = typeof resolvedSearchParams.q === "string" ? resolvedSearchParams.q : "";
  const eraFilter = String(resolvedSearchParams.era ?? "all");
  const chapterFilter = String(resolvedSearchParams.chapter ?? "all");
  const viewpointFilter = String(resolvedSearchParams.viewpoint ?? "canon");
  const mode = String(resolvedSearchParams.mode ?? "canon");

  const [maps, markerStyles, archivedMaps, entities, eras, chapters, viewpoints, assets] = workspace
    ? await Promise.all([
        prisma.map.findMany({
          where: { workspaceId: workspace.id, softDeletedAt: null },
          include: {
            pins: { where: { softDeletedAt: null }, include: { markerStyle: true, entity: { select: { id: true, title: true } } } },
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
        }),
        prisma.entity.findMany({
          where: { workspaceId: workspace.id, softDeletedAt: null },
          select: { id: true, title: true, type: true },
          orderBy: { title: "asc" }
        }),
        prisma.era.findMany({
          where: { workspaceId: workspace.id, softDeletedAt: null },
          orderBy: { sortKey: "asc" }
        }),
        prisma.chapter.findMany({
          where: { workspaceId: workspace.id, softDeletedAt: null },
          orderBy: { orderIndex: "asc" }
        }),
        prisma.viewpoint.findMany({
          where: { workspaceId: workspace.id, softDeletedAt: null },
          orderBy: { name: "asc" }
        }),
        prisma.asset.findMany({
          where: { workspaceId: workspace.id, kind: "image", softDeletedAt: null },
          select: { id: true, storageKey: true },
          orderBy: { createdAt: "desc" }
        })
      ])
    : [[], [], [], [], [], [], [], []];

  if (!workspace) return <div className="panel">Select a workspace.</div>;

  const mapQuery = query.trim().toLowerCase();
  const visibleMaps = mapQuery ? maps.filter((m) => m.title.toLowerCase().includes(mapQuery)) : maps;
  const activeMap = maps.find((m) => m.id === selectedMapId) || maps[0];

  // Build breadcrumb trail (parent hierarchy)
  const breadcrumbs: { id: string; title: string }[] = [];
  if (activeMap) {
    let current = activeMap;
    breadcrumbs.unshift({ id: current.id, title: current.title });
    while (current.parentMapId) {
      const parent = maps.find(m => m.id === current.parentMapId);
      if (!parent) break;
      breadcrumbs.unshift({ id: parent.id, title: parent.title });
      current = parent;
    }
  }

  // Get child maps for quick navigation
  const childMaps = activeMap ? maps.filter(m => m.parentMapId === activeMap.id) : [];

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
        pins: activeMap.pins.map((p) => {
          const { entity, markerStyle, ...rest } = p as typeof p & { entity?: { title?: string } | null };
          return {
            ...rest,
            entityTitle: entity?.title ?? null,
            markerStyle: markerStyle ? { shape: markerStyle.shape, color: markerStyle.color } : null
          };
        }),
        paths: activeMap.paths.map((p) => {
          // Parse polyline if it's a JSON string
          let polyline = p.polyline;
          if (typeof polyline === 'string') {
            try {
              polyline = JSON.parse(polyline);
            } catch (e) {
              console.error(`Failed to parse polyline for path ${p.id}:`, e);
              polyline = [];
            }
          }
          // Ensure polyline is an array
          if (!Array.isArray(polyline)) {
            polyline = [];
          }
          return {
            ...p,
            polyline,
            markerStyle: p.markerStyle ? { color: p.markerStyle.color } : null
          };
        })
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
          <div className="map-editor-wrapper">
            {/* Map Breadcrumb & Child Navigation */}
            <div className="map-navigation-bar">
              <div className="map-breadcrumb">
                <span className="breadcrumb-label">Location:</span>
                {breadcrumbs.map((crumb, idx) => (
                  <span key={crumb.id} className="breadcrumb-item">
                    {idx > 0 && <span className="breadcrumb-separator">→</span>}
                    <Link
                      href={buildUrl({ map: crumb.id })}
                      className={`breadcrumb-link ${crumb.id === activeMap.id ? 'active' : ''}`}
                    >
                      {crumb.title}
                    </Link>
                  </span>
                ))}
              </div>

              {/* Child Maps Quick Access */}
              {childMaps.length > 0 && (
                <div className="child-maps-nav">
                  <span className="child-maps-label">Zoom into:</span>
                  {childMaps.map((child) => (
                    <Link
                      key={child.id}
                      href={buildUrl({ map: child.id })}
                      className="child-map-chip"
                      title={`Zoom into ${child.title}`}
                    >
                      {child.title}
                    </Link>
                  ))}
                </div>
              )}
            </div>

            <MapEditorClient
              map={mapPayload as any}
              workspaceId={workspace.id}
              markerStyles={markerStyles as any}
              locationTypes={LOCATION_TYPES}
              entities={entities as any}
              eras={eras as any}
              chapters={chapters as any}
              viewpoints={viewpoints as any}
            />
          </div>
        ) : (
          <div className="empty-state-centered">
            <h2>No Maps Found</h2>
            <p className="muted">Create your first map or import one from Wikipedia to get started.</p>
          </div>
        )}
      </main>

      {/* Pane 3: Right - Actions / Forms */}
      <aside className="pane-right-drawer">
        <div className="pane-header-tabs">
          <Link href={buildUrl({ tab: "entities" })} className={`tab-link ${tab === "entities" ? "active" : ""}`}>
            Entities
          </Link>
          <Link href={buildUrl({ tab: "manage" })} className={`tab-link ${tab === "manage" ? "active" : ""}`}>
            Manage
          </Link>
          <Link href={buildUrl({ tab: "styles" })} className={`tab-link ${tab === "styles" ? "active" : ""}`}>
            Styles
          </Link>
        </div>

        <div className="drawer-content scroll-content">
          {tab === "entities" && activeMap && (
            <div className="p-4">
              <h4 className="text-xs muted mb-4 uppercase tracking-wider">Drag to Map</h4>
              <p className="text-sm mb-4 muted">
                Drag entities onto the map to create location pins.
              </p>

              <div className="entity-list">
                {entities.slice(0, 50).map((entity) => (
                  <div
                    key={entity.id}
                    className="draggable-item entity-drag-card"
                    draggable
                    data-type="entity"
                    data-id={entity.id}
                    data-title={entity.title}
                  >
                    <span className={`entity-type-tag type-${entity.type}`}>
                      {entity.type}
                    </span>
                    <span className="entity-title">{entity.title}</span>
                  </div>
                ))}
                {entities.length === 0 && (
                  <div className="muted text-sm">No entities yet. Create some first!</div>
                )}
              </div>
            </div>
          )}

          {tab === "manage" && (
            <>
              <div className="p-4 space-y-4">
                <Link href="/maps/new" className="btn-primary w-full justify-center">
                  地図を作成
                </Link>
                <Link href="/maps/import" className="btn-secondary w-full justify-center">
                  Wikipediaからインポート
                </Link>
                <p className="text-xs text-muted">
                  作成/インポートは専用ページで進めるようにしました。
                </p>
              </div>

              {activeMap && (
                <details className="action-details" open>
                  <summary>Map Settings</summary>
                  <form action="/api/maps/update" method="post" className="form-grid p-4">
                    <input type="hidden" name="workspaceId" value={workspace.id} />
                    <input type="hidden" name="mapId" value={activeMap.id} />
                    <label>
                      Title <input name="title" defaultValue={activeMap.title} />
                    </label>
                    <label>
                      Background Image
                      <select name="imageAssetId" defaultValue={activeMap.imageAssetId || ""} className="w-full px-4 py-3 bg-bg-elevated border border-border text-ink font-semibold rounded-sm outline-none">
                        <option value="">(No Image)</option>
                        {assets.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.storageKey.split("/").pop()} ({a.id.slice(0, 8)}...)
                          </option>
                        ))}
                      </select>
                      <span className="text-xs text-muted mt-1 block">Select an imported image</span>
                    </label>
                    <button type="submit" className="btn-secondary">Update Map</button>
                  </form>
                </details>
              )}

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
                  Name <input name="name" required placeholder="e.g., Capital City, Danger Zone" />
                  <span className="text-xs text-muted mt-1 block">A name to identify this style</span>
                </label>
                <label>
                  Target
                  <select name="target">
                    <option value="location">Location (pins)</option>
                    <option value="event">Event (historical markers)</option>
                    <option value="path">Path (routes and borders)</option>
                  </select>
                  <span className="text-xs text-muted mt-1 block">What will use this style?</span>
                </label>
                <label>
                  Shape <select name="shape">{SHAPES.map((s) => <option key={s} value={s}>{s}</option>)}</select>
                  <span className="text-xs text-muted mt-1 block">Visual shape of the marker</span>
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

        </div>
      </aside>
    </div>
  );
}
