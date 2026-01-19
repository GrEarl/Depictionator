import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getActiveWorkspace } from "@/lib/workspaces";
import { prisma } from "@/lib/prisma";

export default async function TemplatesPage() {
  const user = await requireUser();
  const workspace = await getActiveWorkspace(user.id);

  if (!workspace) return <div className="panel">Select a workspace.</div>;

  const entities = await prisma.entity.findMany({
    where: { workspaceId: workspace.id, softDeletedAt: null },
    select: { tags: true }
  });

  const counts = new Map<string, number>();
  entities.forEach((entity) => {
    entity.tags
      .filter((tag) => tag.startsWith("template:"))
      .forEach((tag) => {
        const name = tag.replace(/^template:/, "");
        counts.set(name, (counts.get(name) ?? 0) + 1);
      });
  });

  const templates = Array.from(counts.entries()).sort((a, b) => a[0].localeCompare(b[0]));

  return (
    <div className="panel">
      <h2 className="text-xl font-bold">Templates</h2>
      <p className="muted mt-2">Templates referenced in articles.</p>
      <div className="list-sm mt-4">
        {templates.length === 0 && <div className="muted">No templates yet.</div>}
        {templates.map(([name, count]) => (
          <Link key={name} href={`/templates/${encodeURIComponent(name)}`} className="list-row-sm">
            <div className="font-semibold">{name}</div>
            <span className="muted text-xs">{count}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
