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
  const reason = String(form.get("reason") ?? "").trim();

  if (!workspaceId || !reviewId) {
    return apiError("Missing fields", 400);
  }

  try {
    await requireWorkspaceAccess(session.userId, workspaceId, "reviewer");
  } catch {
    return apiError("Forbidden", 403);
  }

  const review = await prisma.reviewRequest.findFirst({
    where: { id: reviewId, workspaceId },
    include: { revision: true }
  });
  if (!review) {
    return apiError("Review not found", 404);
  }

  await prisma.reviewRequest.update({
    where: { id: reviewId },
    data: { status: "rejected" }
  });

  await prisma.articleRevision.update({
    where: { id: review.revisionId },
    data: { status: "rejected" }
  });

  if (reason) {
    await prisma.reviewComment.create({
      data: {
        reviewRequestId: reviewId,
        userId: session.userId,
        bodyMd: reason,
        workspaceId
      }
    });
  }

  await logAudit({
    workspaceId,
    actorUserId: session.userId,
    action: "reject",
    targetType: "review",
    targetId: reviewId
  });

  await createNotification({
    userId: review.requestedById,
    workspaceId,
    type: "review_rejected",
    payload: { reviewId, revisionId: review.revisionId, reason }
  });

  return NextResponse.redirect(new URL("/reviews", request.url));
}
