import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getActiveWorkspace } from "@/lib/workspaces";
import { LlmContext } from "@/components/LlmContext";

type ReviewCommentSummary = {
  id: string;
  bodyMd: string;
  user: { name: string | null } | null;
};
type ReviewSummary = {
  id: string;
  revisionId: string;
  revision: { status: string };
  comments: ReviewCommentSummary[];
};
type AuditLogSummary = {
  id: string;
  action: string;
  targetType: string;
  targetId: string;
  actorUserId: string;
  actorUser: { name: string | null } | null;
  createdAt: Date;
};


export default async function ReviewsPage() {
  const user = await requireUser();
  const workspace = await getActiveWorkspace(user.id);
  const reviews: ReviewSummary[] = workspace
    ? await prisma.reviewRequest.findMany({
        where: { workspaceId: workspace.id, status: "open" },
        include: {
          revision: true,
          comments: { include: { user: true }, orderBy: { createdAt: "asc" } }
        },
        orderBy: { requestedAt: "desc" }
      })
    : [];

  const auditLogs: AuditLogSummary[] = workspace
    ? await prisma.auditLog.findMany({
        where: { workspaceId: workspace.id },
        include: { actorUser: true },
        orderBy: { createdAt: "desc" },
        take: 50
      })
    : [];

  return (
    <div className="panel">
      <LlmContext
        value={{
          type: "reviews",
          workspaceId: workspace?.id ?? null,
          openReviewIds: reviews.map((review) => review.id),
          auditCount: auditLogs.length
        }}
      />
      <h2>Reviews</h2>
      {!workspace && <p className="muted">Select a workspace to review drafts.</p>}

      {workspace && (
        <>
        <section className="panel">
          <h3>Open review requests</h3>
          <ul>
            {reviews.map((review) => (
              <li key={review.id} className="panel">
                <div>
                  Revision: {review.revisionId}
                  <div className="muted">Status: {review.revision.status}</div>
                </div>
                <div className="review-actions">
                  <form action="/api/reviews/assign" method="post" className="form-grid">
                    <input type="hidden" name="workspaceId" value={workspace.id} />
                    <input type="hidden" name="reviewId" value={review.id} />
                    <label>
                      Assign reviewer ID
                      <input name="reviewerId" />
                    </label>
                    <button type="submit" className="link-button">Assign</button>
                  </form>
                  <form action="/api/reviews/approve" method="post">
                    <input type="hidden" name="workspaceId" value={workspace.id} />
                    <input type="hidden" name="reviewId" value={review.id} />
                    <button type="submit" className="link-button">Approve</button>
                  </form>
                  <form action="/api/reviews/reject" method="post" className="form-grid">
                    <input type="hidden" name="workspaceId" value={workspace.id} />
                    <input type="hidden" name="reviewId" value={review.id} />
                    <label>
                      Reject reason
                      <input name="reason" />
                    </label>
                    <button type="submit" className="link-button">Reject</button>
                  </form>
                </div>
                <div className="panel">
                  <h4>Comments</h4>
                  <ul>
                    {review.comments.map((comment) => (
                      <li key={comment.id} className="list-row">
                        <div>{comment.bodyMd}</div>
                        <span className="muted">{comment.user?.name ?? "User"}</span>
                      </li>
                    ))}
                    {review.comments.length === 0 && <li className="muted">No comments yet.</li>}
                  </ul>
                  <form action="/api/reviews/comment" method="post" className="form-grid">
                    <input type="hidden" name="workspaceId" value={workspace.id} />
                    <input type="hidden" name="reviewId" value={review.id} />
                    <label>
                      Comment
                      <textarea name="body" rows={3} required />
                    </label>
                    <button type="submit" className="link-button">Add comment</button>
                  </form>
                </div>
              </li>
            ))}
            {reviews.length === 0 && <li className="muted">No pending reviews.</li>}
          </ul>
        </section>

        <section className="panel">
          <h3>Audit Log</h3>
          <ul>
            {auditLogs.map((log) => (
              <li key={log.id} className="list-row">
                <div>
                  <span style={{ fontWeight: 600 }}>{log.action}</span>
                  <span className="muted"> on {log.targetType} ({log.targetId})</span>
                </div>
                <div className="muted" style={{ fontSize: '12px' }}>
                  {log.actorUser?.name ?? log.actorUserId} at {log.createdAt.toLocaleString()}
                </div>
              </li>
            ))}
            {auditLogs.length === 0 && <li className="muted">No audit logs.</li>}
          </ul>
        </section>
        </>
      )}
    </div>
  );
}


