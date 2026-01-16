import { prisma } from "@/lib/db";
import { getCurrentSession, requireUser } from "@/lib/auth";
import { LlmContext } from "@/components/LlmContext";
import { getLocaleFromCookies } from "@/lib/locale";
import { getUiCopy } from "@/lib/i18n";

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

