import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getActiveWorkspace } from "@/lib/workspaces";
import { notFound } from "next/navigation";
import { FigmaMapEditor } from "@/components/FigmaMapEditor";

type PageProps = {
  params: Promise<{ id: string }>;
};

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

export default async function MapEditorPage({ params }: PageProps) {
  const user = await requireUser();
  const workspace = await getActiveWorkspace(user.id);
  const { id } = await params;

  if (!workspace) {
    return <div className="panel">Select a workspace.</div>;
  }

  const [map, markerStyles, entities, eras, chapters, viewpoints] = await Promise.all([
    prisma.map.findFirst({
      where: { id, workspaceId: workspace.id, softDeletedAt: null },
      include: {
        pins: { where: { softDeletedAt: null }, include: { markerStyle: true, entity: { select: { id: true, title: true } } } },
        paths: { where: { softDeletedAt: null }, include: { markerStyle: true } },
        events: {
          where: { softDeletedAt: null },
          select: { id: true, title: true, worldStart: true, worldEnd: true, storyOrder: true }
        }
      }
    }),
    prisma.markerStyle.findMany({
      where: { workspaceId: workspace.id, softDeletedAt: null },
      orderBy: { createdAt: "desc" }
    }),
    prisma.entity.findMany({
      where: { workspaceId: workspace.id, softDeletedAt: null },
      select: { id: true, title: true, type: true, tags: true },
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
    })
  ]);

  if (!map) {
    notFound();
  }

  const mapPayload = {
    id: map.id,
    title: map.title,
    bounds: map.bounds as any,
    imageUrl: map.imageAssetId ? `/api/assets/file/${map.imageAssetId}` : null,
    showPathOrder: map.showPathOrder ?? false,
    pins: map.pins.map((p) => {
      const { entity, markerStyle, ...rest } = p as typeof p & { entity?: { title?: string } | null };
      return {
        ...rest,
        entityTitle: entity?.title ?? null,
        markerStyle: markerStyle ? { shape: markerStyle.shape, color: markerStyle.color } : null
      };
    }),
    paths: map.paths.map((p) => {
      let polyline = p.polyline;
      if (typeof polyline === 'string') {
        try {
          polyline = JSON.parse(polyline);
        } catch (e) {
          console.error(`Failed to parse polyline for path ${p.id}:`, e);
          polyline = [];
        }
      }
      if (!Array.isArray(polyline)) {
        polyline = [];
      }
      return {
        ...p,
        polyline,
        markerStyle: p.markerStyle ? { color: p.markerStyle.color } : null
      };
    }),
    events: map.events ?? []
  };

  return (
    <FigmaMapEditor
      map={mapPayload as any}
      workspaceId={workspace.id}
      markerStyles={markerStyles as any}
      locationTypes={LOCATION_TYPES}
      entities={entities as any}
      eras={eras as any}
      chapters={chapters as any}
      viewpoints={viewpoints as any}
    />
  );
}
