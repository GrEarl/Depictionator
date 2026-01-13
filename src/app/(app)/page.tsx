import Link from "next/link";
import { prisma } from "@/lib/db";
import { getCurrentSession, requireUser } from "@/lib/auth";

export default async function DashboardPage() {
  const user = await requireUser();
  const session = await getCurrentSession();
  const memberships = await prisma.workspaceMember.findMany({
    where: { userId: user.id },
    include: { workspace: true }
  });

  return (
    <div className="dashboard">
      <section className="panel">
        <h2>Workspaces</h2>
        <p>選択中: {session?.workspace?.name ?? "未選択"}</p>
        <ul>
          {memberships.map((membership) => (
            <li key={membership.id}>
              <Link href={`/app/workspaces/${membership.workspace.slug}`}>
                {membership.workspace.name}
              </Link>
              <span className="muted"> ({membership.role})</span>
            </li>
          ))}
          {memberships.length === 0 && <li className="muted">No workspaces yet.</li>}
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
