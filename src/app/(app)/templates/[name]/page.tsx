import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getActiveWorkspace } from "@/lib/workspaces";
import { prisma } from "@/lib/prisma";
import { toWikiPath } from "@/lib/wiki";

type PageProps = { params: Promise<{ name: string }> };

export default async function TemplateDetailPage({ params }: PageProps) {
  const user = await requireUser();
  const workspace = await getActiveWorkspace(user.id);

  if (!workspace) return <div className="panel">Select a workspace.</div>;

  const { name } = await params;
  const decoded = decodeURIComponent(name);
  const baseName = decoded.replace(/^Template:/i, "").trim();
  const templateTitle = `Template:${baseName}`;
  const tag = `template:${baseName}`;

  const entities = await prisma.entity.findMany({
    where: { workspaceId: workspace.id, softDeletedAt: null, tags: { has: tag } },
    select: { id: true, title: true, type: true, updatedAt: true },
    orderBy: { updatedAt: "desc" }
  });

  return (
    <div className="panel">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Template: {baseName}</h2>
          <p className="muted mt-2">{entities.length} articles</p>
        </div>
        <div className="flex gap-2">
          <Link
            href={`/templates/editor?name=${encodeURIComponent(baseName)}`}
            className="btn-secondary"
          >
            Edit Template
          </Link>
          <Link href={toWikiPath(templateTitle)} className="btn-secondary">
            View
          </Link>
        </div>
      </div>
      <div className="list-sm mt-4">
        {entities.length === 0 && <div className="muted">No articles using this template.</div>}
        {entities.map((entity) => (
          <Link key={entity.id} href={toWikiPath(entity.title)} className="list-row-sm">
            <div>
              <div className="font-semibold">{entity.title}</div>
              <div className="text-xs muted uppercase tracking-wider">{entity.type}</div>
            </div>
            <span className="text-xs muted">
              {new Date(entity.updatedAt).toLocaleDateString()}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
