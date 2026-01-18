import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getActiveWorkspace } from "@/lib/workspaces";

export default async function BoardCreatePage() {
  const user = await requireUser();
  const workspace = await getActiveWorkspace(user.id);

  if (!workspace) {
    return (
      <div className="panel max-w-2xl mx-auto mt-8 text-center">
        ボードを作成するにはワークスペースを選択してください。
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="panel flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">新規ボード</h2>
          <p className="text-sm text-muted">
            証拠・参考資料・メモを整理するためのボードを作成します。
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/boards" className="btn-secondary">ボード一覧へ戻る</Link>
          <Link href="/boards/import" className="btn-secondary">インポート</Link>
        </div>
      </div>

      <section className="panel">
        <form action="/api/evidence-boards/create" method="post" className="form-grid">
          <input type="hidden" name="workspaceId" value={workspace.id} />
          <label>
            名前 <input name="name" required placeholder="例: キャラクター関係図" />
            <span className="text-xs text-muted mt-1 block">ボードの名称</span>
          </label>
          <label>
            説明 <textarea name="description" rows={3} placeholder="このボードで整理したい内容" />
            <span className="text-xs text-muted mt-1 block">任意: 目的が分かる簡単な説明</span>
          </label>
          <button type="submit" className="btn-primary">ボードを作成</button>
        </form>
      </section>
    </div>
  );
}
