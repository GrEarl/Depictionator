import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireApiSession, requireWorkspaceAccess, apiError } from "@/lib/api";
import { logAudit } from "@/lib/audit";

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
  const reviewerId = String(form.get("reviewerId") ?? "");

  if (!workspaceId || !reviewId || !reviewerId) {
    return apiError("Missing fields", 400);
  }

  try {
    await requireWorkspaceAccess(session.userId, workspaceId, "admin");
  } catch {
    return apiError("Forbidden", 403);
  }

  await prisma.reviewAssignment.create({
    data: {
      reviewRequestId: reviewId,
      reviewerId
    }
  });

  await logAudit({
    workspaceId,
    actorUserId: session.userId,
    action: "assign_reviewer",
    targetType: "review",
    targetId: reviewId,
    meta: { reviewerId }
  });

  return NextResponse.redirect(new URL("/app/reviews", request.url));
}
