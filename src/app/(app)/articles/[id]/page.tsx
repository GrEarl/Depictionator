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
    // We fetch all relevant overlays to allow switching in the client if we wanted, 
    // but for now let's respect the filter to keep payload small if needed.
    // Actually, fetching all non-deleted overlays is better for client-side switching if we implement it later.
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
      }
    }
  });

  if (!entity) return <div className="panel">Not found.</div>;

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
      />
    </>
  );
}