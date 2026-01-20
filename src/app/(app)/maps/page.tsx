import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getActiveWorkspace } from "@/lib/workspaces";
import Link from "next/link";
import { MapViewer } from "@/components/MapViewer";

type SearchParams = { [key: string]: string | string[] | undefined };
type PageProps = { searchParams: Promise<SearchParams> };

export default async function MapsListPage({ searchParams }: PageProps) {
  const user = await requireUser();
  const workspace = await getActiveWorkspace(user.id);
  const resolvedSearchParams = await searchParams;

  const query = typeof resolvedSearchParams.q === "string" ? resolvedSearchParams.q : "";
  const view = typeof resolvedSearchParams.view === "string" ? resolvedSearchParams.view : "grid";

  const [maps, archivedMaps] = workspace
    ? await Promise.all([
        prisma.map.findMany({
          where: { workspaceId: workspace.id, softDeletedAt: null },
          include: {
            pins: { where: { softDeletedAt: null }, include: { markerStyle: true } },
            paths: { where: { softDeletedAt: null }, include: { markerStyle: true } }
          },
          orderBy: { updatedAt: "desc" }
        }),
        prisma.map.findMany({
          where: { workspaceId: workspace.id, softDeletedAt: { not: null } },
          orderBy: { createdAt: "desc" }
        })
      ])
    : [[], []];

  if (!workspace) return <div className="panel">Select a workspace.</div>;

  const mapQuery = query.trim().toLowerCase();
  const visibleMaps = mapQuery ? maps.filter((m) => m.title.toLowerCase().includes(mapQuery)) : maps;

  return (
    <div className="h-screen flex flex-col bg-bg">
      {/* Header */}
      <header className="border-b border-border bg-panel px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold text-ink">Maps</h1>
          <div className="flex items-center gap-2 bg-bg border border-border rounded-lg px-3 py-2">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4 text-muted">
              <circle cx="11" cy="11" r="8" />
              <path d="M21 21l-4.35-4.35" />
            </svg>
            <form method="get" className="flex-1">
              <input
                name="q"
                defaultValue={query}
                placeholder="Search maps..."
                className="bg-transparent outline-none text-sm w-64"
              />
              <input type="hidden" name="view" value={view} />
            </form>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href={`?view=grid${query ? `&q=${query}` : ""}`}
            className={`px-3 py-2 rounded-lg transition-colors ${
              view === "grid" ? "bg-accent text-white" : "text-muted hover:bg-bg-elevated"
            }`}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
              <rect x="3" y="3" width="7" height="7" />
              <rect x="14" y="3" width="7" height="7" />
              <rect x="14" y="14" width="7" height="7" />
              <rect x="3" y="14" width="7" height="7" />
            </svg>
          </Link>
          <Link
            href={`?view=list${query ? `&q=${query}` : ""}`}
            className={`px-3 py-2 rounded-lg transition-colors ${
              view === "list" ? "bg-accent text-white" : "text-muted hover:bg-bg-elevated"
            }`}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
              <line x1="8" y1="6" x2="21" y2="6" />
              <line x1="8" y1="12" x2="21" y2="12" />
              <line x1="8" y1="18" x2="21" y2="18" />
              <line x1="3" y1="6" x2="3.01" y2="6" />
              <line x1="3" y1="12" x2="3.01" y2="12" />
              <line x1="3" y1="18" x2="3.01" y2="18" />
            </svg>
          </Link>
          <div className="w-px h-6 bg-border mx-2" />
          <Link href="/maps/new" className="btn-primary flex items-center gap-2">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            New Map
          </Link>
          <Link href="/maps/import" className="btn-secondary flex items-center gap-2">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
            </svg>
            Import
          </Link>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-auto p-6">
        {visibleMaps.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-24 h-24 text-muted mb-4">
              <path d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
            </svg>
            <h2 className="text-xl font-bold text-ink mb-2">No maps found</h2>
            <p className="text-muted mb-6">Create your first map or import one from Wikipedia</p>
            <div className="flex gap-3">
              <Link href="/maps/new" className="btn-primary">
                Create Map
              </Link>
              <Link href="/maps/import" className="btn-secondary">
                Import from Wikipedia
              </Link>
            </div>
          </div>
        ) : view === "grid" ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {visibleMaps.map((map) => {
              const mapPayload = {
                id: map.id,
                title: map.title,
                bounds: map.bounds as any,
                imageUrl: map.imageAssetId ? `/api/assets/file/${map.imageAssetId}` : null,
                pins: map.pins.map((p) => ({
                  id: p.id,
                  x: p.x,
                  y: p.y,
                  label: p.label,
                  markerShape: p.markerShape,
                  markerColor: p.markerColor,
                  markerStyle: p.markerStyle ? { shape: p.markerStyle.shape, color: p.markerStyle.color } : null,
                  truthFlag: p.truthFlag
                })),
                paths: map.paths.map((p) => {
                  let polyline: { x: number; y: number }[] = [];
                  if (typeof p.polyline === 'string') {
                    try {
                      const parsed = JSON.parse(p.polyline);
                      polyline = Array.isArray(parsed) ? parsed : [];
                    } catch {
                      polyline = [];
                    }
                  } else if (Array.isArray(p.polyline)) {
                    polyline = p.polyline as { x: number; y: number }[];
                  }
                  return {
                    id: p.id,
                    polyline,
                    arrowStyle: p.arrowStyle,
                    strokeColor: p.strokeColor,
                    strokeWidth: p.strokeWidth,
                    markerStyle: p.markerStyle ? { color: p.markerStyle.color } : null
                  };
                })
              };

              return (
                <Link
                  key={map.id}
                  href={`/maps/${map.id}`}
                  className="group bg-panel border border-border rounded-xl overflow-hidden hover:border-accent transition-all hover:shadow-lg"
                >
                  <div className="aspect-[4/3] bg-bg-elevated relative overflow-hidden">
                    <div className="absolute inset-0 scale-[0.6] origin-center pointer-events-none">
                      <MapViewer map={mapPayload} />
                    </div>
                  </div>
                  <div className="p-4">
                    <h3 className="font-bold text-ink mb-1 group-hover:text-accent transition-colors">
                      {map.title}
                    </h3>
                    <div className="flex items-center gap-3 text-xs text-muted">
                      <span className="flex items-center gap-1">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3 h-3">
                          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
                          <circle cx="12" cy="10" r="3" />
                        </svg>
                        {map.pins.length}
                      </span>
                      <span className="flex items-center gap-1">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3 h-3">
                          <path d="M22 12c-4.5 0-4.5-8-9-8s-4.5 8-9 8" />
                        </svg>
                        {map.paths.length}
                      </span>
                      {map.parentMapId && (
                        <span className="flex items-center gap-1">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3 h-3">
                            <polyline points="9 18 15 12 9 6" />
                          </svg>
                          Child
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="space-y-2">
            {visibleMaps.map((map) => (
              <Link
                key={map.id}
                href={`/maps/${map.id}`}
                className="flex items-center gap-4 p-4 bg-panel border border-border rounded-lg hover:border-accent transition-all"
              >
                <div className="w-16 h-16 bg-bg-elevated rounded-lg flex items-center justify-center">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-8 h-8 text-muted">
                    <path d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-ink mb-1">{map.title}</h3>
                  <div className="flex items-center gap-4 text-xs text-muted">
                    <span>{map.pins.length} pins</span>
                    <span>{map.paths.length} paths</span>
                    <span>Updated {new Date(map.updatedAt).toLocaleDateString()}</span>
                  </div>
                </div>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5 text-muted">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </Link>
            ))}
          </div>
        )}

        {/* Archived Section */}
        {archivedMaps.length > 0 && (
          <details className="mt-8 bg-panel border border-border rounded-lg p-4">
            <summary className="font-bold text-ink cursor-pointer">
              Archived Maps ({archivedMaps.length})
            </summary>
            <div className="mt-4 space-y-2">
              {archivedMaps.map((m) => (
                <div key={m.id} className="flex items-center justify-between p-3 bg-bg rounded-lg">
                  <span className="text-muted">{m.title}</span>
                  <form action="/api/restore" method="post">
                    <input type="hidden" name="workspaceId" value={workspace.id} />
                    <input type="hidden" name="targetType" value="map" />
                    <input type="hidden" name="targetId" value={m.id} />
                    <button type="submit" className="btn-secondary text-sm">
                      Restore
                    </button>
                  </form>
                </div>
              ))}
            </div>
          </details>
        )}
      </main>
    </div>
  );
}
