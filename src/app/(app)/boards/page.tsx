import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getActiveWorkspace } from "@/lib/workspaces";
import { LlmContext } from "@/components/LlmContext";
import { EvidenceBoardCanvas } from "@/components/EvidenceBoardCanvas";
import Link from "next/link";

type SearchParams = { [key: string]: string | string[] | undefined };
type PageProps = { searchParams: Promise<SearchParams> };

export default async function BoardsPage({ searchParams }: PageProps) {
  const user = await requireUser();
  const workspace = await getActiveWorkspace(user.id);
  const resolvedSearchParams = await searchParams;

  const selectedBoardId = typeof resolvedSearchParams.board === "string" ? resolvedSearchParams.board : undefined;
  const tab = typeof resolvedSearchParams.tab === "string" ? resolvedSearchParams.tab : "canvas";

  if (!workspace) {
    return <div className="panel">Select a workspace first.</div>;
  }

  const [boards, entities, references] = await Promise.all([
    prisma.evidenceBoard.findMany({
      where: { workspaceId: workspace.id, softDeletedAt: null },
      include: {
        items: { where: { softDeletedAt: null }, include: { entity: true, asset: true, reference: true } },
        links: { where: { softDeletedAt: null } }
      },
      orderBy: { updatedAt: "desc" }
    }),
    prisma.entity.findMany({
      where: { workspaceId: workspace.id, softDeletedAt: null },
      select: { id: true, title: true, type: true },
      orderBy: { title: "asc" }
    }),
    prisma.reference.findMany({
      where: { workspaceId: workspace.id, softDeletedAt: null },
      select: { id: true, title: true, type: true },
      orderBy: { title: "asc" }
    })
  ]);

  const activeBoard = boards.find((b) => b.id === selectedBoardId) || boards[0];

  const buildUrl = (overrides: Record<string, string | undefined>) => {
    const params = new URLSearchParams();
    const merged = { board: selectedBoardId, tab, ...overrides };
    Object.entries(merged).forEach(([key, value]) => {
      if (value !== undefined && value !== "") params.set(key, value);
    });
    const qs = params.toString();
    return qs ? `?${qs}` : "";
  };

  return (
    <div className="layout-3-pane">
      <LlmContext value={{ type: "boards", workspaceId: workspace.id, selectedBoardId: activeBoard?.id }} />

      {/* Left Pane: Board List */}
      <aside className="pane-left">
        <div className="pane-header">
          <h3>Boards ({boards.length})</h3>
        </div>
        <div className="scroll-content">
          <div className="p-2">
            {boards.map((board) => (
              <Link
                key={board.id}
                href={buildUrl({ board: board.id })}
                className={`map-link ${activeBoard?.id === board.id ? "active" : ""}`}
              >
                {board.name}
                <span className="text-xs muted ml-4">{board.items.length} items</span>
              </Link>
            ))}
            {boards.length === 0 && (
              <div className="muted p-4">No boards yet. Create one to start organizing your evidence.</div>
            )}
          </div>
        </div>
      </aside>

      {/* Center Pane: Canvas */}
      <main className="pane-center overflow-hidden">
        {activeBoard ? (
          <EvidenceBoardCanvas
            board={{
              id: activeBoard.id,
              name: activeBoard.name,
              items: activeBoard.items.map((item) => ({
                id: item.id,
                type: item.type,
                title: item.title,
                content: item.content,
                url: item.url,
                x: item.x,
                y: item.y,
                width: item.width,
                height: item.height,
                zIndex: item.zIndex,
                entityId: item.entityId,
                entity: item.entity ? { id: item.entity.id, title: item.entity.title, type: item.entity.type } : null,
                referenceId: item.referenceId,
                reference: item.reference ? { id: item.reference.id, title: item.reference.title } : null
              })),
              links: activeBoard.links.map((link) => ({
                id: link.id,
                fromItemId: link.fromItemId,
                toItemId: link.toItemId,
                label: link.label,
                style: link.style
              }))
            }}
            workspaceId={workspace.id}
            entities={entities}
            references={references}
          />
        ) : (
          <div className="empty-state-centered">
            <h2>No Evidence Boards</h2>
            <p className="muted">
              Create your first board to collect and connect evidence, references, and ideas.
            </p>
          </div>
        )}
      </main>

      {/* Right Pane: Actions */}
      <aside className="pane-right-drawer">
        <div className="pane-header-tabs">
          <Link href={buildUrl({ tab: "canvas" })} className={`tab-link ${tab === "canvas" ? "active" : ""}`}>
            Canvas
          </Link>
          <Link href={buildUrl({ tab: "manage" })} className={`tab-link ${tab === "manage" ? "active" : ""}`}>
            Manage
          </Link>
        </div>

        <div className="drawer-content scroll-content">
          {tab === "manage" && (
            <>
              <div className="p-4 space-y-4">
                <Link href="/boards/new" className="btn-primary w-full justify-center">
                  ボードを作成
                </Link>
                <Link href="/boards/import" className="btn-secondary w-full justify-center">
                  ボードをインポート
                </Link>
                <p className="text-xs text-muted">
                  作成/インポートは専用ページで進めるようにしました。
                </p>
              </div>

              {activeBoard && (
                <details className="action-details">
                  <summary>ボード設定</summary>
                  <form action="/api/evidence-boards/update" method="post" className="form-grid p-4">
                    <input type="hidden" name="workspaceId" value={workspace.id} />
                    <input type="hidden" name="boardId" value={activeBoard.id} />
                    <label>
                      名前 <input name="name" defaultValue={activeBoard.name} />
                    </label>
                    <label>
                      説明 <textarea name="description" rows={2} defaultValue={activeBoard.description || ""} />
                    </label>
                    <button type="submit" className="btn-secondary">更新</button>
                  </form>
                </details>
              )}

              {activeBoard && (
                <details className="action-details">
                  <summary>エクスポート</summary>
                  <div className="p-4 space-y-3">
                    <p className="text-xs text-muted">
                      現在のボードをJSONとしてダウンロードします。
                    </p>
                    <a
                      className="btn-secondary w-full justify-center"
                      href={`/api/evidence-boards/export?workspaceId=${workspace.id}&boardId=${activeBoard.id}`}
                    >
                      JSONをダウンロード
                    </a>
                  </div>
                </details>
              )}
            </>
          )}

          {tab === "canvas" && activeBoard && (
            <div className="p-4">
              <h4 className="text-xs muted mb-4">DRAG TO CANVAS</h4>

              <details className="action-details" open>
                <summary>Entities ({entities.length})</summary>
                <div className="p-2 list-sm">
                  {entities.slice(0, 20).map((entity) => (
                    <div
                      key={entity.id}
                      className="list-row-sm draggable-item"
                      draggable
                      data-type="entity"
                      data-id={entity.id}
                      data-title={entity.title}
                    >
                      <span className="type-tag">{entity.type.slice(0, 3)}</span>
                      <span className="truncate">{entity.title}</span>
                    </div>
                  ))}
                  {entities.length === 0 && <div className="muted">No entities yet</div>}
                </div>
              </details>

              <details className="action-details">
                <summary>References ({references.length})</summary>
                <div className="p-2 list-sm">
                  {references.slice(0, 20).map((ref) => (
                    <div
                      key={ref.id}
                      className="list-row-sm draggable-item"
                      draggable
                      data-type="reference"
                      data-id={ref.id}
                      data-title={ref.title}
                    >
                      <span className="type-tag">{ref.type.slice(0, 3)}</span>
                      <span className="truncate">{ref.title}</span>
                    </div>
                  ))}
                  {references.length === 0 && <div className="muted">No references yet</div>}
                </div>
              </details>

              <details className="action-details">
                <summary>Add Note</summary>
                <form action="/api/evidence-items/create" method="post" className="form-grid p-4">
                  <input type="hidden" name="workspaceId" value={workspace.id} />
                  <input type="hidden" name="boardId" value={activeBoard.id} />
                  <input type="hidden" name="type" value="note" />
                  <input type="hidden" name="x" value="100" />
                  <input type="hidden" name="y" value="100" />
                  <label>
                    Title <input name="title" placeholder="e.g., Plot Twist Idea" />
                  </label>
                  <label>
                    Content <textarea name="content" rows={3} placeholder="Write your note here..." />
                  </label>
                  <button type="submit" className="btn-primary">Add Note</button>
                </form>
              </details>

              <details className="action-details">
                <summary>Add URL</summary>
                <form action="/api/evidence-items/create" method="post" className="form-grid p-4">
                  <input type="hidden" name="workspaceId" value={workspace.id} />
                  <input type="hidden" name="boardId" value={activeBoard.id} />
                  <input type="hidden" name="type" value="url" />
                  <input type="hidden" name="x" value="200" />
                  <input type="hidden" name="y" value="100" />
                  <label>
                    Title <input name="title" placeholder="e.g., Reference Article" />
                  </label>
                  <label>
                    URL <input name="url" type="url" placeholder="https://example.com/article" />
                  </label>
                  <button type="submit" className="btn-primary">Add Link</button>
                </form>
              </details>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
