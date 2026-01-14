import Link from "next/link";
import { prisma } from "@/lib/db";
import { getCurrentSession, requireUser } from "@/lib/auth";

type MembershipSummary = {
  id: string;
  role: string;
  workspace: { slug: string; name: string };
};
type NotificationSummary = { id: string; type: string };


export default async function DashboardPage() {
  const user = await requireUser();
  const session = await getCurrentSession();
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
      <section className="panel">
        <h2>Workspaces</h2>
        <p>Selected: {session?.workspace?.name ?? "None"}</p>
        <ul>
          {memberships.map((membership) => (
            <li key={membership.id}>
              <Link href={`/workspaces/${membership.workspace.slug}`}>
                {membership.workspace.name}
              </Link>
              <span className="muted"> ({membership.role})</span>
            </li>
          ))}
          {memberships.length === 0 && <li className="muted">No workspaces yet.</li>}
        </ul>
      </section>

      <section className="panel">
        <h2>Notifications</h2>
        <ul>
          {notifications.map((note) => (
            <li key={note.id} className="list-row">
              <span>{note.type}</span>
              <form action="/api/notifications/read" method="post">
                <input type="hidden" name="notificationId" value={note.id} />
                <button type="submit" className="link-button">Mark read</button>
              </form>
            </li>
          ))}
          {notifications.length === 0 && <li className="muted">No unread notifications.</li>}
        </ul>
      </section>

      <section className="panel">
        <h2>Create workspace</h2>
        <form action="/api/workspaces/create" method="post" className="form-grid">
          <label>
            Name
            <input name="name" required />
          </label>
          <label>
            Slug
            <input name="slug" placeholder="optional" />
          </label>
          <button type="submit">Create</button>
        </form>
      </section>

      <section className="panel">
        <h2>Join workspace</h2>
        <form action="/api/workspaces/join" method="post" className="form-grid">
          <label>
            Workspace slug
            <input name="slug" required />
          </label>
          <button type="submit">Join</button>
        </form>
      </section>
    </div>
  );
}

