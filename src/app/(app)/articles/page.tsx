import Link from "next/link";
import { FilterSummary } from "@/components/FilterSummary";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getActiveWorkspace } from "@/lib/workspaces";

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
  const entities = workspace
    ? await prisma.entity.findMany({
        where: { workspaceId: workspace.id, softDeletedAt: null },
        orderBy: { updatedAt: "desc" }
      })
    : [];

  return (
    <div className="panel">
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
                    <Link href={`/app/articles/${entity.id}`}>{entity.title}</Link>
                    <span className="muted"> · {entity.type}</span>
                  </div>
                  <form action="/api/articles/delete" method="post">
                    <input type="hidden" name="workspaceId" value={workspace.id} />
                    <input type="hidden" name="entityId" value={entity.id} />
                    <button type="submit" className="link-button">Archive</button>
                  </form>
                </li>
              ))}
              {entities.length === 0 && <li className="muted">No entities yet.</li>}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}
