import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { getActiveWorkspace } from "@/lib/workspaces";
import { LlmContext } from "@/components/LlmContext";
import { MarkdownView } from "@/components/MarkdownView";
import { AutoMarkRead } from "@/components/AutoMarkRead";

const TRUTH_FLAGS = ["canonical", "rumor", "mistaken", "propaganda", "unknown"];

type SearchParams = { [key: string]: string | string[] | undefined };
type RevisionSummary = { id: string; status: string; changeSummary: string; bodyMd: string };
type OverlayWithRevisions = {
  id: string;
  title: string;
  truthFlag: string;
  activeRevision?: { bodyMd: string } | null;
  revisions: RevisionSummary[];
};
type OverlayArchived = { id: string; title: string; truthFlag: string };

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<SearchParams>;
};

export default async function ArticleDetailPage({ params, searchParams }: PageProps) {
  const user = await requireUser();
  const workspace = await getActiveWorkspace(user.id);
  if (!workspace) {
    return <div className="panel">Select a workspace.</div>;
  }
  const { id } = await params;
  const resolvedSearchParams = await searchParams;

  const mode = String(resolvedSearchParams.mode ?? "canon");
  const viewpoint = String(resolvedSearchParams.viewpoint ?? "canon");
  const eraFilter = String(resolvedSearchParams.era ?? "all");
  const chapterFilter = String(resolvedSearchParams.chapter ?? "all");

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
    where: { id },
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
          revisions: { orderBy: { createdAt: "desc" } },
          activeRevision: true
        }
      }
    }
  });

  if (!entity) return <div className="panel">Not found.</div>;

  const archivedOverlays = await prisma.articleOverlay.findMany({
    where: { entityId: entity.id, workspaceId: workspace.id, softDeletedAt: { not: null } }
  });

  const showBase = mode === "canon" || mode === "compare" || viewpoint === "canon";
  const showOverlays = mode === "viewpoint" || mode === "compare";

  return (
    <div className="panel">
      <LlmContext
        value={{
          type: "entity",
          entityId: entity.id,
          title: entity.title,
          mode,
          viewpoint,
          eraFilter,
          chapterFilter,
          baseRevisionId: entity.article?.baseRevisionId ?? null,
          overlayIds: entity.overlays.map((overlay: { id: string }) => overlay.id)
        }}
      />
      <AutoMarkRead
        workspaceId={workspace.id}
        targetType="entity"
        targetId={entity.id}
        lastReadRevisionId={entity.article?.baseRevisionId ?? null}
      />
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
      <section className="panel">
        <h3>Entity metadata</h3>
        <form action="/api/articles/update" method="post" className="form-grid">
          <input type="hidden" name="workspaceId" value={workspace.id} />
          <input type="hidden" name="entityId" value={entity.id} />
          <label>
            Title
            <input name="title" defaultValue={entity.title} />
          </label>
          <label>
            Status
            <select name="status" defaultValue={entity.status}>
              <option value="draft">draft</option>
              <option value="in_review">in_review</option>
              <option value="approved">approved</option>
              <option value="deprecated">deprecated</option>
            </select>
          </label>
          <label>
            Aliases (comma)
            <input name="aliases" defaultValue={entity.aliases.join(", ")} />
          </label>
          <label>
            Tags (comma)
            <input name="tags" defaultValue={entity.tags.join(", ")} />
          </label>
          <label>
            World exist from
            <input name="worldExistFrom" defaultValue={entity.worldExistFrom ?? ""} />
          </label>
          <label>
            World exist to
            <input name="worldExistTo" defaultValue={entity.worldExistTo ?? ""} />
          </label>
          <label>
            Story intro chapter ID
            <input name="storyIntroChapterId" defaultValue={entity.storyIntroChapterId ?? ""} />
          </label>
          <button type="submit">Update entity</button>
        </form>
      </section>

      <div className={mode === "compare" ? "compare-layout" : ""}>
        {showBase && (
          <div className={`compare-pane canon ${mode === "compare" ? "panel" : ""}`}>
            <h3>Base Article (Canon)</h3>
            {entity.article?.baseRevision ? (
              <MarkdownView value={entity.article.baseRevision.bodyMd} />
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
              {entity.article?.revisions.map((rev: RevisionSummary) => (
                <li key={rev.id} className="list-row">
                  <div>
                    <a href={`/revisions/${rev.id}`}>{rev.status} ÅE {rev.changeSummary}</a>
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
          </div>
        )}

        {showOverlays && (
          <div className="compare-pane viewpoint">
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
              {entity.overlays.map((overlay: OverlayWithRevisions) => (
                <li key={overlay.id} className="panel">
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <strong>{overlay.title}</strong>
                    <span className={`truth-flag truth-${overlay.truthFlag}`}>
                      {overlay.truthFlag}
                    </span>
                  </div>
                  {overlay.activeRevision ? (
                    <MarkdownView value={overlay.activeRevision.bodyMd} />
                  ) : overlay.revisions[0] ? (
                    <MarkdownView value={overlay.revisions[0].bodyMd} />
                  ) : (
                    <p className="muted">No active revision yet.</p>
                  )}
                  <form action="/api/archive" method="post">
                    <input type="hidden" name="workspaceId" value={workspace.id} />
                    <input type="hidden" name="targetType" value="overlay" />
                    <input type="hidden" name="targetId" value={overlay.id} />
                    <button type="submit" className="link-button">Archive overlay</button>
                  </form>
                  <ul>
                    {overlay.revisions.map((rev: RevisionSummary) => (
                      <li key={rev.id} className="list-row">
                        <div>
                          <a href={`/revisions/${rev.id}`}>{rev.status} ÅE {rev.changeSummary}</a>
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
                </li>
              ))}
              {entity.overlays.length === 0 && <li className="muted">No overlays yet.</li>}
            </ul>
            <h4>Archived overlays</h4>
            <ul>
              {archivedOverlays.map((overlay: OverlayArchived) => (
                <li key={overlay.id} className="list-row">
                  <span>{overlay.title}</span>
                  <form action="/api/restore" method="post">
                    <input type="hidden" name="workspaceId" value={workspace.id} />
                    <input type="hidden" name="targetType" value="overlay" />
                    <input type="hidden" name="targetId" value={overlay.id} />
                    <button type="submit" className="link-button">Restore</button>
                  </form>
                </li>
              ))}
              {archivedOverlays.length === 0 && <li className="muted">No archived overlays.</li>}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}


