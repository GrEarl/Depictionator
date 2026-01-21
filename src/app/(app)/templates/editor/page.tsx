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

  const existingTitle = templateEntity?.title ?? (baseName ? `Template:${baseName}` : "");
  const defaultName = templateEntity?.title
    ? templateEntity.title.replace(/^Template:/i, "")
    : baseName;
  const defaultBody = templateEntity?.article?.baseRevision?.bodyMd ?? "";
  const suggestedSyntax = defaultBody
    ? (/(\{\{|\[\[|#REDIRECT)/i.test(defaultBody) ? "wikitext" : "markdown")
    : "wikitext";

  return (
    <div className="panel space-y-4">
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
  );
}
