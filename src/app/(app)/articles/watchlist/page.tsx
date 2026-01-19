import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getActiveWorkspace } from "@/lib/workspaces";
import { prisma } from "@/lib/prisma";
import { toWikiPath } from "@/lib/wiki";

export default async function WatchlistPage() {
  const user = await requireUser();
  const workspace = await getActiveWorkspace(user.id);

  if (!workspace) return <div className="panel">Select a workspace.</div>;

  const watches = await prisma.watch.findMany({
    where: {
      workspaceId: workspace.id,
      userId: user.id,
      targetType: "entity",
      notifyInApp: true
    },
    include: {
      user: true
    },
    orderBy: { createdAt: "desc" }
  });

  const entityIds = watches.map((w) => w.targetId);
  const entities = entityIds.length
    ? await prisma.entity.findMany({
        where: { workspaceId: workspace.id, id: { in: entityIds }, softDeletedAt: null },
        select: { id: true, title: true, type: true, updatedAt: true }
      })
    : [];

  const entityMap = new Map(entities.map((e) => [e.id, e]));

  return (
    <div className="panel">
      <h2 className="text-xl font-bold">Watchlist</h2>
      <p className="muted mt-2">Articles you are watching for updates.</p>
      <div className="list-sm mt-4">
        {watches.length === 0 && (
          <div className="muted">No watched articles yet.</div>
        )}
        {watches.map((watch) => {
          const entity = entityMap.get(watch.targetId);
          if (!entity) return null;
          return (
            <Link key={watch.id} href={toWikiPath(entity.title)} className="list-row-sm">
              <div>
                <div className="font-semibold">{entity.title}</div>
                <div className="text-xs muted uppercase tracking-wider">{entity.type}</div>
              </div>
              <span className="text-xs muted">
                {new Date(entity.updatedAt).toLocaleDateString()}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
