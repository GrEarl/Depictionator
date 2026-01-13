import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireApiSession, requireWorkspaceAccess, apiError } from "@/lib/api";
import { logAudit } from "@/lib/audit";
import { createNotification } from "@/lib/notifications";

export async function POST(request: Request) {
  let session;
  try {
    session = await requireApiSession();
  } catch {
    return apiError("Unauthorized", 401);
  }

  const form = await request.formData();
  const workspaceId = String(form.get("workspaceId") ?? "");
  const reviewId = String(form.get("reviewId") ?? "");

  if (!workspaceId || !reviewId) {
    return apiError("Missing fields", 400);
  }

  try {
    await requireWorkspaceAccess(session.userId, workspaceId, "reviewer");
  } catch {
    return apiError("Forbidden", 403);
  }

  const review = await prisma.reviewRequest.update({
    where: { id: reviewId },
    data: { status: "approved" },
    include: { revision: true }
  });

  await prisma.articleRevision.update({
    where: { id: review.revisionId },
    data: { status: "approved", approvedAt: new Date(), approvedById: session.userId }
  });

  if (review.revision.targetType === "base" && review.revision.articleId) {
    await prisma.article.update({
      where: { entityId: review.revision.articleId },
      data: { baseRevisionId: review.revisionId }
    });
  }

  if (review.revision.targetType === "overlay" && review.revision.overlayId) {
    await prisma.articleOverlay.update({
      where: { id: review.revision.overlayId },
      data: { activeRevisionId: review.revisionId }
    });
  }

  await logAudit({
    workspaceId,
    actorUserId: session.userId,
    action: "approve",
    targetType: "review",
    targetId: reviewId
  });

  await createNotification({
    userId: review.requestedById,
    workspaceId,
    type: "review_approved",
    payload: { reviewId, revisionId: review.revisionId }
  });

  return NextResponse.redirect(new URL("/app/reviews", request.url));
}
