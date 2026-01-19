import { prisma } from "@/lib/prisma";
import { getCurrentSession, requireUser } from "@/lib/auth";
import { LlmContext } from "@/components/LlmContext";
import { getLocaleFromCookies } from "@/lib/locale";
import { getUiCopy } from "@/lib/i18n";
import { OnboardingModal } from "@/components/OnboardingModal";
import Link from "next/link";
import { toWikiPath } from "@/lib/wiki";

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
      <OnboardingModal hasMemberships={memberships.length > 0} />
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
          <h2 className="text-2xl font-bold tracking-tight mb-6">{session?.workspace?.name} {copy.dashboard.overview}</h2>

          {entities.length === 0 && maps.length === 0 ? (
            <div className="panel-game p-16 text-center animate-fade-in">
              <div className="max-w-2xl mx-auto space-y-8">
                <div className="w-24 h-24 bg-gradient-accent rounded-full flex items-center justify-center mx-auto mb-6 animate-pulse">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-12 h-12 text-white">
                    <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                  </svg>
                </div>
                <h3 className="text-4xl font-black text-ink uppercase tracking-tight">{copy.dashboard.beginLegend}</h3>
                <p className="text-ink-secondary text-lg leading-relaxed font-semibold whitespace-pre-wrap">
                  {copy.dashboard.canvasAwaits}
                </p>
                <div className="flex gap-6 justify-center pt-8">
                  <Link href="/articles?action=new" className="action-btn text-lg px-10 py-5">
                    ▶ {copy.dashboard.createFirstEntity}
                  </Link>
                  <Link href="/maps" className="px-10 py-5 bg-bg-elevated border-2 border-accent text-accent hover:bg-accent/10 font-bold uppercase tracking-wide transition-all glow-on-hover">
                    {copy.dashboard.openAtlas}
                  </Link>
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className="overview-grid stagger-children">
                {/* Entity Stats */}
                <div className="overview-card animate-slide-in">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-muted mb-2">{copy.nav.articles}</h3>
                  <div className="stat-large">{entities.length}</div>
                  <div className="stat-breakdown">
                    {Object.entries(entityCounts).slice(0, 5).map(([type, count]) => (
                      <div key={type} className="stat-row">
                        <span className={`entity-type-badge type-${type}`}>{type}</span>
                        <span className="stat-count">{count}</span>
                      </div>
                    ))}
                  </div>
                  <Link href="/articles" className="card-action-link">View all {copy.nav.articles}</Link>
                </div>

                {/* Maps */}
                <div className="overview-card">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-muted mb-2">{copy.nav.maps}</h3>
                  <div className="stat-large">{maps.length}</div>
                  <div className="recent-list">
                    {maps.slice(0, 3).map((map) => (
                      <Link key={map.id} href={`/maps?map=${map.id}`} className="recent-item">
                        {map.title}
                      </Link>
                    ))}
                  </div>
                  <Link href="/maps" className="card-action-link">{copy.dashboard.openAtlas}</Link>
                </div>

                {/* Evidence Boards */}
                <div className="overview-card">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-muted mb-2">{copy.nav.boards}</h3>
                  <div className="stat-large">{evidenceBoards.length}</div>
                  <div className="recent-list">
                    {evidenceBoards.slice(0, 3).map((board) => (
                      <Link key={board.id} href={`/boards?board=${board.id}`} className="recent-item">
                        {board.name}
                      </Link>
                    ))}
                  </div>
                  <Link href="/boards" className="card-action-link">{copy.dashboard.openBoards}</Link>
                </div>

                {/* Recent Updates */}
                <div className="overview-card">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-muted mb-2">{copy.dashboard.recentActivity}</h3>
                  <div className="recent-list">
                    {recentArticles.slice(0, 5).map((rev) => (
                      <Link
                        key={rev.id}
                        href={toWikiPath(rev.article?.entity?.title ?? "Article")}
                        className="recent-item"
                      >
                        {rev.article?.entity?.title || "Article"}
                      </Link>
                    ))}
                  </div>
                  <Link href="/articles" className="card-action-link">View all Activity</Link>
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
        <p className="text-muted text-sm mb-4">Create a new workspace to organize your worldbuilding project.</p>
        <form action="/api/workspaces/create" method="post" className="form-grid">
          <label>
            {copy.dashboard.name}
            <input name="name" required placeholder="e.g., Chronicles of Aetheria" />
            <span className="text-xs text-muted mt-1 block">A descriptive name for your project</span>
          </label>
          <label>
            {copy.dashboard.slug}
            <input name="slug" placeholder="e.g., aetheria (optional, auto-generated if empty)" />
            <span className="text-xs text-muted mt-1 block">URL-friendly identifier. Leave blank to auto-generate from name.</span>
          </label>
          <button type="submit">{copy.dashboard.createAction}</button>
        </form>
      </section>

      <section className="panel">
        <h2>{copy.dashboard.join}</h2>
        <p className="text-muted text-sm mb-4">Join an existing workspace using its unique identifier.</p>
        <form action="/api/workspaces/join" method="post" className="form-grid">
          <label>
            {copy.dashboard.workspaceSlug}
            <input name="slug" required placeholder="e.g., aetheria" />
            <span className="text-xs text-muted mt-1 block">Ask the workspace owner for the project slug</span>
          </label>
          <button type="submit">{copy.dashboard.joinAction}</button>
        </form>
      </section>
    </div>
  );
}

