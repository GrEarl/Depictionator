import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getActiveWorkspace } from "@/lib/workspaces";
import { WikiMapImportPanel } from "@/components/WikiMapImportPanel";

export default async function MapImportPage() {
  const user = await requireUser();
  const workspace = await getActiveWorkspace(user.id);

  if (!workspace) {
    return (
      <div className="panel max-w-2xl mx-auto mt-8 text-center">
        地図をインポートするにはワークスペースを選択してください。
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="panel flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">地図をインポート</h2>
          <p className="text-sm text-muted">
            Wikipediaの画像を取得して地図として取り込みます。
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/maps" className="btn-secondary">地図一覧へ戻る</Link>
          <Link href="/maps/new" className="btn-secondary">地図を作成</Link>
        </div>
      </div>

      <section className="panel">
        <WikiMapImportPanel workspaceId={workspace.id} />
      </section>
    </div>
  );
}
