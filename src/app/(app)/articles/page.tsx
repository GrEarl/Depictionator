import Link from "next/link";
import { FilterSummary } from "@/components/FilterSummary";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getActiveWorkspace } from "@/lib/workspaces";
import { LlmContext } from "@/components/LlmContext";
import { MarkdownEditor } from "@/components/MarkdownEditor";
import { WikiArticleImportPanel } from "@/components/WikiArticleImportPanel";

const ENTITY_TYPES = [
  "nation",
  "faction",
  "character",
  "location",
  "building",
  "item",
  "event",
  "map",
  "concept"
];

const ENTITY_STATUSES = ["draft", "in_review", "approved", "deprecated"];

type EntitySummary = {
  id: string;
  title: string;
  type: string;
  article?: { baseRevisionId: string | null } | null;
};

type SearchParams = { [key: string]: string | string[] | undefined };
type PageProps = { searchParams: Promise<SearchParams> };

export default async function ArticlesPage({ searchParams }: PageProps) {
  const user = await requireUser();
  const workspace = await getActiveWorkspace(user.id);
  const resolvedSearchParams = await searchParams;
  const eraFilter = String(resolvedSearchParams.era ?? "all");
  const chapterFilter = String(resolvedSearchParams.chapter ?? "all");
  const viewpointFilter = String(resolvedSearchParams.viewpoint ?? "canon");
  const mode = String(resolvedSearchParams.mode ?? "canon");
  const query = String(resolvedSearchParams.q ?? "").trim();
  const typeFilterRaw = String(resolvedSearchParams.type ?? "all").toLowerCase();
  const statusFilterRaw = String(resolvedSearchParams.status ?? "all").toLowerCase();
  const tagsRaw = String(resolvedSearchParams.tags ?? "").trim();
  const unreadOnly = String(resolvedSearchParams.unread ?? "false") === "true";

  const typeFilter = ENTITY_TYPES.includes(typeFilterRaw) ? typeFilterRaw : "all";
  const statusFilter = ENTITY_STATUSES.includes(statusFilterRaw) ? statusFilterRaw : "all";
  const tagList = tagsRaw
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);

  // Parse filters
  // const eraFilter = String(searchParams.era ?? "all");
  // const chapterFilter = String(searchParams.chapter ?? "all");
  // const viewpointFilter = String(searchParams.viewpoint ?? "canon");

  const entities = workspace
    ? await prisma.entity.findMany({
        where: {
          workspaceId: workspace.id,
          softDeletedAt: null,
          ...(typeFilter === "all" ? {} : { type: typeFilter }),
          ...(statusFilter === "all" ? {} : { status: statusFilter }),
          ...(eraFilter === "all"
            ? {}
            : {
                OR: [
                  { worldExistFrom: eraFilter },
                  { worldExistTo: eraFilter },
                  { worldExistFrom: null, worldExistTo: null }
                ]
              }),
          ...(chapterFilter === "all"
            ? {}
            : {
                OR: [{ storyIntroChapterId: chapterFilter }, { storyIntroChapterId: null }]
              }),
          ...(query
            ? {
                OR: [
                  { title: { contains: query, mode: "insensitive" } },
                  { aliases: { has: query } },
                  { tags: { has: query } }
                ]
              }
            : {}),
          ...(tagList.length > 0 ? { tags: { hasSome: tagList } } : {})
        },
        include: { article: { select: { baseRevisionId: true } } },
        orderBy: { updatedAt: "desc" }
      })
    : [];
  const readStates = workspace
    ? await prisma.readState.findMany({
        where: {
          workspaceId: workspace.id,
          userId: user.id,
          targetType: "entity"
        }
      })
    : [];
  const readStateMap = new Map<string, { lastReadRevisionId?: string | null }>(
    readStates.map((state: { targetId: string; lastReadRevisionId?: string | null }) => [state.targetId, state])
  );
  const filteredEntities = unreadOnly
    ? entities.filter((entity) => {
        const baseRevisionId = entity.article?.baseRevisionId ?? null;
        const readState = readStateMap.get(entity.id);
        return Boolean(baseRevisionId && readState?.lastReadRevisionId !== baseRevisionId);
      })
    : entities;
  const archivedEntities = workspace
    ? await prisma.entity.findMany({
        where: { workspaceId: workspace.id, softDeletedAt: { not: null } },
        orderBy: { updatedAt: "desc" }
      })
    : [];

  return (
    <div className="panel">
      <LlmContext
        value={{
          type: "articles",
          entityIds: filteredEntities.map((entity: EntitySummary) => entity.id),
          filters: {
            eraFilter,
            chapterFilter,
            viewpointFilter,
            mode,
            query,
            typeFilter,
            statusFilter,
            tags: tagList,
            unreadOnly
          }
        }}
      />
      <h2>Articles</h2>
      <FilterSummary />
      {!workspace && <p className="muted">Select a workspace to manage articles.</p>}

      {workspace && (
        <>
          <section className="panel">
            <h3>Filters</h3>
            <form method="get" className="form-grid">
              <input type="hidden" name="era" value={eraFilter} />
              <input type="hidden" name="chapter" value={chapterFilter} />
              <input type="hidden" name="viewpoint" value={viewpointFilter} />
              <input type="hidden" name="mode" value={mode} />
              <label>
                Search
                <input name="q" defaultValue={query} placeholder="Title, alias, tag" />
              </label>
              <label>
                Type
                <select name="type" defaultValue={typeFilter}>
                  <option value="all">All</option>
                  {ENTITY_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Status
                <select name="status" defaultValue={statusFilter}>
                  <option value="all">All</option>
                  {ENTITY_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Tags (comma)
                <input name="tags" defaultValue={tagsRaw} />
              </label>
              <label>
                Unread only
                <select name="unread" defaultValue={unreadOnly ? "true" : "false"}>
                  <option value="false">No</option>
                  <option value="true">Yes</option>
                </select>
              </label>
              <button type="submit">Apply filters</button>
            </form>
          </section>
          <section className="panel">
            <h3>Create entity + base draft</h3>
            <form action="/api/articles/create" method="post" className="form-grid">
              <input type="hidden" name="workspaceId" value={workspace.id} />
              <label>
                Type
                <select name="type">
                  {ENTITY_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Title
                <input name="title" required />
              </label>
              <label>
                Aliases (comma)
                <input name="aliases" />
              </label>
              <label>
                Tags (comma)
                <input name="tags" />
              </label>
              <label>
                World Exist From
                <input name="worldExistFrom" />
              </label>
              <label>
                World Exist To
                <input name="worldExistTo" />
              </label>
              <MarkdownEditor name="bodyMd" label="Body (Markdown)" rows={6} />
              <label>
                Change summary
                <input name="changeSummary" />
              </label>
              <button type="submit">Create</button>
            </form>
          </section>

          <WikiArticleImportPanel workspaceId={workspace.id} entityTypes={ENTITY_TYPES} />

          <section className="panel">
            <h3>Entities</h3>
            <ul>
              {filteredEntities.map((entity: EntitySummary) => (
                <li key={entity.id} className="list-row">
                  <div>
                    <Link href={`/articles/${entity.id}`}>{entity.title}</Link>
                    <span className="muted"> ・ {entity.type}</span>
                    {(() => {
                      const baseRevisionId = entity.article?.baseRevisionId ?? null;
                      const readState = readStateMap.get(entity.id);
                      const isUnread =
                        baseRevisionId &&
                        readState?.lastReadRevisionId !== baseRevisionId;
                      return isUnread ? <span className="badge">Unread</span> : null;
                    })()}
                  </div>
                  <form action="/api/archive" method="post">
                    <input type="hidden" name="workspaceId" value={workspace.id} />
                    <input type="hidden" name="targetType" value="entity" />
                    <input type="hidden" name="targetId" value={entity.id} />
                    <button type="submit" className="link-button">Archive</button>
                  </form>
                </li>
              ))}
              {filteredEntities.length === 0 && <li className="muted">No entities yet.</li>}
            </ul>
          </section>
          <section className="panel">
            <h3>Archived entities</h3>
            <ul>
              {archivedEntities.map((entity: EntitySummary) => (
                <li key={entity.id} className="list-row">
                  <span>{entity.title}</span>
                  <form action="/api/restore" method="post">
                    <input type="hidden" name="workspaceId" value={workspace.id} />
                    <input type="hidden" name="targetType" value="entity" />
                    <input type="hidden" name="targetId" value={entity.id} />
                    <button type="submit" className="link-button">Restore</button>
                  </form>
                </li>
              ))}
              {archivedEntities.length === 0 && <li className="muted">No archived entities.</li>}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}







