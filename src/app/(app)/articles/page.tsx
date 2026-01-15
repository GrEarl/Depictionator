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

type EntitySummary = {
  id: string;
  title: string;
  type: string;
  article?: { baseRevisionId: string | null } | null;
};

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
  const readStateMap = new Map<string, { lastReadRevisionId?: string | null }>(
    readStates.map((state: { targetId: string; lastReadRevisionId?: string | null }) => [state.targetId, state])
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
          entityIds: entities.map((entity: EntitySummary) => entity.id)
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
            <h3>Wiki import (Article)</h3>
            <form action="/api/wiki/import/article" method="post" className="form-grid">
              <input type="hidden" name="workspaceId" value={workspace.id} />
              <label>
                Title
                <input name="title" placeholder="e.g. Tokyo" />
              </label>
              <label>
                Page ID (optional)
                <input name="pageId" placeholder="e.g. 30057" />
              </label>
              <label>
                Language
                <input name="lang" defaultValue="en" />
              </label>
              <label>
                Target language (optional)
                <input name="targetLang" placeholder="e.g. ja" />
              </label>
              <label>
                Entity type
                <select name="entityType">
                  {ENTITY_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Publish
                <select name="publish">
                  <option value="true">Yes</option>
                  <option value="false">No</option>
                </select>
              </label>
              <details className="panel" style={{ padding: "12px" }}>
                <summary>LLM options</summary>
                <label>
                  Use LLM
                  <select name="useLlm">
                    <option value="true">true</option>
                    <option value="false">false</option>
                  </select>
                </label>
                <label>
                  Aggregate languages
                  <select name="aggregateLangs">
                    <option value="true">true</option>
                    <option value="false">false</option>
                  </select>
                </label>
                <label>
                  LLM provider
                  <select name="llmProvider">
                    <option value="gemini_ai">gemini_ai</option>
                    <option value="gemini_vertex">gemini_vertex</option>
                    <option value="codex_cli">codex_cli</option>
                  </select>
                </label>
                <label>
                  LLM model (optional)
                  <input name="llmModel" placeholder="gemini-3-flash-preview" />
                </label>
                <label>
                  Codex auth base64 (optional)
                  <textarea name="codexAuthBase64" rows={3} />
                </label>
              </details>
              <button type="submit">Import</button>
            </form>
            <p className="muted">
              If both Title and Page ID are set, Page ID is used. LLM synthesis
              runs when configured and required for non-target languages.
            </p>
          </section>

          <section className="panel">
            <h3>Entities</h3>
            <ul>
              {entities.map((entity: EntitySummary) => (
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
              {entities.length === 0 && <li className="muted">No entities yet.</li>}
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







