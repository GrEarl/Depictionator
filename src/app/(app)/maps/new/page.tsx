import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getActiveWorkspace } from "@/lib/workspaces";
import { prisma } from "@/lib/prisma";

export default async function MapCreatePage() {
  const user = await requireUser();
  const workspace = await getActiveWorkspace(user.id);

  if (!workspace) {
    return (
      <div className="panel max-w-2xl mx-auto mt-8 text-center">
        地図を作成するにはワークスペースを選択してください。
      </div>
    );
  }

  const maps = await prisma.map.findMany({
    where: { workspaceId: workspace.id, softDeletedAt: null },
    orderBy: { title: "asc" }
  });

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="panel flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">新規地図</h2>
          <p className="text-sm text-muted">
            地図を作成したら、編集画面でピンや動線を配置できます。
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/maps" className="btn-secondary">地図一覧へ戻る</Link>
          <Link href="/maps/import" className="btn-secondary">インポート</Link>
        </div>
      </div>

      <section className="panel">
        <form action="/api/maps/create" method="post" className="form-grid">
          <input type="hidden" name="workspaceId" value={workspace.id} />
          <label>
            タイトル
            <input name="title" required placeholder="例: 世界地図、エロリア王国" />
            <span className="text-xs text-muted mt-1 block">地図の名称</span>
          </label>
          <label>
            親マップ
            <select name="parentMapId">
              <option value="">なし（トップレベル）</option>
              {maps.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.title}
                </option>
              ))}
            </select>
            <span className="text-xs text-muted mt-1 block">任意: 他の地図のサブマップにできます</span>
          </label>
          <button type="submit" className="btn-primary">地図を作成</button>
        </form>
      </section>
    </div>
  );
}
