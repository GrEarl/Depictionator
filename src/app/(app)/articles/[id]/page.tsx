import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { getActiveWorkspace } from "@/lib/workspaces";
import { LlmContext } from "@/components/LlmContext";
import { AutoMarkRead } from "@/components/AutoMarkRead";
import { ArticleDetail } from "@/components/ArticleDetail";

type SearchParams = { [key: string]: string | string[] | undefined };

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<SearchParams>;
};

export default async function ArticleDetailPage({ params, searchParams }: PageProps) {
  const user = await requireUser();
  const workspace = await getActiveWorkspace(user.id);
  if (!workspace) {
    return <div className="panel">Select a workspace.</div>;
  }
  const { id } = await params;
  const resolvedSearchParams = await searchParams;

  const mode = String(resolvedSearchParams.mode ?? "canon");
  const viewpoint = String(resolvedSearchParams.viewpoint ?? "canon");
  const eraFilter = String(resolvedSearchParams.era ?? "all");
  const chapterFilter = String(resolvedSearchParams.chapter ?? "all");

  const overlayWhere = {
    softDeletedAt: null,
  };

  const entity = await prisma.entity.findUnique({
    where: { id },
    include: {
      article: {
        include: {
          revisions: { orderBy: { createdAt: "desc" } },
          baseRevision: true
        }
      },
      overlays: {
        where: overlayWhere,
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

  if (!entity) return <div className="panel">Not found.</div>;

  // Get related entities for the sidebar
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
    <>
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
      />
    </>
  );
}