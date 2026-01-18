import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getActiveWorkspace } from "@/lib/workspaces";
import { WikiArticleImportPanel } from "@/components/WikiArticleImportPanel";
import { EntityType } from "@prisma/client";

const ENTITY_TYPES = Object.values(EntityType);

export default async function ArticleImportPage() {
  const user = await requireUser();
  const workspace = await getActiveWorkspace(user.id);

  if (!workspace) {
    return (
      <div className="panel max-w-2xl mx-auto mt-8 text-center">
        記事をインポートするにはワークスペースを選択してください。
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="panel flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">記事をインポート</h2>
          <p className="text-sm text-muted">
            Wikipediaから検索して記事を取り込みます。
          </p>
        </div>
        <Link href="/articles" className="btn-secondary">記事一覧へ戻る</Link>
      </div>

      <section className="panel">
        <WikiArticleImportPanel workspaceId={workspace.id} entityTypes={ENTITY_TYPES} />
      </section>
    </div>
  );
}
