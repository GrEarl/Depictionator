import { requireUser } from "@/lib/auth";
import { getActiveWorkspace } from "@/lib/workspaces";
import { prisma } from "@/lib/prisma";
import { PDFBuilderClient } from "./PDFBuilderClient";
import Link from "next/link";

/**
 * PDF Builder Page
 * Based on AGENTS.md requirement: "印刷セット（Print Pack）ビルダー"
 * Allows users to select entities, maps, and boards to export as a combined PDF
 */
export default async function PDFBuilderPage() {
  const user = await requireUser();
  const workspace = await getActiveWorkspace(user.id);

  if (!workspace) {
    return (
      <div className="page-container">
        <div className="empty-state">
          <h2>No Workspace Selected</h2>
          <p className="muted">Please select a workspace to use the PDF Builder.</p>
          <Link href="/workspaces" className="btn-primary">
            Go to Workspaces
          </Link>
        </div>
      </div>
    );
  }

  // Fetch available items for export
  const [entities, maps, boards] = await Promise.all([
    prisma.entity.findMany({
      where: {
        workspaceId: workspace.id,
        softDeletedAt: null,
      },
      select: {
        id: true,
        title: true,
        type: true,
      },
      orderBy: { title: "asc" },
      take: 200,
    }),
    prisma.map.findMany({
      where: {
        workspaceId: workspace.id,
        softDeletedAt: null,
      },
      select: {
        id: true,
        title: true,
      },
      orderBy: { title: "asc" },
    }),
    prisma.evidenceBoard.findMany({
      where: {
        workspaceId: workspace.id,
        softDeletedAt: null,
      },
      select: {
        id: true,
        name: true,
      },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <div className="page-container pdf-builder-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">PDF Builder</h1>
          <p className="page-subtitle">
            Select and arrange content to export as a combined PDF document
          </p>
        </div>
        <div className="page-actions">
          <Link href="/entities" className="btn-link">
            ← Back to Articles
          </Link>
        </div>
      </div>

      <PDFBuilderClient
        workspaceId={workspace.id}
        entities={entities}
        maps={maps}
        boards={boards}
      />
    </div>
  );
}
