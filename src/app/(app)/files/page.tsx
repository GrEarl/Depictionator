import { requireUser } from "@/lib/auth";
import { getActiveWorkspace } from "@/lib/workspaces";
import { prisma } from "@/lib/prisma";

export default async function FilesPage() {
  const user = await requireUser();
  const workspace = await getActiveWorkspace(user.id);

  if (!workspace) return <div className="panel">Select a workspace.</div>;

  const assets = await prisma.asset.findMany({
    where: { workspaceId: workspace.id, softDeletedAt: null },
    orderBy: { createdAt: "desc" },
    take: 100
  });

  return (
    <div className="panel">
      <h2 className="text-xl font-bold">Files</h2>
      <p className="muted mt-2">Uploaded and imported assets.</p>
      <div className="file-grid mt-4">
        {assets.length === 0 && <div className="muted">No files yet.</div>}
        {assets.map((asset) => (
          <div key={asset.id} className="file-card">
            {asset.kind === "image" ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={`/api/assets/file/${asset.id}`} alt={asset.storageKey} />
            ) : (
              <div className="file-placeholder">{asset.mimeType}</div>
            )}
            <div className="file-meta">
              <div className="file-name">{asset.storageKey}</div>
              <div className="file-detail">{asset.mimeType}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
