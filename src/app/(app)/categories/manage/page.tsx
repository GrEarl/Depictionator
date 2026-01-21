import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getActiveWorkspace } from "@/lib/workspaces";
import { prisma } from "@/lib/prisma";
import { CategoryManager } from "@/components/CategoryManager";

export default async function CategoryManagePage() {
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
      .filter((tag) => tag.startsWith("category:"))
      .forEach((tag) => {
        const name = tag.replace(/^category:/, "");
        counts.set(name, (counts.get(name) ?? 0) + 1);
      });
  });

  const categories = Array.from(counts.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([name, count]) => ({ name, count }));

  return (
    <div className="panel space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Categories</h2>
          <p className="muted mt-1">Manage category tags in this workspace.</p>
        </div>
        <Link href="/categories" className="btn-secondary">Back to list</Link>
      </div>
      <CategoryManager workspaceId={workspace.id} categories={categories} />
    </div>
  );
}
