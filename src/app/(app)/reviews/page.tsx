import { requireUser } from "@/auth";
import { prisma } from "@/lib/db";
import { getActiveWorkspace } from "@/lib/workspaces";
import { LlmContext } from "@/components/LlmContext";
import Link from "next/link";

type SearchParams = { [key: string]: string | string[] | undefined };

type ReviewsPageProps = { searchParams: Promise<SearchParams> };

export default async function ReviewsPage({ searchParams }: ReviewsPageProps) {
  const user = await requireUser();
  const workspace = await getActiveWorkspace(user.id);
  const resolvedSearchParams = await searchParams;
  const selectedId = typeof resolvedSearchParams.review === "string" ? resolvedSearchParams.review : undefined;
  const tab = typeof resolvedSearchParams.tab === "string" ? resolvedSearchParams.tab : "queue";

  const [reviews, auditLogs] = workspace
    ? await Promise.all([
        prisma.reviewRequest.findMany({
          where: { workspaceId: workspace.id, status: "open" },
          include: {
            revision: { include: { parentRevision: true } },
            comments: { include: { user: true }, orderBy: { createdAt: "asc" } }
          },
          orderBy: { requestedAt: "desc" }
        }),
        prisma.auditLog.findMany({
          where: { workspaceId: workspace.id },
          include: { actorUser: true },
          orderBy: { createdAt: "desc" },
          take: 30
        })
      ])
    : [[], []];

  if (!workspace) return <div className="panel">Select a workspace.</div>;

  const selectedReview = reviews.find((r) => r.id === selectedId) || reviews[0];

  return (
    <div className="layout-2-pane">
      <LlmContext value={{ type: "reviews", workspaceId: workspace.id, selectedReviewId: selectedReview?.id }} />

      {/* Pane 1: Queue / History List */}
      <aside className="pane-left">
        <div className="pane-header-tabs">
          <Link href="?tab=queue" className={`tab-link ${tab === "queue" ? "active" : ""}`}>
            Queue ({reviews.length})
          </Link>
          <Link href="?tab=audit" className={`tab-link ${tab === "audit" ? "active" : ""}`}>
            Audit Log
          </Link>
        </div>

        <div className="scroll-content">
          {tab === "queue" ? (
            <div className="review-list">
              {reviews.map((r) => (
                <Link
                  key={r.id}
                  href={`?review=${r.id}&tab=queue`}
                  className={`review-item ${selectedReview?.id === r.id ? "active" : ""}`}
                >
                  <div className="review-item-title">Revision: {r.revisionId.slice(0, 8)}...</div>
                  <div className="muted text-xs">Requested {new Date(r.requestedAt).toLocaleDateString()}</div>
                </Link>
              ))}
              {reviews.length === 0 && <div className="muted p-4">All clear! No pending reviews.</div>}
            </div>
          ) : (
            <div className="audit-list">
              {auditLogs.map((log) => (
                <div key={log.id} className="audit-item">
                  <div className="audit-action">{log.action}</div>
                  <div className="muted text-xs">
                    {log.actorUser?.name || "System"} · {new Date(log.createdAt).toLocaleTimeString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </aside>

      {/* Pane 2: Detail / Action Area */}
      <main className="pane-main-content">
        {selectedReview ? (
          <div className="review-detail">
            <div className="pane-header">
              <h2>Review Request: {selectedReview.revisionId}</h2>
            </div>

            <div className="detail-body p-6">
              <section className="detail-section mb-6">
                <h4>Revision Info</h4>
                <div className="info-card">
                  <div className="info-row">
                    <span>Status</span> <span className="badge">{selectedReview.revision.status}</span>
                  </div>
                  {selectedReview.revision.parentRevisionId && (
                    <div className="info-row">
                      <span>Base Revision</span> <code>{selectedReview.revision.parentRevisionId}</code>
                    </div>
                  )}
                  <div className="info-actions mt-4">
                    <Link href={`/revisions/${selectedReview.revisionId}`} className="btn-secondary">
                      Compare Changes & Diff
                    </Link>
                  </div>
                </div>
              </section>

              <section className="detail-section mb-6">
                <h4>Decision</h4>
                <div className="decision-actions">
                  <form action="/api/reviews/approve" method="post">
                    <input type="hidden" name="workspaceId" value={workspace.id} />
                    <input type="hidden" name="reviewId" value={selectedReview.id} />
                    <button type="submit" className="btn-approve">Approve & Merge</button>
                  </form>
                  <form action="/api/reviews/reject" method="post" className="reject-form">
                    <input type="hidden" name="workspaceId" value={workspace.id} />
                    <input type="hidden" name="reviewId" value={selectedReview.id} />
                    <input name="reason" placeholder="Reason for rejection..." required className="input-text-sm" />
                    <button type="submit" className="btn-reject">Reject Draft</button>
                  </form>
                </div>
              </section>

              <section className="detail-section">
                <h4>Discussion</h4>
                <div className="comments-box mt-4">
                  {selectedReview.comments.map((c) => (
                    <div key={c.id} className="comment-bubble">
                      <div className="comment-user">{c.user?.name || "Unknown"}</div>
                      <div className="comment-body">{c.bodyMd}</div>
                    </div>
                  ))}
                  <form action="/api/reviews/comment" method="post" className="comment-form mt-4">
                    <input type="hidden" name="workspaceId" value={workspace.id} />
                    <input type="hidden" name="reviewId" value={selectedReview.id} />
                    <textarea name="body" placeholder="Add a comment..." required className="input-textarea" rows={2} />
                    <button type="submit" className="btn-secondary">Post Comment</button>
                  </form>
                </div>
              </section>
            </div>
          </div>
        ) : (
          <div className="empty-state-centered">
            <div className="hero-icon">Inbox</div>
            <h2>Inbox Zero</h2>
            <p className="muted">You have no pending review requests. Take a break!</p>
          </div>
        )}
      </main>
    </div>
  );
}
