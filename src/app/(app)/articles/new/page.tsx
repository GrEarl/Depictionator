import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getActiveWorkspace } from "@/lib/workspaces";
import { MarkdownEditor } from "@/components/MarkdownEditor";
import { EntityType } from "@prisma/client";

const ENTITY_TYPES = Object.values(EntityType);

export default async function ArticleCreatePage() {
  const user = await requireUser();
  const workspace = await getActiveWorkspace(user.id);

  if (!workspace) {
    return (
      <div className="panel max-w-2xl mx-auto mt-8 text-center">
        記事を作成するにはワークスペースを選択してください。
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="panel flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">新規記事</h2>
          <p className="text-sm text-muted">
            新しいエンティティと初期本文を作成します。
          </p>
        </div>
        <Link href="/articles" className="btn-secondary">記事一覧へ戻る</Link>
      </div>

      <section className="panel">
        <form action="/api/articles/create" method="post" className="form-grid">
          <input type="hidden" name="workspaceId" value={workspace.id} />
          <label>
            種別
            <select name="type">{ENTITY_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}</select>
            <span className="text-xs text-muted mt-1 block">どのタイプのエンティティですか？</span>
          </label>
          <label>
            タイトル
            <input name="title" required placeholder="例: 大戦、ヴァリアン卿" />
            <span className="text-xs text-muted mt-1 block">このエンティティの名称</span>
          </label>
          <label>
            タグ
            <input name="tags" placeholder="例: lore, history, major-character" />
            <span className="text-xs text-muted mt-1 block">カンマ区切りで複数指定（例: lore, magic）</span>
          </label>
          <MarkdownEditor name="bodyMd" label="初期本文" rows={10} defaultMode="write" />
          <button type="submit" className="btn-primary">記事を作成</button>
        </form>
      </section>
    </div>
  );
}
