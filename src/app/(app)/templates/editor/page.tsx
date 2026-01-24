import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getActiveWorkspace } from "@/lib/workspaces";
import { prisma } from "@/lib/prisma";
import { MarkdownEditor } from "@/components/MarkdownEditor";
import { toWikiPath } from "@/lib/wiki";

type SearchParams = { [key: string]: string | string[] | undefined };
type PageProps = { searchParams: Promise<SearchParams> };

function normalizeTemplateName(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  return trimmed.replace(/^Template:/i, "").trim();
}

export default async function TemplateEditorPage({ searchParams }: PageProps) {
  const user = await requireUser();
  const workspace = await getActiveWorkspace(user.id);
  const resolvedSearchParams = await searchParams;

  if (!workspace) return <div className="panel">Select a workspace.</div>;

  const rawName = typeof resolvedSearchParams.name === "string" ? resolvedSearchParams.name : "";
  const baseName = normalizeTemplateName(decodeURIComponent(rawName || ""));

  const candidates = baseName
    ? [`Template:${baseName}`, baseName]
    : [];

  const templateEntity = candidates.length
    ? await prisma.entity.findFirst({
        where: {
          workspaceId: workspace.id,
          softDeletedAt: null,
          OR: candidates.map((title) => ({ title: { equals: title, mode: "insensitive" as const } }))
        },
        include: { article: { include: { baseRevision: true } } }
      })
    : null;

  const templateSeedEntities = await prisma.entity.findMany({
    where: { workspaceId: workspace.id, softDeletedAt: null },
    select: { title: true, tags: true, updatedAt: true }
  });

  const counts = new Map<string, number>();
  templateSeedEntities.forEach((entity) => {
    const isTemplateEntity = entity.title.toLowerCase().startsWith("template:");
    if (isTemplateEntity) {
      const base = entity.title.replace(/^Template:/i, "").trim();
      if (base) counts.set(base, counts.get(base) ?? 0);
    }
    entity.tags
      .filter((tag) => tag.startsWith("template:"))
      .forEach((tag) => {
        if (isTemplateEntity) return;
        const name = tag.replace(/^template:/, "");
        counts.set(name, (counts.get(name) ?? 0) + 1);
      });
  });

  const templates = Array.from(counts.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([name, count]) => ({ name, count }));

  const templateTag = baseName ? `template:${baseName}` : "";
  const usageEntities = baseName
    ? await prisma.entity.findMany({
        where: {
          workspaceId: workspace.id,
          softDeletedAt: null,
          tags: { has: templateTag },
          NOT: { title: { startsWith: "Template:", mode: "insensitive" as const } }
        },
        select: { id: true, title: true, type: true, updatedAt: true },
        orderBy: { updatedAt: "desc" },
        take: 6
      })
    : [];

  const existingTitle = templateEntity?.title ?? (baseName ? `Template:${baseName}` : "");
  const defaultName = templateEntity?.title
    ? templateEntity.title.replace(/^Template:/i, "")
    : baseName;
  const defaultBody = templateEntity?.article?.baseRevision?.bodyMd ?? "";
  const suggestedSyntax = defaultBody
    ? (/(\{\{|\[\[|#REDIRECT)/i.test(defaultBody) ? "wikitext" : "markdown")
    : "wikitext";

  return (
    <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
      <aside className="panel space-y-4">
        <div>
          <h2 className="text-lg font-bold">Template Library</h2>
          <p className="muted mt-1">Browse or open templates in this workspace.</p>
        </div>
        <div className="list-sm">
          {templates.length === 0 && <div className="muted">No templates yet.</div>}
          {templates.map((template) => (
            <Link
              key={template.name}
              href={`/templates/editor?name=${encodeURIComponent(template.name)}`}
              className="list-row-sm"
            >
              <div className="font-semibold">{template.name}</div>
              <span className="muted text-xs">{template.count}</span>
            </Link>
          ))}
        </div>
        <div className="flex gap-2">
          <Link href="/templates" className="btn-secondary">Open list</Link>
          <Link href="/templates/editor" className="btn-secondary">New Template</Link>
        </div>
      </aside>

      <div className="panel space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold">
              {defaultName ? `Template: ${defaultName}` : "New Template"}
            </h2>
            <p className="muted mt-1">Create or edit reusable template content.</p>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/templates" className="btn-secondary">Back</Link>
            {existingTitle && (
              <Link href={toWikiPath(existingTitle)} className="btn-secondary">View</Link>
            )}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-border bg-bg p-4">
            <div className="text-xs uppercase tracking-widest text-muted">Usage</div>
            <div className="mt-2 text-sm font-semibold">
              {baseName ? `${usageEntities.length} recent references` : "Select a template to see usage"}
            </div>
            <div className="mt-3 space-y-2">
              {usageEntities.map((entity) => (
                <Link key={entity.id} href={toWikiPath(entity.title)} className="list-row-sm">
                  <div>
                    <div className="font-semibold">{entity.title}</div>
                    <div className="text-xs muted uppercase tracking-wider">{entity.type}</div>
                  </div>
                  <span className="text-xs muted">
                    {new Date(entity.updatedAt).toLocaleDateString()}
                  </span>
                </Link>
              ))}
              {baseName && usageEntities.length === 0 && (
                <div className="text-xs text-muted">No articles are using this template yet.</div>
              )}
            </div>
          </div>
          <div className="rounded-xl border border-border bg-bg p-4 space-y-2">
            <div className="text-xs uppercase tracking-widest text-muted">Quick Tips</div>
            <ul className="text-sm text-muted space-y-2">
              <li>Use <code>{{`{{TEMPLATE:Name}}`}}</code> to embed templates.</li>
              <li>Templates are stored as entities for revision history.</li>
              <li>Keep names short and consistent with your wiki naming.</li>
            </ul>
          </div>
        </div>

        <form action="/api/templates/save" method="post" className="form-grid">
          <input type="hidden" name="workspaceId" value={workspace.id} />
          <label>
            Template name
            <input
              name="name"
              defaultValue={defaultName}
              placeholder="e.g., Infobox Character"
            />
          </label>
          <label>
            Change summary
            <input
              name="changeSummary"
              defaultValue={templateEntity ? "Update template" : "Create template"}
            />
          </label>
          <MarkdownEditor
            name="bodyMd"
            label="Template body"
            workspaceId={workspace.id}
            defaultValue={defaultBody}
            rows={18}
            defaultMode="split"
            defaultSyntax={suggestedSyntax}
          />
          <div className="flex gap-2">
            <button type="submit" className="btn-primary">Save Template</button>
          </div>
        </form>
      </div>
    </div>
  );
}
