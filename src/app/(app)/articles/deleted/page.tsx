import { requireUser } from "@/lib/auth";
import { getActiveWorkspace } from "@/lib/workspaces";
import { prisma } from "@/lib/prisma";

export default async function DeletedArticlesPage() {
  const user = await requireUser();
  const workspace = await getActiveWorkspace(user.id);

  if (!workspace) return <div className="panel">Select a workspace.</div>;

  const archivedEntities = await prisma.entity.findMany({
    where: { workspaceId: workspace.id, softDeletedAt: { not: null } },
    orderBy: { updatedAt: "desc" },
    select: { id: true, title: true, type: true, updatedAt: true }
  });

  return (
    <div className="panel">
      <h2 className="text-xl font-bold">Deleted Articles</h2>
      <p className="muted mt-2">Restore soft-deleted articles.</p>
      <div className="list-sm mt-4">
        {archivedEntities.length === 0 && (
          <div className="muted">No deleted articles.</div>
        )}
        {archivedEntities.map((entity) => (
          <div key={entity.id} className="list-row-sm">
            <div>
              <div className="font-semibold">{entity.title}</div>
              <div className="text-xs muted uppercase tracking-wider">{entity.type}</div>
            </div>
            <div className="flex items-center gap-3">
              <form action="/api/restore" method="post">
                <input type="hidden" name="workspaceId" value={workspace.id} />
                <input type="hidden" name="targetType" value="entity" />
                <input type="hidden" name="targetId" value={entity.id} />
                <button type="submit" className="btn-secondary">Restore</button>
              </form>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
