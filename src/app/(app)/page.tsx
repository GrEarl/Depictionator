import { prisma } from "@/lib/prisma";
import { getCurrentSession, requireUser } from "@/lib/auth";
import { LlmContext } from "@/components/LlmContext";
import { getLocaleFromCookies } from "@/lib/locale";
import { getUiCopy } from "@/lib/i18n";
import Link from "next/link";

type MembershipSummary = {
  id: string;
  role: string;
  workspace: { slug: string; name: string };
};
type NotificationSummary = { id: string; type: string };


export default async function DashboardPage() {
  const user = await requireUser();
  const session = await getCurrentSession();
  const locale = await getLocaleFromCookies();
  const copy = getUiCopy(locale);
  const memberships: MembershipSummary[] = await prisma.workspaceMember.findMany({
    where: { userId: user.id },
    include: { workspace: true }
  });
  const notifications: NotificationSummary[] = await prisma.notification.findMany({
    where: { userId: user.id, readAt: null },
    orderBy: { createdAt: "desc" },
    take: 10
  });

  const workspaceId = session?.workspace?.id;

  // Fetch world overview data
  const [entities, recentArticles, maps, evidenceBoards] = workspaceId
    ? await Promise.all([
        prisma.entity.findMany({
          where: { workspaceId, softDeletedAt: null },
          select: { id: true, title: true, type: true, updatedAt: true },
          orderBy: { updatedAt: "desc" },
          take: 20
        }),
        prisma.articleRevision.findMany({
          where: { workspaceId, status: "approved" },
          include: { article: { include: { entity: true } } },
          orderBy: { approvedAt: "desc" },
          take: 10
        }),
        prisma.map.findMany({
          where: { workspaceId, softDeletedAt: null },
          select: { id: true, title: true, updatedAt: true },
          orderBy: { updatedAt: "desc" },
          take: 5
        }),
        prisma.evidenceBoard.findMany({
          where: { workspaceId, softDeletedAt: null },
          select: { id: true, name: true, updatedAt: true },
          orderBy: { updatedAt: "desc" },
          take: 5
        })
      ])
    : [[], [], [], []];

  // Entity type counts
  const entityCounts = entities.reduce((acc, e) => {
    acc[e.type] = (acc[e.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="dashboard">
      <LlmContext
        value={{
          type: "dashboard",
          currentWorkspaceId: session?.workspace?.id ?? null,
          workspaceSlugs: memberships.map((membership) => membership.workspace.slug),
          unreadNotificationTypes: notifications.map((note) => note.type)
        }}
      />

      {/* World Overview */}
      {workspaceId && (
        <section className="panel world-overview space-y-8">
          <h2 className="text-2xl font-bold tracking-tight mb-6">{session?.workspace?.name} Overview</h2>

          {entities.length === 0 && maps.length === 0 ? (
            <div className="bg-panel border border-dashed border-border rounded-xl p-12 text-center animate-in fade-in zoom-in duration-500">
              <div className="max-w-md mx-auto space-y-6">
                <div className="w-16 h-16 bg-accent/10 text-accent rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-8 h-8">
                    <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-ink">Welcome to Depictionator</h3>
                <p className="text-muted leading-relaxed">
                  Start building your world by creating your first entity or importing a map.
                  The journey begins with a single point of data.
                </p>
                <div className="flex gap-4 justify-center pt-4">
                  <Link href="/articles?action=new" className="action-btn">
                    Create First Entity
                  </Link>
                  <Link href="/maps" className="btn-secondary px-6 py-3 rounded-lg font-bold flex items-center gap-2">
                    Open Atlas
                  </Link>
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className="overview-grid">
                {/* Entity Stats */}
                <div className="overview-card">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-muted">Entities</h3>
                  <div className="stat-large">{entities.length}</div>
                  <div className="stat-breakdown">
                    {Object.entries(entityCounts).slice(0, 5).map(([type, count]) => (
                      <div key={type} className="stat-row">
                        <span className={`entity-type-badge type-${type}`}>{type}</span>
                        <span className="stat-count">{count}</span>
                      </div>
                    ))}
                  </div>
                  <Link href="/articles" className="card-action-link">View all Articles</Link>
                </div>

                {/* Maps */}
                <div className="overview-card">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-muted">Maps</h3>
                  <div className="stat-large">{maps.length}</div>
                  <div className="recent-list">
                    {maps.slice(0, 3).map((map) => (
                      <Link key={map.id} href={`/maps?map=${map.id}`} className="recent-item">
                        {map.title}
                      </Link>
                    ))}
                  </div>
                  <Link href="/maps" className="card-action-link">Open Atlas</Link>
                </div>

                {/* Evidence Boards */}
                <div className="overview-card">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-muted">Evidence Boards</h3>
                  <div className="stat-large">{evidenceBoards.length}</div>
                  <div className="recent-list">
                    {evidenceBoards.slice(0, 3).map((board) => (
                      <Link key={board.id} href={`/boards?board=${board.id}`} className="recent-item">
                        {board.name}
                      </Link>
                    ))}
                  </div>
                  <Link href="/boards" className="card-action-link">Open Boards</Link>
                </div>

                {/* Recent Updates */}
                <div className="overview-card">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-muted">Recent Activity</h3>
                  <div className="recent-list">
                    {recentArticles.slice(0, 5).map((rev) => (
                      <Link
                        key={rev.id}
                        href={`/articles/${rev.article?.entityId}`}
                        className="recent-item"
                      >
                        {rev.article?.entity?.title || "Article"}
                      </Link>
                    ))}
                  </div>
                  <Link href="/articles" className="card-action-link">View all Activity</Link>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="quick-actions">
                <h3 className="text-xs font-bold uppercase tracking-widest text-muted mb-4">Quick Actions</h3>
                <div className="action-buttons">
                  <Link href="/articles?action=new" className="action-btn">
                    New Entity
                  </Link>
                  <Link href="/maps" className="action-btn">
                    Open Maps
                  </Link>
                  <Link href="/boards" className="action-btn">
                    Evidence Board
                  </Link>
                  <Link href="/timeline" className="action-btn">
                    Timeline
                  </Link>
                </div>
              </div>
            </>
          )}
        </section>
      )}

      <section className="panel">
        <h2>{copy.dashboard.workspaces}</h2>
        <p>
          {copy.workspace.selected}: {session?.workspace?.name ?? copy.workspace.none}
        </p>
        <ul>
          {memberships.map((membership) => (
            <li key={membership.id} className="list-row">
              <form action="/api/workspaces/open" method="post">
                <input type="hidden" name="slug" value={membership.workspace.slug} />
                <button type="submit" className="link-button">
                  {membership.workspace.name}
                </button>
              </form>
              <span className="muted">({membership.role})</span>
            </li>
          ))}
          {memberships.length === 0 && <li className="muted">{copy.dashboard.none}</li>}
        </ul>
      </section>

      <section className="panel">
        <h2>{copy.dashboard.notifications}</h2>
        <ul>
          {notifications.map((note) => (
            <li key={note.id} className="list-row">
              <span>{note.type}</span>
              <form action="/api/notifications/read" method="post">
                <input type="hidden" name="notificationId" value={note.id} />
                <button type="submit" className="link-button">{copy.dashboard.markRead}</button>
              </form>
            </li>
          ))}
          {notifications.length === 0 && <li className="muted">{copy.dashboard.noUnread}</li>}
        </ul>
      </section>

      <section className="panel">
        <h2>{copy.dashboard.create}</h2>
        <form action="/api/workspaces/create" method="post" className="form-grid">
          <label>
            {copy.dashboard.name}
            <input name="name" required />
          </label>
          <label>
            {copy.dashboard.slug}
            <input name="slug" placeholder="optional" />
          </label>
          <button type="submit">{copy.dashboard.createAction}</button>
        </form>
      </section>

      <section className="panel">
        <h2>{copy.dashboard.join}</h2>
        <form action="/api/workspaces/join" method="post" className="form-grid">
          <label>
            {copy.dashboard.workspaceSlug}
            <input name="slug" required />
          </label>
          <button type="submit">{copy.dashboard.joinAction}</button>
        </form>
      </section>
    </div>
  );
}


