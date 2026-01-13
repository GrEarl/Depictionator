import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireApiSession, requireWorkspaceAccess, apiError } from "@/lib/api";
import { logAudit } from "@/lib/audit";
import { createNotification, notifyWatchers } from "@/lib/notifications";

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
  const body = String(form.get("body") ?? "").trim();

  if (!workspaceId || !reviewId || !body) {
    return apiError("Missing fields", 400);
  }

  try {
    await requireWorkspaceAccess(session.userId, workspaceId, "editor");
  } catch {
    return apiError("Forbidden", 403);
  }

  const review = await prisma.reviewRequest.findFirst({
    where: { id: reviewId, workspaceId }
  });
  if (!review) {
    return apiError("Review not found", 404);
  }

  const comment = await prisma.reviewComment.create({
    data: {
      reviewRequestId: reviewId,
      userId: session.userId,
      bodyMd: body,
      workspaceId
    }
  });

  await logAudit({
    workspaceId,
    actorUserId: session.userId,
    action: "comment",
    targetType: "review",
    targetId: reviewId
  });

  if (review.requestedById !== session.userId) {
    await createNotification({
      userId: review.requestedById,
      workspaceId,
      type: "review_comment",
      payload: { reviewId, commentId: comment.id }
    });
  }

  await notifyWatchers({
    workspaceId,
    targetType: "review",
    targetId: reviewId,
    type: "review_comment",
    payload: { reviewId, commentId: comment.id }
  });

  return NextResponse.redirect(new URL("/reviews", request.url));
}
