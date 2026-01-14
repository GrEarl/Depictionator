import Link from "next/link";
import { FilterSummary } from "@/components/FilterSummary";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getActiveWorkspace } from "@/lib/workspaces";
import { LlmContext } from "@/components/LlmContext";

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

export default async function ArticlesPage() {
  const user = await requireUser();
  const workspace = await getActiveWorkspace(user.id);

  // Parse filters
  // const eraFilter = String(searchParams.era ?? "all");
  // const chapterFilter = String(searchParams.chapter ?? "all");
  // const viewpointFilter = String(searchParams.viewpoint ?? "canon");

  const entities = workspace
    ? await prisma.entity.findMany({
        where: {
          workspaceId: workspace.id,
          softDeletedAt: null
          // TODO: Add filtering by era/chapter if feasible with string fields
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
  const readStateMap = new Map(
    readStates.map((state: { targetId: string }) => [state.targetId, state])
  );
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
          entityIds: entities.map((entity) => entity.id)
        }}
      />
      <h2>Articles</h2>
      <FilterSummary />
      {!workspace && <p className="muted">Select a workspace to manage articles.</p>}

      {workspace && (
        <>
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
              <label>
                Body (Markdown)
                <textarea name="bodyMd" rows={6} />
              </label>
              <label>
                Change summary
                <input name="changeSummary" />
              </label>
              <button type="submit">Create</button>
            </form>
          </section>

          <section className="panel">
            <h3>Entities</h3>
            <ul>
              {entities.map((entity) => (
                <li key={entity.id} className="list-row">
                  <div>
                    <Link href={`/articles/${entity.id}`}>{entity.title}</Link>
                    <span className="muted"> · {entity.type}</span>
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
              {entities.length === 0 && <li className="muted">No entities yet.</li>}
            </ul>
          </section>
          <section className="panel">
            <h3>Archived entities</h3>
            <ul>
              {archivedEntities.map((entity) => (
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
