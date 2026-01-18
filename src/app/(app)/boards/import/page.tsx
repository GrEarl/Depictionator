import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getActiveWorkspace } from "@/lib/workspaces";
import { prisma } from "@/lib/prisma";

const SAMPLE_JSON = `{
  "board": { "name": "関係図", "description": "登場人物の関係" },
  "items": [
    { "id": "a", "type": "note", "title": "メモ", "content": "内容", "x": 120, "y": 80 },
    { "id": "b", "type": "url", "title": "資料", "url": "https://example.com", "x": 360, "y": 200 }
  ],
  "links": [
    { "from": "a", "to": "b", "style": "arrow", "label": "参照" }
  ]
}`;

type SearchParams = { [key: string]: string | string[] | undefined };
type PageProps = { searchParams: Promise<SearchParams> };

function parseCount(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value[0] : value;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : 0;
}

export default async function BoardImportPage({ searchParams }: PageProps) {
  const user = await requireUser();
  const workspace = await getActiveWorkspace(user.id);
  const resolvedSearchParams = await searchParams;
  const imported = String(resolvedSearchParams.imported ?? "") === "1";
  const boardId = String(resolvedSearchParams.boardId ?? "");
  const itemsCreated = parseCount(resolvedSearchParams.items);
  const skippedItems = parseCount(resolvedSearchParams.skippedItems);
  const linksCreated = parseCount(resolvedSearchParams.links);
  const skippedLinks = parseCount(resolvedSearchParams.skippedLinks);
  const coercedTypes = parseCount(resolvedSearchParams.coercedTypes);
  const coercedLinkStyles = parseCount(resolvedSearchParams.coercedLinkStyles);
  const skippedEntityRefs = parseCount(resolvedSearchParams.skippedEntityRefs);
  const skippedAssetRefs = parseCount(resolvedSearchParams.skippedAssetRefs);
  const skippedReferenceRefs = parseCount(resolvedSearchParams.skippedReferenceRefs);

  const warnings = [
    skippedItems > 0 ? `不正なアイテムが ${skippedItems} 件スキップされました。` : "",
    skippedLinks > 0 ? `リンク ${skippedLinks} 件が解決できずスキップされました。` : "",
    coercedTypes > 0 ? `不明なアイテム種別が ${coercedTypes} 件あり、noteとして取り込みました。` : "",
    coercedLinkStyles > 0 ? `不明なリンクスタイルが ${coercedLinkStyles} 件あり、lineとして取り込みました。` : "",
    skippedEntityRefs > 0 ? `存在しないエンティティ参照が ${skippedEntityRefs} 件ありました。` : "",
    skippedAssetRefs > 0 ? `存在しないアセット参照が ${skippedAssetRefs} 件ありました。` : "",
    skippedReferenceRefs > 0 ? `存在しない参照資料が ${skippedReferenceRefs} 件ありました。` : ""
  ].filter(Boolean);

  if (!workspace) {
    return (
      <div className="panel max-w-2xl mx-auto mt-8 text-center">
        ボードをインポートするにはワークスペースを選択してください。
      </div>
    );
  }

  const boards = await prisma.evidenceBoard.findMany({
    where: { workspaceId: workspace.id, softDeletedAt: null },
    orderBy: { updatedAt: "desc" },
    select: { id: true, name: true }
  });

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="panel flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">ボードをインポート</h2>
          <p className="text-sm text-muted">
            JSON貼り付け / JSONファイル / 既存ボード複製に対応しました。
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/boards" className="btn-secondary">ボード一覧へ戻る</Link>
          <Link href="/boards/new" className="btn-secondary">ボードを作成</Link>
        </div>
      </div>

      <section className="panel space-y-8">
        {imported && (
          <div className={`border rounded-xl p-4 ${warnings.length ? "border-amber-400/60 bg-amber-50/10" : "border-emerald-400/40 bg-emerald-50/10"}`}>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <h3 className="text-sm font-bold">インポート結果</h3>
                <p className="text-xs text-muted">
                  アイテム {itemsCreated} 件 / リンク {linksCreated} 件
                </p>
              </div>
              {boardId && (
                <Link href={`/boards?board=${boardId}`} className="btn-secondary">
                  作成したボードを開く
                </Link>
              )}
            </div>
            {warnings.length > 0 && (
              <ul className="mt-3 text-xs text-amber-700 dark:text-amber-300 space-y-1">
                {warnings.map((warning) => (
                  <li key={warning}>• {warning}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        <div className="space-y-3">
          <h3 className="text-sm font-bold">JSONを貼り付けてインポート</h3>
          <form action="/api/evidence-boards/import" method="post" className="form-grid">
            <input type="hidden" name="workspaceId" value={workspace.id} />
            <input type="hidden" name="mode" value="json" />
            <label>
              ボード名（任意）
              <input name="name" placeholder="JSONのnameを上書きする場合に入力" />
            </label>
            <label>
              JSON
              <textarea name="json" rows={10} placeholder={SAMPLE_JSON} />
              <span className="text-xs text-muted mt-1 block">linksを使う場合はitemsにidを付けてください。</span>
            </label>
            <button type="submit" className="btn-primary">インポート</button>
          </form>
        </div>

        <div className="space-y-3">
          <h3 className="text-sm font-bold">JSONファイルをアップロード</h3>
          <form action="/api/evidence-boards/import" method="post" encType="multipart/form-data" className="form-grid">
            <input type="hidden" name="workspaceId" value={workspace.id} />
            <input type="hidden" name="mode" value="json" />
            <label>
              ボード名（任意）
              <input name="name" placeholder="JSONのnameを上書きする場合に入力" />
            </label>
            <label>
              JSONファイル
              <input type="file" name="jsonFile" accept="application/json,.json" />
              <span className="text-xs text-muted mt-1 block">.jsonファイルを選択してください。</span>
            </label>
            <button type="submit" className="btn-primary">アップロードしてインポート</button>
          </form>
        </div>

        <div className="space-y-3">
          <h3 className="text-sm font-bold">既存ボードを複製</h3>
          {boards.length === 0 ? (
            <p className="text-sm text-muted">複製できるボードがありません。</p>
          ) : (
            <form action="/api/evidence-boards/import" method="post" className="form-grid">
              <input type="hidden" name="workspaceId" value={workspace.id} />
              <input type="hidden" name="mode" value="duplicate" />
              <label>
                複製元ボード
                <select name="sourceBoardId" required>
                  {boards.map((board) => (
                    <option key={board.id} value={board.id}>{board.name}</option>
                  ))}
                </select>
              </label>
              <label>
                新しいボード名（任意）
                <input name="name" placeholder="空の場合は「（コピー）」が付きます" />
              </label>
              <button type="submit" className="btn-primary">複製して作成</button>
            </form>
          )}
        </div>
      </section>
    </div>
  );
}
