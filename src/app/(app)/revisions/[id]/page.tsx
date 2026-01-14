import { diffLines } from "diff";
import { requireUser } from "@/lib/auth";
import { requireWorkspaceRole } from "@/lib/rbac";
import { prisma } from "@/lib/db";

type PageProps = { params: Promise<{ id: string }> };

export default async function RevisionDetailPage({ params }: PageProps) {
  const user = await requireUser();
  const { id } = await params;
  const revision = await prisma.articleRevision.findUnique({
    where: { id },
    include: { parentRevision: true }
  });

  if (!revision) {
    return <div className="panel">Revision not found.</div>;
  }

  await requireWorkspaceRole(user.id, revision.workspaceId, "viewer");

  const before = revision.parentRevision?.bodyMd ?? "";
  const after = revision.bodyMd;
  const diff = diffLines(before, after);

  return (
    <div className="panel">
      <h2>Revision {revision.id}</h2>
      <div className="muted">Status: {revision.status}</div>
      <form action="/api/revisions/restore" method="post">
        <input type="hidden" name="workspaceId" value={revision.workspaceId} />
        <input type="hidden" name="revisionId" value={revision.id} />
        <button type="submit" className="link-button">Restore as new draft</button>
      </form>
      <pre className="code-block">
        {diff.map((part, index) => {
          const prefix = part.added ? "+" : part.removed ? "-" : " ";
          return (
            <span key={index} style={{ color: part.added ? "#1f7a3a" : part.removed ? "#b42318" : "inherit" }}>
              {prefix}
              {part.value}
            </span>
          );
        })}
      </pre>
    </div>
  );
}
