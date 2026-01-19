import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getActiveWorkspace } from "@/lib/workspaces";
import { prisma } from "@/lib/prisma";
import { LlmContext } from "@/components/LlmContext";
import { AutoMarkRead } from "@/components/AutoMarkRead";
import { ArticleDetail } from "@/components/ArticleDetail";
import { toWikiPath } from "@/lib/wiki";

type SearchParams = { [key: string]: string | string[] | undefined };

type PageProps = {
  params: Promise<{ title: string }>;
  searchParams: Promise<SearchParams>;
};

export default async function WikiResolvePage({ params, searchParams }: PageProps) {
  const user = await requireUser();
  const workspace = await getActiveWorkspace(user.id);

  if (!workspace) {
    return <div className="panel">Select a workspace.</div>;
  }

  const { title: rawTitle } = await params;
  const decoded = decodeURIComponent(rawTitle);
  const normalized = decoded.replace(/_/g, " ").trim();

  if (!normalized) {
    return <div className="panel">No title provided.</div>;
  }

  const exactMatches = await prisma.entity.findMany({
    where: {
      workspaceId: workspace.id,
      softDeletedAt: null,
      OR: [
        { title: { equals: normalized, mode: "insensitive" } },
        { aliases: { has: normalized } }
      ]
    },
    select: { id: true, title: true, type: true, updatedAt: true }
  });

  if (exactMatches.length === 1) {
    const resolvedSearchParams = await searchParams;
    const mode = String(resolvedSearchParams.mode ?? "canon");
    const viewpoint = String(resolvedSearchParams.viewpoint ?? "canon");
    const eraFilter = String(resolvedSearchParams.era ?? "all");
    const chapterFilter = String(resolvedSearchParams.chapter ?? "all");
    const query = String(resolvedSearchParams.q ?? "").trim();

    const entity = await prisma.entity.findUnique({
      where: { id: exactMatches[0].id },
      include: {
        article: {
          include: {
            revisions: { orderBy: { createdAt: "desc" } },
            baseRevision: true
          }
        },
        overlays: {
          where: { softDeletedAt: null },
          include: {
            revisions: { orderBy: { createdAt: "desc" } },
            activeRevision: true
          }
        },
        mainImage: true,
        parentEntity: { select: { id: true, title: true, type: true } },
        childEntities: {
          where: { softDeletedAt: null },
          select: { id: true, title: true, type: true },
          take: 20
        },
        relationsFrom: {
          where: { softDeletedAt: null },
          include: { toEntity: { select: { id: true, title: true, type: true } } },
          take: 50
        },
        relationsTo: {
          where: { softDeletedAt: null },
          include: { fromEntity: { select: { id: true, title: true, type: true } } },
          take: 50
        },
        pins: {
          where: { softDeletedAt: null },
          include: { map: { select: { id: true, title: true } } },
          take: 10
        }
      }
    });

    if (!entity) {
      return <div className="panel">Not found.</div>;
    }

    const watch = await prisma.watch.findFirst({
      where: {
        workspaceId: workspace.id,
        userId: user.id,
        targetType: "entity",
        targetId: entity.id,
        notifyInApp: true
      }
    });

    const allRelated = [
      ...entity.relationsFrom.map(r => ({
        id: r.toEntity.id,
        title: r.toEntity.title,
        type: r.toEntity.type,
        relation: r.relationType,
        direction: 'to' as const
      })),
      ...entity.relationsTo.map(r => ({
        id: r.fromEntity.id,
        title: r.fromEntity.title,
        type: r.fromEntity.type,
        relation: r.relationType,
        direction: 'from' as const
      }))
    ];

    return (
      <div className="layout-3-pane">
        <LlmContext
          value={{
            type: "entity",
            entityId: entity.id,
            title: entity.title,
            mode,
            viewpoint,
            eraFilter,
            chapterFilter,
            baseRevisionId: entity.article?.baseRevisionId ?? null,
            overlayIds: entity.overlays.map((overlay: { id: string }) => overlay.id)
          }}
        />
        <AutoMarkRead
          workspaceId={workspace.id}
          targetType="entity"
          targetId={entity.id}
          lastReadRevisionId={entity.article?.baseRevisionId ?? null}
        />
        <ArticleDetail
          entity={entity}
          workspaceId={workspace.id}
          user={user}
          mainImage={entity.mainImage}
          parentEntity={entity.parentEntity}
          childEntities={entity.childEntities}
          relatedEntities={allRelated}
          locations={entity.pins}
          searchQuery={query}
          isWatching={Boolean(watch)}
        />
      </div>
    );
  }

  const suggestions = exactMatches.length
    ? exactMatches
    : await prisma.entity.findMany({
        where: {
          workspaceId: workspace.id,
          softDeletedAt: null,
          OR: [
            { title: { contains: normalized, mode: "insensitive" } },
            { aliases: { has: normalized } }
          ]
        },
        select: { id: true, title: true, type: true, updatedAt: true },
        take: 20
      });

  return (
    <div className="panel">
      <h2 className="text-xl font-bold">Page not found</h2>
      <p className="muted mt-2">
        No exact match for <strong>{normalized}</strong>. Choose a close match below.
      </p>
      {suggestions.length === 0 ? (
        <p className="muted mt-4">No suggestions available.</p>
      ) : (
        <div className="list-sm mt-4">
          {suggestions.map((item) => (
            <Link key={item.id} href={toWikiPath(item.title)} className="list-row-sm">
              <div>
                <div className="font-semibold">{item.title}</div>
                <div className="text-xs muted uppercase tracking-wider">{item.type}</div>
              </div>
              <span className="text-xs muted">
                {new Date(item.updatedAt).toLocaleDateString()}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
