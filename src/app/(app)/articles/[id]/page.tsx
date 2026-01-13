import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { getActiveWorkspace } from "@/lib/workspaces";

const TRUTH_FLAGS = ["canonical", "rumor", "mistaken", "propaganda", "unknown"];

type SearchParams = { [key: string]: string | string[] | undefined };

export default async function ArticleDetailPage({
  params,
  searchParams
}: {
  params: { id: string };
  searchParams: SearchParams;
}) {
  const user = await requireUser();
  const workspace = await getActiveWorkspace(user.id);
  if (!workspace) {
    return <div className="panel">Select a workspace.</div>;
  }

  const mode = String(searchParams.mode ?? "canon");
  const viewpoint = String(searchParams.viewpoint ?? "canon");
  const eraFilter = String(searchParams.era ?? "all");
  const chapterFilter = String(searchParams.chapter ?? "all");

  const overlayWhere = {
    ...(viewpoint === "canon" ? {} : { viewpointId: viewpoint }),
    softDeletedAt: null,
    ...(eraFilter === "all"
      ? {}
      : {
          OR: [{ worldFrom: eraFilter }, { worldTo: eraFilter }, { worldFrom: null, worldTo: null }]
        }),
    ...(chapterFilter === "all"
      ? {}
      : {
          OR: [
            { storyFromChapterId: chapterFilter },
            { storyToChapterId: chapterFilter },
            { storyFromChapterId: null, storyToChapterId: null }
          ]
        })
  };

  const entity = await prisma.entity.findUnique({
    where: { id: params.id },
    include: {
      article: {
        include: {
          revisions: { orderBy: { createdAt: "desc" } },
          baseRevision: true
        }
      },
      overlays: {
        where: overlayWhere,
        include: {
          revisions: { orderBy: { createdAt: "desc" } }
        }
      }
    }
  });

  if (!entity) return <div className="panel">Not found.</div>;

  const showBase = mode === "canon" || mode === "compare" || viewpoint === "canon";
  const showOverlays = mode === "viewpoint" || mode === "compare";

  return (
    <div className="panel">
      <h2>{entity.title}</h2>
      <p className="muted">Type: {entity.type}</p>
      <div className="list-row">
        <form action="/api/watches/toggle" method="post">
          <input type="hidden" name="workspaceId" value={workspace.id} />
          <input type="hidden" name="targetType" value="entity" />
          <input type="hidden" name="targetId" value={entity.id} />
          <button type="submit" className="link-button">Toggle Watch</button>
        </form>
        <form action="/api/read-state/mark" method="post">
          <input type="hidden" name="workspaceId" value={workspace.id} />
          <input type="hidden" name="targetType" value="entity" />
          <input type="hidden" name="targetId" value={entity.id} />
          <input type="hidden" name="lastReadRevisionId" value={entity.article?.baseRevisionId ?? ""} />
          <button type="submit" className="link-button">Mark Read</button>
        </form>
      </div>

      {showBase && (
        <section className="panel">
          <h3>Base Article</h3>
          {entity.article?.baseRevision ? (
            <pre className="code-block">{entity.article.baseRevision.bodyMd}</pre>
          ) : (
            <p className="muted">No approved base revision yet.</p>
          )}

          <form action="/api/revisions/create" method="post" className="form-grid">
            <input type="hidden" name="workspaceId" value={workspace.id} />
            <input type="hidden" name="targetType" value="base" />
            <input type="hidden" name="articleId" value={entity.id} />
            <label>
              New draft (Markdown)
              <textarea name="bodyMd" rows={6} />
            </label>
            <label>
              Change summary
              <input name="changeSummary" />
            </label>
            <button type="submit">Save draft</button>
          </form>

          <h4>Revisions</h4>
          <ul>
            {entity.article?.revisions.map((rev) => (
              <li key={rev.id} className="list-row">
                <div>
                  {rev.status} · {rev.changeSummary}
                </div>
                {rev.status === "draft" && (
                  <form action="/api/revisions/submit" method="post">
                    <input type="hidden" name="workspaceId" value={workspace.id} />
                    <input type="hidden" name="revisionId" value={rev.id} />
                    <button type="submit" className="link-button">Submit review</button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {showOverlays && (
        <section className="panel">
          <h3>Overlays (Viewpoint)</h3>
          <form action="/api/overlays/create" method="post" className="form-grid">
            <input type="hidden" name="workspaceId" value={workspace.id} />
            <input type="hidden" name="entityId" value={entity.id} />
            <label>
              Title
              <input name="title" required />
            </label>
            <label>
              Truth flag
              <select name="truthFlag">
                {TRUTH_FLAGS.map((flag) => (
                  <option key={flag} value={flag}>
                    {flag}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Viewpoint ID (optional)
              <input name="viewpointId" />
            </label>
            <label>
              World from (era/date)
              <input name="worldFrom" />
            </label>
            <label>
              World to (era/date)
              <input name="worldTo" />
            </label>
            <label>
              Story from chapter ID
              <input name="storyFromChapterId" />
            </label>
            <label>
              Story to chapter ID
              <input name="storyToChapterId" />
            </label>
            <label>
              Body (Markdown)
              <textarea name="bodyMd" rows={6} />
            </label>
            <label>
              Change summary
              <input name="changeSummary" />
            </label>
            <button type="submit">Create overlay draft</button>
          </form>

          <ul>
            {entity.overlays.map((overlay) => (
              <li key={overlay.id} className="panel">
                <strong>{overlay.title}</strong>
                <div className="muted">Truth: {overlay.truthFlag}</div>
                <form action="/api/archive" method="post">
                  <input type="hidden" name="workspaceId" value={workspace.id} />
                  <input type="hidden" name="targetType" value="overlay" />
                  <input type="hidden" name="targetId" value={overlay.id} />
                  <button type="submit" className="link-button">Archive overlay</button>
                </form>
                <ul>
                  {overlay.revisions.map((rev) => (
                    <li key={rev.id} className="list-row">
                      <div>{rev.status} · {rev.changeSummary}</div>
                      {rev.status === "draft" && (
                        <form action="/api/revisions/submit" method="post">
                          <input type="hidden" name="workspaceId" value={workspace.id} />
                          <input type="hidden" name="revisionId" value={rev.id} />
                          <button type="submit" className="link-button">Submit review</button>
                        </form>
                      )}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
            {entity.overlays.length === 0 && <li className="muted">No overlays yet.</li>}
          </ul>
        </section>
      )}
    </div>
  );
}
