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
        <section className="panel world-overview">
          <h2>🌍 {session?.workspace?.name} - World Overview</h2>

          <div className="overview-grid">
            {/* Entity Stats */}
            <div className="overview-card">
              <h3>📚 Entities</h3>
              <div className="stat-large">{entities.length}</div>
              <div className="stat-breakdown">
                {Object.entries(entityCounts).slice(0, 5).map(([type, count]) => (
                  <div key={type} className="stat-row">
                    <span className={`entity-type-badge type-${type}`}>{type}</span>
                    <span className="stat-count">{count}</span>
                  </div>
                ))}
              </div>
              <Link href="/articles" className="card-action-link">View all →</Link>
            </div>

            {/* Maps */}
            <div className="overview-card">
              <h3>🗺️ Maps</h3>
              <div className="stat-large">{maps.length}</div>
              <div className="recent-list">
                {maps.slice(0, 3).map((map) => (
                  <Link key={map.id} href={`/maps?map=${map.id}`} className="recent-item">
                    {map.title}
                  </Link>
                ))}
              </div>
              <Link href="/maps" className="card-action-link">Open Maps →</Link>
            </div>

            {/* Evidence Boards */}
            <div className="overview-card">
              <h3>🔍 Boards</h3>
              <div className="stat-large">{evidenceBoards.length}</div>
              <div className="recent-list">
                {evidenceBoards.slice(0, 3).map((board) => (
                  <Link key={board.id} href={`/boards?board=${board.id}`} className="recent-item">
                    {board.name}
                  </Link>
                ))}
              </div>
              <Link href="/boards" className="card-action-link">Open Boards →</Link>
            </div>

            {/* Recent Updates */}
            <div className="overview-card">
              <h3>⏰ Recent Updates</h3>
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
              <Link href="/articles" className="card-action-link">View all →</Link>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="quick-actions">
            <h3>⚡ Quick Actions</h3>
            <div className="action-buttons">
              <Link href="/articles?action=new" className="action-btn">
                + New Entity
              </Link>
              <Link href="/maps" className="action-btn">
                🗺️ Open Maps
              </Link>
              <Link href="/boards" className="action-btn">
                🔍 Evidence Board
              </Link>
              <Link href="/timeline" className="action-btn">
                📅 Timeline
              </Link>
            </div>
          </div>
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


